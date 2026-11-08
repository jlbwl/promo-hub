import type { ProductCategory } from '@promo/shared/types'

/** 自动封面标记参数：coverImage 带 ?gen=<签名> 表示系统生成，可随标题/分类重绘 */
export const AUTO_COVER_SIGN_PARAM = 'gen'

export interface CoverTemplate {
  categoryValue: string
  categoryName: string
  /** 墨金渐变三段色（由分类稳定推导） */
  fromColor: string
  midColor: string
  toColor: string
  /** 右侧装饰图形编号 0-3 */
  ornament: number
}

/**
 * FNV-1a 32 位稳定哈希：同一分类每次生成的模板完全一致，
 * 且与分类列表的顺序、数量变化无关（不依赖写死的分类名列表）
 */
export const stableHash = (input: string): number => {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const toHsl = (hue: number, saturation: number, lightness: number): string =>
  `hsl(${hue}, ${saturation}%, ${lightness}%)`

/**
 * 单个分类的模板：配色与装饰只由分类自身的 value/id 决定
 */
export const buildCoverTemplate = (category: ProductCategory): CoverTemplate => {
  const hash = stableHash(category.value || category.id || category.name)
  const hue = hash % 360
  return {
    categoryValue: category.value,
    categoryName: category.name,
    fromColor: toHsl(hue, 16, 10),
    midColor: toHsl(hue + 8, 18, 20),
    toColor: toHsl(hue + 18, 20, 27),
    ornament: (hash >>> 8) % 4,
  }
}

/**
 * 按分类列表动态生成模板集合：模板数量恒等于分类数量，不写死套数
 */
export const buildCoverTemplates = (categories: ProductCategory[]): CoverTemplate[] =>
  categories.map((category) => buildCoverTemplate(category))

/** 标题与分类的签名，用于判断自动封面是否已与当前文案一致 */
export const coverSignature = (title: string, categoryValue: string): string =>
  stableHash(`${categoryValue}|${title}`).toString(16).padStart(8, '0')

/** 是否为系统自动生成的封面 */
export const isAutoCover = (url: string): boolean =>
  typeof url === 'string' && new RegExp(`[?&]${AUTO_COVER_SIGN_PARAM}=`).test(url)

export const getAutoCoverSignature = (url: string): string | null => {
  const matched = url.match(new RegExp(`[?&]${AUTO_COVER_SIGN_PARAM}=([0-9a-f]+)`))
  return matched ? matched[1] : null
}

/**
 * 给上传后的封面 URL 打上自动生成标记（只改 URL 查询参数，不新增数据库字段）
 */
export const markAutoCover = (url: string, signature: string): string => {
  const base = url
    .replace(new RegExp(`[?&]${AUTO_COVER_SIGN_PARAM}=[^&]*`, 'g'), '')
    .replace(/[?&]$/, '')
  return `${base}${base.includes('?') ? '&' : '?'}${AUTO_COVER_SIGN_PARAM}=${signature}`
}
