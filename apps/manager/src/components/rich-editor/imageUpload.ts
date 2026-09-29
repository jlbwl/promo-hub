/**
 * 富文本编辑器图片处理：设备自适应压缩配置、Canvas 压缩、服务器上传
 */
import { post } from '@promo/shared/utils/request'

/** 检测是否为移动设备 */
export const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

interface CompressConfig {
  maxWidth: number
  maxHeight: number
  quality: number
  maxFileSize: number
  mimeType: string
}

/** 压缩配置 - 根据设备类型优化 */
const COMPRESS_CONFIG: Record<'desktop' | 'mobile', CompressConfig> = {
  desktop: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
    maxFileSize: 10 * 1024 * 1024,
    mimeType: 'image/jpeg'
  },
  mobile: {
    maxWidth: 1080,
    maxHeight: 1080,
    quality: 0.7,
    maxFileSize: 5 * 1024 * 1024,
    mimeType: 'image/jpeg'
  }
}

export const compressConfig: CompressConfig = isMobile ? COMPRESS_CONFIG.mobile : COMPRESS_CONFIG.desktop

/** 图片压缩（Canvas 重绘，按设备配置限制尺寸与质量） */
export const compressImage = async (file: File, config: CompressConfig = compressConfig): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // 计算缩放比例
      let width = img.width
      let height = img.height

      if (width > config.maxWidth) {
        height = (height * config.maxWidth) / width
        width = config.maxWidth
      }

      if (height > config.maxHeight) {
        width = (width * config.maxHeight) / height
        height = config.maxHeight
      }

      // 创建 canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 不支持'))
        return
      }

      // 使用平滑绘制
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height)

      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('图片压缩失败'))
          }
        },
        config.mimeType,
        config.quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }

    img.src = url
  })
}

/** 上传图片到服务器，返回可访问 URL */
export const uploadToServer = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)

  const res = await post<{ url: string }>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  return res.data.url
}
