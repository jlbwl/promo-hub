import sharp from 'sharp'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

/**
 * Multer 文件对象接口
 */
interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
  buffer: Buffer
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', '..', 'data')
const UPLOAD_DIR = join(DATA_DIR, 'uploads')
const COVER_DIR = join(DATA_DIR, 'uploads', 'covers')

// 确保目录存在
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
if (!existsSync(COVER_DIR)) mkdirSync(COVER_DIR, { recursive: true })

/**
 * 封面图片配置
 */
export const COVER_IMAGE_CONFIG = {
  // 目标尺寸（正方形）
  targetWidth: 800,
  targetHeight: 800,
  // 质量设置 (0-100)
  quality: 85,
  // 支持的格式
  supportedFormats: ['jpeg', 'jpg', 'png', 'webp'],
  // 最大文件大小（5MB）
  maxFileSize: 5 * 1024 * 1024,
}

/**
 * 压缩并处理封面图片
 * @param inputPath 原始图片路径
 * @param outputFilename 输出文件名
 * @returns 处理后的文件路径和信息
 */
export async function processCoverImage(
  inputPath: string,
  outputFilename: string
): Promise<{
  path: string
  filename: string
  url: string
  size: number
  width: number
  height: number
}> {
  try {
    const outputPath = join(COVER_DIR, outputFilename)

    // 使用 sharp 处理图片
    const image = sharp(inputPath)
    const metadata = await image.metadata()

    // 调整尺寸、压缩质量、统一格式
    const processed = image
      .resize(COVER_IMAGE_CONFIG.targetWidth, COVER_IMAGE_CONFIG.targetHeight, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: COVER_IMAGE_CONFIG.quality,
        mozjpeg: true,
      })

    await processed.toFile(outputPath)

    // 获取处理后的文件信息
    const processedMetadata = await sharp(outputPath).metadata()
    const fsPromises = (await import('fs/promises')).default
    const stats = await fsPromises.stat(outputPath)

    logger.info('[ImageProcessor] 封面图片处理成功', {
      original: { width: metadata.width, height: metadata.height },
      processed: { width: processedMetadata.width, height: processedMetadata.height },
    })

    return {
      path: outputPath,
      filename: outputFilename,
      url: `/api/uploads/covers/${outputFilename}`,
      size: stats?.size || 0,
      width: processedMetadata.width || COVER_IMAGE_CONFIG.targetWidth,
      height: processedMetadata.height || COVER_IMAGE_CONFIG.targetHeight,
    }
  } catch (error) {
    logger.error('[ImageProcessor] 封面图片处理失败', { error })
    throw new Error('图片处理失败')
  }
}

/**
 * 验证图片文件
 * @param file Multer 文件对象
 * @returns 是否有效
 */
export function validateImageFile(file: MulterFile): {
  valid: boolean
  error?: string
} {
  // 检查文件大小
  if (file.size > COVER_IMAGE_CONFIG.maxFileSize) {
    return {
      valid: false,
      error: `文件大小不能超过 ${COVER_IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB`,
    }
  }

  // 检查文件类型
  const mimeType = file.mimetype.toLowerCase()
  if (!mimeType.startsWith('image/')) {
    return {
      valid: false,
      error: '只支持图片文件',
    }
  }

  const ext = file.originalname.split('.').pop()?.toLowerCase()
  if (!ext || !COVER_IMAGE_CONFIG.supportedFormats.includes(ext)) {
    return {
      valid: false,
      error: `只支持以下格式: ${COVER_IMAGE_CONFIG.supportedFormats.join(', ')}`,
    }
  }

  return { valid: true }
}

export { COVER_DIR, UPLOAD_DIR }
