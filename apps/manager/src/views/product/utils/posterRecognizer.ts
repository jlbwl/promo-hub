import { createWorker, type Worker } from 'tesseract.js'
import jsQR from 'jsqr'
import { logger } from '@promo/shared/utils/logger'

/**
 * 海报批量识别：二维码链接提取 + 顶部区域券商名称 OCR
 *
 * - 二维码：jsQR 多策略解码（全图缩放 / 原分辨率 / 四角与中心裁剪，含反色尝试），优先提取标准 http(s) URL
 * - 券商名：tesseract.js 中文 OCR 识别图片顶部区域（Logo 附近），提取「××证券」
 * - worker / wasm / 中文语言包均已自托管（public/tess、public/tessdata），不依赖外部 CDN
 */

export interface PosterRecognitionResult {
  /** OCR 提取的券商名称，如「首创证券」，识别失败为空字符串 */
  brokerName: string
  /** 二维码解码出的跳转链接，识别失败为空字符串 */
  redirectUrl: string
}

export type PosterProgressReporter = (percent: number, status: string) => void

// ===== 自托管资源路径（基于应用 base 路径，如 /manager/） =====
const BASE_URL = import.meta.env.BASE_URL
const TESS_WORKER_PATH = `${BASE_URL}tess/worker.min.js`
const TESS_CORE_PATH = `${BASE_URL}tess/core`
const TESS_LANG_PATH = `${BASE_URL}tessdata`

// 二维码解码时全图允许的最大边长（控制内存占用）
const QR_FULL_MAX_DIM = 2200
// 二维码解码时允许尝试的原分辨率上限（像素数）
const QR_FULL_MAX_PIXELS = 16_000_000
// OCR 顶部区域占海报高度的比例
const OCR_TOP_RATIO = 0.25

let workerPromise: Promise<Worker> | null = null
let progressReporter: PosterProgressReporter | null = null

const OCR_LOADING_STAGES: Record<string, string> = {
  'loading tesseract core': '加载识别引擎',
  'initializing tesseract': '初始化识别引擎',
  'loading language traineddata': '加载中文语言包',
  'initializing api': '初始化识别接口'
}

/** 获取（或创建）共享的 OCR Worker，多次识别复用，避免重复加载语言包 */
async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('chi_sim', 1, {
      workerPath: TESS_WORKER_PATH,
      corePath: TESS_CORE_PATH,
      langPath: TESS_LANG_PATH,
      logger: (m) => {
        if (m.status === 'recognizing text') {
          progressReporter?.(55 + Math.round(m.progress * 40), '识别券商名称')
        } else {
          const status = OCR_LOADING_STAGES[m.status]
          if (status) progressReporter?.(45 + Math.round(m.progress * 10), status)
        }
      }
    }).catch((err) => {
      // 失败后允许下次重试创建
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/** 加载本地图片文件为 HTMLImageElement（现代浏览器自动按 EXIF 方向解码） */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片解析失败，文件可能已损坏'))
    }
    img.src = url
  })
}

interface DrawRegion {
  sx: number
  sy: number
  sw: number
  sh: number
  targetW: number
}

/** 将图片指定区域绘制到画布并返回像素数据（纯色打底避免透明区域影响解码） */
function drawRegionToImageData(img: HTMLImageElement, region: DrawRegion): { canvas: HTMLCanvasElement; data: ImageData; width: number; height: number } | null {
  const { sx, sy, sw, sh, targetW } = region
  if (sw <= 0 || sh <= 0) return null
  const scale = targetW / sw
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))
  if (width * height > 40_000_000) return null

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  return { canvas, data: ctx.getImageData(0, 0, width, height), width, height }
}

/**
 * 多策略解码二维码：优先返回标准 http(s) URL，其次返回首个非空解码内容
 */
function decodeQrFromImage(img: HTMLImageElement): string {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return ''

  const maxDim = Math.max(w, h)
  const attempts: DrawRegion[] = []

  // 1. 全图（限制最大边长，兼顾速度与内存）
  const fullScale = Math.min(1, QR_FULL_MAX_DIM / maxDim)
  attempts.push({ sx: 0, sy: 0, sw: w, sh: h, targetW: Math.round(w * fullScale) })

  // 2. 原分辨率全图（缩放版未命中时，高分辨率更容易识别小尺寸码）
  if (maxDim > QR_FULL_MAX_DIM && w * h <= QR_FULL_MAX_PIXELS) {
    attempts.push({ sx: 0, sy: 0, sw: w, sh: h, targetW: w })
  }

  // 3. 四角 + 中心裁剪（海报二维码常位于角落或中部），裁剪区放大到有效分辨率
  const cw = w * 0.55
  const ch = h * 0.55
  const corners: Array<[number, number]> = [
    [0, 0],
    [w * 0.45, 0],
    [0, h * 0.45],
    [w * 0.45, h * 0.45],
    [w * 0.225, h * 0.225]
  ]
  const cropTargetW = Math.min(1400, Math.max(800, Math.round(cw)))
  for (const [sx, sy] of corners) {
    attempts.push({ sx, sy, sw: cw, sh: ch, targetW: cropTargetW })
  }

  let fallback = ''
  for (const region of attempts) {
    try {
      const drawn = drawRegionToImageData(img, region)
      if (!drawn) continue
      const code = jsQR(drawn.data.data, drawn.width, drawn.height, {
        inversionAttempts: 'attemptBoth'
      })
      if (code && code.data) {
        const text = code.data.trim()
        if (/^https?:\/\//i.test(text)) return text
        if (!fallback) fallback = text
      }
    } catch (error) {
      logger.error('二维码解码区域失败:', error)
    }
  }
  return fallback
}

/**
 * 从 OCR 文本中提取券商名称
 * 优先匹配「××证券」模式（自动去除 OCR 插入的空白），兜底取最长中文片段
 */
export function extractBrokerName(rawText: string): string {
  const compact = (rawText || '').replace(/\s+/g, '')
  if (!compact) return ''
  const brokerMatch = compact.match(/[\u4e00-\u9fa5]{2,8}证券/)
  if (brokerMatch) return brokerMatch[0]
  const segments = compact.match(/[\u4e00-\u9fa5]{3,10}/g) || []
  if (segments.length) {
    return segments.sort((a, b) => b.length - a.length)[0] ?? ''
  }
  return ''
}

/** 严格匹配「××证券」模式（识别结果必须包含「证券」二字才可信） */
function matchBrokerPattern(rawText: string): string {
  const compact = (rawText || '').replace(/\s+/g, '')
  return compact.match(/[\u4e00-\u9fa5]{2,8}证券/)?.[0] ?? ''
}

/**
 * 模糊纠错：中文券商名称均以「证券」结尾，OCR 常把「券」误识为形近字
 * （实测「首创证券」→「首创证劳/证刚/证芬」）。在整段文本不含「证券」时，
 * 将「××证Y」修正为「××证券」。
 */
function fuzzyBrokerName(rawText: string): string {
  const compact = (rawText || '').replace(/\s+/g, '')
  const m = compact.match(/([\u4e00-\u9fa5]{2,7})证./)
  return m ? `${m[1]}证券` : ''
}

/**
 * 二值化预处理（Otsu 阈值）：应对「彩底白字」的 Logo 横幅，
 * 自动判断前景/背景并把文字统一转为黑字白底，提升 OCR 识别率
 */
function binarizeCanvas(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const img = ctx.getImageData(0, 0, source.width, source.height)
  const px = img.data

  // 灰度直方图
  const hist = new Array(256).fill(0)
  const gray = new Uint8Array(px.length / 4)
  for (let i = 0, g = 0; i < px.length; i += 4, g++) {
    const v = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
    gray[g] = v
    hist[v]++
  }

  // Otsu 计算阈值
  const total = gray.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) {
      best = between
      threshold = t
    }
  }

  // 统计亮暗占比：亮色占多数 → 深色文字（正常输出）；暗色占多数 → 浅色文字（需反色为黑字白底）
  let bright = 0
  for (let g = 0; g < total; g++) if (gray[g] > threshold) bright++
  const textIsLight = bright / total <= 0.5

  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const outCtx = out.getContext('2d', { willReadFrequently: true })
  if (!outCtx) return null
  const outImg = outCtx.createImageData(source.width, source.height)
  const op = outImg.data
  for (let i = 0, g = 0; i < op.length; i += 4, g++) {
    const v = gray[g] > threshold ? 255 : 0
    const value = textIsLight ? 255 - v : v
    op[i] = op[i + 1] = op[i + 2] = value
    op[i + 3] = 255
  }
  outCtx.putImageData(outImg, 0, 0)
  return out
}

/** OCR 识别图片顶部区域（Logo 附近）的券商名称；首次失败后用二值化图重试 */
async function ocrBrokerName(img: HTMLImageElement, report: PosterProgressReporter): Promise<string> {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return ''

  const topH = Math.max(60, Math.round(h * OCR_TOP_RATIO))
  // 顶部区域放大到有效宽度，提高小字号 Logo 文字的识别率
  const targetW = Math.max(1000, Math.min(1600, w))
  const drawn = drawRegionToImageData(img, { sx: 0, sy: 0, sw: w, sh: topH, targetW })
  if (!drawn) return ''

  const worker = await getOcrWorker()
  progressReporter = report
  try {
    const firstText = (await worker.recognize(drawn.canvas)).data.text
    let name = matchBrokerPattern(firstText)
    if (name) return name

    // 兜底一：二值化（含反色）后重试，优先采纳包含「证券」的严格匹配
    const binarized = binarizeCanvas(drawn.canvas)
    let secondText = ''
    if (binarized) {
      secondText = (await worker.recognize(binarized)).data.text
      name = matchBrokerPattern(secondText)
      if (name) return name
    }

    // 兜底二：模糊纠错「××证Y」→「××证券」；最后退回最长中文片段
    return fuzzyBrokerName(secondText)
      || fuzzyBrokerName(firstText)
      || extractBrokerName(secondText)
      || extractBrokerName(firstText)
  } finally {
    progressReporter = null
  }
}

/**
 * 识别单张海报：二维码链接 + 顶部券商名称（两者独立识别，互不影响）
 */
export async function recognizePosterFile(
  file: File,
  onProgress?: PosterProgressReporter
): Promise<PosterRecognitionResult> {
  const report: PosterProgressReporter = (percent, status) => {
    try {
      onProgress?.(Math.min(100, Math.max(0, Math.round(percent))), status)
    } catch {
      // 进度回调异常不影响识别流程
    }
  }

  report(3, '解析图片')
  const img = await loadImageFromFile(file)

  report(12, '识别二维码')
  let redirectUrl = ''
  try {
    redirectUrl = decodeQrFromImage(img)
  } catch (error) {
    logger.error('二维码识别失败:', error)
  }

  const qrStageEnd = redirectUrl ? 40 : 45
  report(qrStageEnd, redirectUrl ? '识别券商名称' : '未识别到二维码，继续识别券商名称')

  let brokerName = ''
  try {
    brokerName = await ocrBrokerName(img, report)
  } catch (error) {
    logger.error('券商名称识别失败:', error)
  }

  report(100, '完成')
  return { brokerName, redirectUrl }
}
