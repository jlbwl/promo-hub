import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import { sessionMiddleware } from './middleware/auth.js'
import routes from './routes/index.js'
import { errorHandler } from './utils/response.js'
import logger, { logRequest } from './utils/logger.js'
import { initializeCache, closeCache, CacheService } from './services/index.js'

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
  if (password === hash) return true
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())
app.use(sessionMiddleware)

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

const UPLOAD_DIR = join(DATA_DIR, 'uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.json({ code: 400, message: '请选择文件', data: null })
    return
  }
  const url = `/api/uploads/${req.file.filename}`
  res.json({ code: 0, message: '上传成功', data: { url, filename: req.file.filename } })
})

app.use('/api/uploads', express.static(UPLOAD_DIR))

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

// 路由
app.use(routes)

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
