import { post } from '@promo/shared/utils/request'
import type { ProductCategory } from '@promo/shared/types'
import type { CoverTemplate } from './coverTemplate'
import { buildCoverTemplate } from './coverTemplate'

/** 与后端 /upload/cover 的封面规格保持一致 */
const COVER_WIDTH = 800
const COVER_HEIGHT = 400
const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
const TITLE_FONT_SIZES = [52, 44, 38, 32]
const MAX_TITLE_LINES = 3
/** 文本区：左侧留白，右侧给装饰图形留出空间，保证文字不进入价格/角标可视区 */
const TEXT_LEFT = 52
const TEXT_MAX_WIDTH = 420
const TEXT_COLOR = '#F7EBD8'
const GOLD_COLOR = '#D8B07A'

export interface CoverUploadResult {
  url: string
  width: number
  height: number
  size: number
}

const wrapTitle = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] => {
  const chars = Array.from(text)
  const lines: string[] = []
  let current = ''
  let index = 0

  while (index < chars.length) {
    const next = current + chars[index]
    if (ctx.measureText(next).width > maxWidth) {
      if (!current) {
        // 单字超过文本区（极端窄场景）：仍单独成行，避免死循环
        current = chars[index]
        index += 1
      }
      lines.push(current)
      current = ''
      if (lines.length === maxLines) {
        let rest = chars.slice(index).join('')
        const last = lines[maxLines - 1]
        while (rest && ctx.measureText(`${last}${rest}…`).width > maxWidth) {
          rest = rest.slice(0, -1)
        }
        lines[maxLines - 1] = `${last}${rest}…`
        return lines
      }
    } else {
      current = next
      index += 1
    }
  }

  if (current) {
    lines.push(current)
  }
  return lines
}

const drawOrnaments = (ctx: CanvasRenderingContext2D, template: CoverTemplate) => {
  // 只作用于右侧装饰区，避免干扰左侧标题
  ctx.save()
  ctx.beginPath()
  ctx.rect(430, 0, COVER_WIDTH - 430, COVER_HEIGHT)
  ctx.clip()

  // 顶部右侧柔光，增加层次
  const glow = ctx.createRadialGradient(760, 0, 0, 760, 0, 420)
  glow.addColorStop(0, 'rgba(216, 176, 122, 0.16)')
  glow.addColorStop(1, 'rgba(216, 176, 122, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(430, 0, COVER_WIDTH - 430, COVER_HEIGHT)

  ctx.strokeStyle = 'rgba(247, 235, 216, 0.16)'
  ctx.fillStyle = 'rgba(247, 235, 216, 0.14)'

  if (template.ornament === 0) {
    // 同心圆
    ctx.lineWidth = 2
    for (let radius = 46; radius <= 230; radius += 46) {
      ctx.beginPath()
      ctx.arc(700, 200, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(700, 200, 18, 0, Math.PI * 2)
    ctx.fill()
  } else if (template.ornament === 1) {
    // 斜线
    ctx.lineWidth = 2
    for (let x = 380; x < COVER_WIDTH + 160; x += 26) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x - 140, COVER_HEIGHT)
      ctx.stroke()
    }
  } else if (template.ornament === 2) {
    // 左下偏移的弧线
    ctx.lineWidth = 3
    for (let radius = 120; radius <= 360; radius += 50) {
      ctx.beginPath()
      ctx.arc(860, 430, radius, Math.PI, 0)
      ctx.stroke()
    }
  } else {
    // 点阵
    for (let x = 460; x <= COVER_WIDTH - 20; x += 34) {
      for (let y = 26; y <= COVER_HEIGHT - 10; y += 34) {
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  ctx.restore()
}

const drawTitle = (ctx: CanvasRenderingContext2D, title: string) => {
  const text = (title || '未命名产品').replace(/\s+/g, ' ').trim()
  let fontSize = TITLE_FONT_SIZES[0]
  let lines: string[] = []

  for (const size of TITLE_FONT_SIZES) {
    fontSize = size
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    lines = wrapTitle(ctx, text, TEXT_MAX_WIDTH, MAX_TITLE_LINES)
    if (lines.length < MAX_TITLE_LINES || ctx.measureText(text).width <= TEXT_MAX_WIDTH) {
      break
    }
  }

  ctx.font = `700 ${fontSize}px ${FONT_FAMILY}`
  const lineHeight = fontSize * 1.24
  const startY = Math.max(96, (COVER_HEIGHT - lines.length * lineHeight) / 2)

  // 标题上方金色短线
  ctx.fillStyle = GOLD_COLOR
  ctx.fillRect(TEXT_LEFT, startY - 26, 36, 3)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = TEXT_COLOR
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 3
  lines.forEach((line, index) => {
    ctx.fillText(line, TEXT_LEFT, startY + index * lineHeight)
  })
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

const renderCoverBlob = (template: CoverTemplate, title: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = COVER_WIDTH
    canvas.height = COVER_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('当前环境不支持封面绘制'))
      return
    }

    const background = ctx.createLinearGradient(0, 0, COVER_WIDTH, COVER_HEIGHT)
    background.addColorStop(0, template.fromColor)
    background.addColorStop(0.6, template.midColor)
    background.addColorStop(1, template.toColor)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT)

    drawOrnaments(ctx, template)
    drawTitle(ctx, title)

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('封面生成失败'))
      }
    }, 'image/png')
  })

/**
 * 按分类模板生成本地 PNG，并复用现有封面上传接口保存
 */
export const generateAutoCover = async (
  title: string,
  category: ProductCategory
): Promise<CoverUploadResult> => {
  const blob = await renderCoverBlob(buildCoverTemplate(category), title)
  const fileName = `cover-${Date.now()}.png`
  const formData = new FormData()
  formData.append('cover', new File([blob], fileName, { type: 'image/png' }))

  const result = await post<CoverUploadResult>('/upload/cover', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (result.code !== 0 || !result.data) {
    throw new Error(result.message || '封面自动生成失败')
  }
  return result.data
}
