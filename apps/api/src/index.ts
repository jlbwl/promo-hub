import 'reflect-metadata'
import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { getErrorMessage, AppError, ErrorCode, HttpStatus } from '@promo/shared'
import logger from './utils/logger.js'
import cookieParser from 'cookie-parser'
import { attachUser, requireManager, requireAdmin } from './middleware/auth.js'
import { csrfGenerate, csrfVerify, getCsrfToken } from './middleware/csrf-v2.js'
import routes from './routes/index.js'
import { clearBusinessCache } from './controllers/cache.controller.js'
import { errorHandler, sendError, sendUploadError } from './utils/response.js'
import { logRequest } from './utils/logger.js'
import { initializeCache, closeCache, getCacheService } from './services/index.js'
import { resolve } from './container.js'
import type { ConfigService } from './services/ConfigService.js'
import {
  processCoverImage,
  validateImageFile,
  COVER_IMAGE_CONFIG,
  UPLOAD_DIR,
} from './utils/imageProcessor.js'

// ✅ 启动时检查必要环境变量 - 放宽要求，允许服务启动但输出警告
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

const app = express()

// 设置 trust proxy 支持 rate limit 正确识别客户端 IP
app.set('trust proxy', 1)

// Helmet 安全头中间件（应放在其他中间件之前）
app.use(helmet())

// 中间件
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Refresh-Token', 'Idempotency-Key'],
}
app.use(cors(corsOptions))
// 客户档案批量导入是整表 JSON 提交，2000 行会超过 body-parser 默认 100kb；
// 这里在全局解析前单独放宽该路径的上限，其余接口维持默认值
app.use('/admin/customers/import', express.json({ limit: '5mb' }))
app.use(express.json())
app.use(cookieParser())

// 动态接口禁用缓存：微信 X5/XWeb 等 WebView 对无 Cache-Control 的 GET 响应走启发式缓存，
// 会把偶发的错误/过期响应持久缓存导致个别用户持续复现「获取产品详情失败」等问题
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

// CSRF token 中间件（生成 + 验证）
app.use(csrfGenerate)

// 提供 CSRF token 获取接口（O14：Nginx 会剥掉 /api 前缀，不能再写 /api）
app.get('/csrf-token', getCsrfToken)

// CSRF 验证中间件（验证非 GET 请求的 CSRF token）
app.use(csrfVerify)

// 可选鉴权：全局解析请求身份（Bearer JWT / Refresh Token），失败不阻断
// 公开路由（如 POST /orders）借此识别已登录用户，避免订单误归因为访客
app.use(attachUser)

// 请求日志中间件
app.use((req, _res, next) => {
  logRequest(
    req.method,
    req.originalUrl,
    req.ip,
    req.user?.id
  )
  next()
})

// 封面图片临时上传存储
// H13：临时文件扩展名只取自白名单 MIME，绝不使用 originalname，防止上传 .html 被静态目录当页面执行
const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!ALLOWED_IMAGE_MIME[file.mimetype]) {
    cb(new AppError('仅支持 JPG/PNG/WEBP 格式图片', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST))
    return
  }
  cb(null, true)
}

const tempCoverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_IMAGE_MIME[file.mimetype] || 'bin'
    cb(null, `temp_cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})

// H13：无论校验失败还是处理异常，都要清理临时文件
async function removeTempUpload(filePath?: string): Promise<void> {
  if (!filePath) return
  try {
    const { promises } = await import('fs')
    await promises.unlink(filePath)
  } catch (err) {
    logger.warn('[API] 删除临时上传文件失败', { path: filePath, error: getErrorMessage(err) })
  }
}

const coverUpload = multer({
  storage: tempCoverStorage,
  limits: { fileSize: COVER_IMAGE_CONFIG.maxFileSize },
  fileFilter: imageFileFilter,
})

// 封面图片上传接口 - 带压缩和尺寸统一（仅经理和管理员可上传）
app.post(
  '/upload/cover',
  requireManager,
  coverUpload.single('cover'),
  async (req, res) => {
    try {
      if (!req.file) {
        sendError(res, '请选择封面图片', 400, 400, { reason: 'NO_FILE' })
        return
      }

      // 验证文件
      const validation = validateImageFile(req.file)
      if (!validation.valid) {
        await removeTempUpload(req.file.path)
        sendError(res, validation.error as string, 400, 400, { reason: validation.reason })
        return
      }

      // 生成输出文件名
      const outputFilename = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`

      // 处理图片
      const result = await processCoverImage(req.file.path, outputFilename)

      // 删除临时文件
      await removeTempUpload(req.file.path)

      logger.info('[API] 封面图片上传成功', { filename: outputFilename })

      res.json({
        code: 0,
        message: '上传成功',
        data: {
          url: result.url,
          filename: result.filename,
          width: result.width,
          height: result.height,
          size: result.size,
        },
      })
    } catch (error) {
      logger.error('[API] 封面图片上传失败', { error: getErrorMessage(error) })
      await removeTempUpload(req.file?.path)
      sendUploadError(res, error)
    }
  }
)

// 通用图片上传接口（富文本编辑器使用）- 带压缩处理
const generalUpload = multer({
  storage: tempCoverStorage,
  limits: { fileSize: COVER_IMAGE_CONFIG.maxFileSize },
  fileFilter: imageFileFilter,
})

// 客户收款码上传：保留原图，不走封面裁剪压缩（裁剪会破坏二维码）
const QRCODE_DIR = join(UPLOAD_DIR, 'qrcodes')
if (!existsSync(QRCODE_DIR)) mkdirSync(QRCODE_DIR, { recursive: true })

const qrcodeUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, QRCODE_DIR),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_IMAGE_MIME[file.mimetype] || 'bin'
      cb(null, `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
})

app.post(
  '/admin/customers/qrcode/upload',
  requireAdmin,
  qrcodeUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        sendError(res, '请选择收款码图片', 400, 400, { reason: 'NO_FILE' })
        return
      }

      const validation = validateImageFile(req.file)
      if (!validation.valid) {
        await removeTempUpload(req.file.path)
        sendError(res, validation.error as string, 400, 400, { reason: validation.reason })
        return
      }

      res.json({
        code: 0,
        message: '上传成功',
        data: { url: `/uploads/qrcodes/${req.file.filename}` },
      })
    } catch (error) {
      logger.error('[API] 收款码上传失败', { error: getErrorMessage(error) })
      await removeTempUpload(req.file?.path)
      sendUploadError(res, error)
    }
  }
)



app.post(
  '/upload',
  requireManager,
  generalUpload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        sendError(res, '请选择图片', 400, 400, { reason: 'NO_FILE' })
        return
      }

      // 验证文件
      const validation = validateImageFile(req.file)
      if (!validation.valid) {
        await removeTempUpload(req.file.path)
        sendError(res, validation.error as string, 400, 400, { reason: validation.reason })
        return
      }

      // 生成输出文件名
      const outputFilename = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`

      // 处理图片（复用封面处理逻辑）
      const result = await processCoverImage(req.file.path, outputFilename)

      // 删除临时文件
      await removeTempUpload(req.file.path)

      logger.info('[API] 通用图片上传成功', { filename: outputFilename })

      res.json({
        code: 0,
        message: '上传成功',
        data: {
          url: result.url,
          filename: result.filename,
          width: result.width,
          height: result.height,
          size: result.size,
        },
      })
    } catch (error) {
      logger.error('[API] 通用图片上传失败', { error: getErrorMessage(error) })
      await removeTempUpload(req.file?.path)
      sendUploadError(res, error)
    }
  }
)

// 静态文件服务
// O4：上传图片文件名唯一且内容不变，覆盖全局 no-store，允许长期缓存（与 Nginx 30 天缓存对齐）
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
  next()
})
// H13：上传目录不允许提供可执行/可渲染的文档类文件，防止被当作 HTML 执行
app.use('/uploads', (req, res, next) => {
  if (/\.(?:html?|js|mjs|svg)$/i.test(req.path)) {
    res.status(403).json({ code: 403, message: '禁止访问', data: null })
    return
  }
  next()
})
// COVER_DIR 是 UPLOAD_DIR/covers 的子目录，/uploads 静态挂载已覆盖封面路径
app.use('/uploads', express.static(UPLOAD_DIR))

// 健康检查：生产 Nginx 的 /api/ 代理会剥离前缀（/api/health -> /health），因此两个路径都要注册
function healthCheckHandler(_req: Request, res: Response) {
  const cacheService = getCacheService()
  const stats = cacheService.getStats()
  res.json({
    code: 0,
    message: 'ok',
    data: {
      uptime: process.uptime(),
      cache: stats
    }
  })
}

app.get('/health', healthCheckHandler)
// 兼容直连 3000 端口且带 /api 前缀的探针（CI 部署脚本），与 /health 同一处理函数
app.get('/api/health', healthCheckHandler)

// 缓存清理接口（仅管理员；O14：路径不写 /api 前缀，Nginx 转发前已剥离）
// 只清理产品域缓存，禁止使用 flush()（Redis FLUSHDB 会清空令牌键空间）
app.post('/cache/clear', requireAdmin, clearBusinessCache)

// 主路由（不添加 /api 前缀，已由 Nginx 代理处理）
app.use('/', routes)

// 全局错误处理 - 必须在路由之后注册
app.use(errorHandler)

async function start() {
  const configService = resolve<ConfigService>('ConfigService')
  
  const PORT = configService.get('port')

  if (process.env.DB_HOST && process.env.DB_NAME) {
    try {
      const pool = (await import('./db.js')).default
      const connection = await pool.getConnection()
      connection.release()
      logger.info('[DB] MySQL connection established')
    } catch (err) {
      logger.error('[DB] MySQL connection failed', { error: err })
      process.exit(1)
    }
  } else {
    logger.warn('[DB] No database configuration found, API may not work properly')
  }

  try {
    await initializeCache()
    logger.info('[Cache] Redis缓存服务初始化完成')
  } catch (err) {
    logger.warn('[Cache] Redis连接失败，将使用内存缓存模式', { error: err })
  }

  app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`)
  })
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，开始关闭服务...')
  await closeCache()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，开始关闭服务...')
  await closeCache()
  process.exit(0)
})

// M20：进程级兜底。记录完整日志后退出，由 pm2 拉起，避免静默崩溃/悬挂
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的 Promise 拒绝，进程退出', { error: getErrorMessage(reason) })
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  logger.error('未捕获异常，进程退出', {
    error: getErrorMessage(error),
    stack: (error as Error)?.stack,
  })
  process.exit(1)
})

start().catch(err => {
  logger.error('Failed to start server:', { error: getErrorMessage(err) })
  process.exit(1)
})
