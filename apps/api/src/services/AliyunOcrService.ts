/**
 * 阿里云 OCR 服务（读光 OCR）
 *
 * - 通用接口 RecognizeAllText（ocr-api，2021-07-07）：整页文字识别，返回按行分割的文本
 * - 海报识别前置处理：sharp 裁剪顶部区域（Logo 附近，默认上部 40%），只在该区域检索券商名称，
 *   避免底部免责条款等无关文字干扰
 * - 名称提取：与前端 posterRecognizer 相同的严格规则 —— 仅接受「名称 + 证券/期货」后缀片段，
 *   候选名称剔除「银行/开户」等噪声前缀；无命中返回空串，由调用方跳过该行
 * - 密钥来自环境变量：ALIYUN_OCR_ACCESS_KEY_ID / ALIYUN_OCR_ACCESS_KEY_SECRET
 */
import { Readable } from 'stream'
import sharp from 'sharp'
import * as ocrSdk from '@alicloud/ocr-api20210707'
import { Config } from '@alicloud/openapi-client'
import { info } from '../utils/logger.js'

/** OCR 识别类型：Advanced=全文识别高精版（默认），FullPage=通用整页文字识别 */
const DEFAULT_OCR_TYPE = 'Advanced'
const DEFAULT_ENDPOINT = 'ocr-api.cn-hangzhou.aliyuncs.com'
/** 海报顶部区域比例：只在 Logo 附近的上部区域检索券商名称 */
const POSTER_TOP_RATIO = 0.4
/** 上传阿里云的最大宽度（超大图等比缩小） */
const OCR_MAX_WIDTH = 2000

// ===== 券商名称提取（与前端 posterRecognizer 同一规则）=====

const FINANCE_SUFFIXES = ['证券', '期货'] as const
const NOISE_WORDS = [
  '银行', '开户', '存管', '免责', '条款', '声明', '热线', '客服', '电话',
  '投资', '风险', '入市', '谨慎', '建议', '扫码', '长按', '识别', '关注',
  '二维码', '下载', '官网', '网址', '福利', '活动', '专享', '服务'
]
const BROKER_NAME_MAX = 8

/** 剔除候选名称中的无关前缀（银行/开户等），取最后一个噪声词之后的段落 */
function trimNoisePrefix(name: string): string {
  let result = name
  for (;;) {
    let lastEnd = -1
    for (const word of NOISE_WORDS) {
      const idx = result.lastIndexOf(word)
      if (idx >= 0 && idx + word.length > lastEnd) lastEnd = idx + word.length
    }
    if (lastEnd < 0) break
    result = result.slice(lastEnd)
  }
  return result
}

/** 取 compact 中 end 位置之前的连续中文（≤8 字）作为候选名称，剔除噪声词后校验 */
function candidateNameBefore(compact: string, end: number): string {
  let start = end
  let count = 0
  while (start > 0 && count < BROKER_NAME_MAX) {
    const prev = compact[start - 1] ?? ''
    if (!/[\u4e00-\u9fa5]/.test(prev)) break
    start--
    count++
  }
  const prefix = compact.slice(start, end)
  if (prefix.length < 2) return ''
  const trimmed = trimNoisePrefix(prefix)
  return trimmed.length >= 2 ? trimmed : ''
}

/**
 * 从 OCR 文本行中提取「名称 + 证券/期货」金融公司名称（严格规则，逐行匹配）。
 * 行内空白去除、跨行不拼接；无命中返回空字符串。
 */
export function extractFinanceBrokerName(lines: string[]): string {
  for (const line of lines) {
    const compact = line.replace(/\s+/g, '')
    if (!compact) continue
    for (const suffix of FINANCE_SUFFIXES) {
      let from = 0
      for (;;) {
        const idx = compact.indexOf(suffix, from)
        if (idx < 0) break
        const name = candidateNameBefore(compact, idx)
        if (name) return name + suffix
        from = idx + suffix.length
      }
    }
  }
  return ''
}

// ===== 阿里云 OCR 客户端 =====

// SDK 为 CJS 包：Node ESM 下命名空间的 default 即 module.exports 本身，
// 真正的 Client 类位于 module.exports.default（经运行时实测确认的访问路径）
const OcrClient = ocrSdk.default.default
type OcrClientInstance = InstanceType<typeof OcrClient>

let cachedClient: OcrClientInstance | null = null
let cachedKey = ''

/** 是否已配置阿里云 OCR 密钥 */
export function isAliyunOcrConfigured(): boolean {
  return Boolean(process.env.ALIYUN_OCR_ACCESS_KEY_ID && process.env.ALIYUN_OCR_ACCESS_KEY_SECRET)
}

/** 按环境变量构建（并缓存）阿里云 OCR 客户端；未配置时抛错 */
function getAliyunOcrClient(): OcrClientInstance {
  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID ?? ''
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET ?? ''
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云 OCR 未配置：缺少 ALIYUN_OCR_ACCESS_KEY_ID / ALIYUN_OCR_ACCESS_KEY_SECRET')
  }
  const endpoint = process.env.ALIYUN_OCR_ENDPOINT || DEFAULT_ENDPOINT
  const key = `${accessKeyId}:${accessKeySecret}:${endpoint}`
  if (cachedClient && cachedKey === key) return cachedClient
  cachedClient = new OcrClient(new Config({ accessKeyId, accessKeySecret, endpoint }))
  cachedKey = key
  return cachedClient
}

/** 裁剪海报顶部区域（Logo 附近）用于 OCR：默认上部 40%，超大图等比缩到 ≤2000px */
export async function cropPosterTopForOcr(image: Buffer): Promise<Buffer> {
  const metadata = await sharp(image).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (!width || !height) return image
  const cropHeight = Math.min(height, Math.max(60, Math.round(height * POSTER_TOP_RATIO)))
  return sharp(image)
    .rotate() // 按 EXIF 自动摆正后再裁剪
    .extract({ left: 0, top: 0, width, height: cropHeight })
    .resize({ width: Math.min(OCR_MAX_WIDTH, width), withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer()
}

export interface PosterOcrTextResult {
  /** 整页识别原文（含换行） */
  text: string
  /** 按行拆分并去除空白行 */
  lines: string[]
}

/** 调用阿里云 OCR 识别图片文字，返回整页文本与行数组 */
export async function recognizePosterText(image: Buffer): Promise<PosterOcrTextResult> {
  const request = new ocrSdk.RecognizeAllTextRequest({
    type: process.env.ALIYUN_OCR_TYPE || DEFAULT_OCR_TYPE
  })
  // 图片二进制以请求体（流）上传
  request.body = Readable.from([image])

  const response = await getAliyunOcrClient().recognizeAllText(request)
  const text: string = response.body?.data?.content ?? ''
  const lines = text
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean)

  info('阿里云 OCR 识别完成', { lines: lines.length })
  return { text, lines }
}

export interface PosterOcrResult {
  /** 提取到的「名称 + 证券/期货」，未识别到为空串 */
  brokerName: string
  /** 顶部区域 OCR 文本行（供前端展示/排查） */
  lines: string[]
}

/** 海报券商识别完整流程：裁剪顶部 → 阿里云 OCR → 严格规则提取 */
export async function recognizePosterBrokerName(image: Buffer): Promise<PosterOcrResult> {
  const cropped = await cropPosterTopForOcr(image)
  const { lines } = await recognizePosterText(cropped)
  return { brokerName: extractFinanceBrokerName(lines), lines }
}
