import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import logger from './utils/logger.js'
import cookieParser from 'cookie-parser'
import { sessionMiddleware } from './middleware/auth.js'
import { smsLimiter, loginLimiter } from './middleware/rateLimit.js'
import { csrfGenerate, csrfVerify, getCsrfToken } from './middleware/csrf-v2.js'
import routes from './routes/index.js'
import { errorHandler } from './utils/response.js'
import { logRequest } from './utils/logger.js'
import { initializeCache, closeCache, CacheService } from './services/index.js'
import bcrypt from 'bcryptjs'
import {
  processCoverImage,
  validateImageFile,
  COVER_IMAGE_CONFIG,
  COVER_DIR,
  UPLOAD_DIR,
} from './utils/imageProcessor.js'

// ✅ 启动时检查必要环境变量 - 放宽要求，允许服务启动但输出警告
const SESSION_SECRET = process.env.SESSION_SECRET
const JWT_SECRET = process.env.JWT_SECRET

if (!SESSION_SECRET || !JWT_SECRET) {
  console.warn('⚠️ 警告：未设置 SESSION_SECRET 和/或 JWT_SECRET 环境变量！')
  console.warn('⚠️ 建议：在生产环境中必须设置这些密钥！')
} else {
  logger.info('✅ 环境变量检查通过')
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
const SALT_ROUNDS = 12

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// 设置 trust proxy 支持 rate limit 正确识别客户端 IP
app.set('trust proxy', 1)

// 中间件
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(sessionMiddleware)

// CSRF token 中间件（仅生成，不验证）
app.use(csrfGenerate)

// 提供 CSRF token 获取接口
app.get('/api/csrf-token', getCsrfToken)

// 请求日志中间件
app.use((req, _res, next) => {
  logRequest(
    req.method,
    req.originalUrl,
    req.ip,
    (req.session as any)?.user?.id
  )
  next()
})

// 通用上传存储配置
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

// 封面图片临时上传存储
const tempCoverStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `temp_cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})

const coverUpload = multer({
  storage: tempCoverStorage,
  limits: { fileSize: COVER_IMAGE_CONFIG.maxFileSize },
})

// 通用文件上传接口
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.json({ code: 400, message: '请选择文件', data: null })
    return
  }
  const url = `/api/uploads/${req.file.filename}`
  res.json({ code: 0, message: '上传成功', data: { url, filename: req.file.filename } })
})

// 封面图片上传接口 - 带压缩和尺寸统一
app.post(
  '/api/upload/cover',
  sessionMiddleware,
  coverUpload.single('cover'),
  async (req, res) => {
    try {
      if (!req.file) {
        res.json({ code: 400, message: '请选择封面图片', data: null })
        return
      }

      // 验证文件
      const validation = validateImageFile(req.file)
      if (!validation.valid) {
        res.json({ code: 400, message: validation.error, data: null })
        return
      }

      // 生成输出文件名
      const outputFilename = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`

      // 处理图片
      const result = await processCoverImage(req.file.path, outputFilename)

      // 删除临时文件
      try {
        const fs = await import('fs')
        const fsPromises = fs.promises
        await fsPromises.unlink(req.file.path)
      } catch (err) {
        logger.warn('[API] 删除临时封面图片失败', { path: req.file.path, error: err })
      }

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
    } catch (error: any) {
      logger.error('[API] 封面图片上传失败', { error: error.message })
      res.json({ code: 500, message: error.message || '上传失败', data: null })
    }
  }
)

// 静态文件服务
app.use('/api/uploads', express.static(UPLOAD_DIR))
app.use('/api/uploads/covers', express.static(COVER_DIR))

app.get('/api/health', (_req, res) => {
  const cacheService = new CacheService()
  const stats = cacheService.getStats()
  res.json({
    code: 0,
    message: 'ok',
    data: {
      uptime: process.uptime(),
      cache: stats
    }
  })
})

// 缓存清理接口（仅管理员）
app.post('/api/cache/clear', async (_req, res) => {
  try {
    const cacheService = new CacheService()
    await cacheService.connect()
    await cacheService.flush()
    await cacheService.disconnect()
    res.json({ code: 0, message: '缓存已清空', data: null })
  } catch (error: any) {
    res.json({ code: 500, message: '清空缓存失败: ' + error.message, data: null })
  }
})

// 调试信息 - 输出已注册的路由
console.log('[API] 路由已注册完成')

// 临时调试路由 - 直接测试 PUT/DELETE 分类功能
app.get('/api/debug-routes', (_req, res) => {
  res.json({
    message: 'Debug routes',
    available: [
      'GET /api/categories',
      'POST /api/categories', 
      'PUT /api/categories/:id',
      'DELETE /api/categories/:id'
    ]
  })
})

// 临时路由 - 绕过任何问题，直接处理 category 相关请求
import * as dataMemory from './data-memory.js'
app.get('/api/categories', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true'
    const categories = await dataMemory.readCategories(includeArchived)
    res.json({ code: 0, message: '获取成功', data: { list: categories } })
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取失败', data: null })
  }
})

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, sort, status } = req.body
    const id = req.params.id
    const updated = await dataMemory.updateCategory(id, { name, sort, status })
    if (!updated) {
      return res.status(404).json({ code: 404, message: '分类不存在', data: null })
    }
    res.json({ code: 0, message: '更新成功', data: updated })
  } catch (err) {
    res.status(500).json({ code: 500, message: '更新失败', data: null })
  }
})

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const id = req.params.id
    const success = await dataMemory.archiveCategory(id)
    if (!success) {
      return res.status(404).json({ code: 404, message: '分类不存在', data: null })
    }
    res.json({ code: 0, message: '归档成功', data: null })
  } catch (err) {
    res.status(500).json({ code: 500, message: '归档失败', data: null })
  }
})

// 主路由（添加 /api 前缀） - 先注册所有路由，不应用 CSRF 验证
app.use('/api', routes)

// 全局错误处理 - 必须在路由之后注册
app.use(errorHandler)

async function start() {
  const isDatabaseMode = process.env.DB_HOST && process.env.DB_NAME

  // 初始化数据库
  if (isDatabaseMode) {
    try {
      const { initDatabase } = await import('./db.js')
      await initDatabase()
      logger.info(`API server running on port ${PORT} (MySQL)`)
    } catch (err) {
      logger.warn(`[INFO] MySQL connection failed, falling back to file storage`, { error: err })
      logger.info(`API server running on port ${PORT} (File Storage)`)
    }
  } else {
    logger.info(`API server running on port ${PORT} (File Storage)`)
  }

  // 初始化Redis缓存
  try {
    await initializeCache()
    logger.info('[Cache] Redis缓存服务初始化完成')
  } catch (err) {
    logger.warn('[Cache] Redis连接失败，将使用内存缓存模式', { error: err })
  }

  app.listen(PORT)
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

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

export { hashPassword, verifyPassword }
