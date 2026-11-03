/**
 * OCR 路由：海报券商名称云端识别
 *
 * POST /api/ocr/poster — 上传海报图片（multipart/form-data，字段名 image），
 * 由阿里云 OCR 识别顶部区域文字并提取「名称 + 证券/期货」名称。
 * 仅经理可用；未配置阿里云密钥返回 503，前端收到后回退本地 tesseract 识别。
 */
import { Router } from 'express'
import multer from 'multer'
import { requireManager } from '../middleware/auth.js'
import { sendError, sendSuccess } from '../utils/response.js'
import logger from '../utils/logger.js'
import {
  isAliyunOcrConfigured,
  recognizePosterBrokerName
} from '../services/AliyunOcrService.js'

const router: Router = Router()

// 海报图片内存暂存（不入盘），单张上限 8MB
const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
})

router.post(
  '/ocr/poster',
  requireManager,
  posterUpload.single('image'),
  async (req, res) => {
    // mimetype 非法时 multer 静默丢弃文件
    const file = req.file
    if (!file || !file.mimetype.startsWith('image/')) {
      sendError(res, '请上传有效的图片文件（JPG / PNG）')
      return
    }
    if (!isAliyunOcrConfigured()) {
      sendError(res, 'OCR 服务未配置', 503)
      return
    }

    try {
      const { brokerName, lines } = await recognizePosterBrokerName(file.buffer)
      sendSuccess(
        res,
        { brokerName, lines },
        brokerName ? '识别成功' : '未识别到券商名称'
      )
    } catch (err) {
      // 阿里云调用失败等异常：记录日志并返回 502，前端回退本地识别
      logger.logError(err as Error, req.method, req.originalUrl, req.ip)
      sendError(res, 'OCR 识别失败，请稍后重试', 502)
    }
  }
)

export default router
