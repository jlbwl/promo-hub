import { logger } from '@promo/shared/utils/logger'

// 优化富文本内容，移除不必要的标签并压缩
export const optimizeRichText = (html: string): string => {
  if (!html) return ''

  // 检测并警告 base64 图片
  const base64ImgRegex = /<img[^>]+src=["']data:image[^>]+>/gi
  const base64Imgs = html.match(base64ImgRegex)
  if (base64Imgs && base64Imgs.length > 0) {
    logger.warn(`[富文本] 检测到 ${base64Imgs.length} 张 base64 图片，请使用编辑器上传功能`)
    // 可以在这里添加自动上传逻辑，但暂时只是警告
  }

  // 优化 HTML：移除多余空格，压缩标签
  let optimized = html
    .replace(/\s+/g, ' ') // 多个空格合并为一个
    .replace(/>\s+</g, '><') // 标签间空格移除
    .replace(/<!--[\s\S]*?-->/g, '') // 移除注释
    .replace(/class="[^"]*"/g, '') // 移除 class 属性
    .replace(/style="[^"]*"/g, '') // 移除 style 属性（保留必要样式）

  return optimized
}

// 读取经理登录信息（缺失或异常时抛出统一错误，由调用方提示并跳转登录页）
export const readManagerInfo = () => {
  try {
    const infoStr = localStorage.getItem('manager_info')
    if (!infoStr) {
      throw new Error('未找到经理登录信息')
    }
    const info = JSON.parse(infoStr)
    if (!info.id) {
      throw new Error('经理信息中缺少 ID')
    }
    return info
  } catch (e) {
    logger.error('获取经理信息失败:', e)
    throw new Error('登录信息已过期，请重新登录')
  }
}
