import type { Request, Response } from 'express'
import { readProduct } from '../data/product.js'
import { getErrorMessage } from '@promo/shared/utils/errors'
import logger from '../utils/logger.js'

/**
 * 分享落地页控制器
 *
 * 微信等 IM 抓取分享链接时读取页面 <title> / OG 标签生成卡片。
 * SPA 所有页面共用同一个 index.html，标题无法按产品区分；
 * 本接口按产品动态渲染带标题/封面/摘要的落地页，人类访客自动跳转到详情页。
 */

/** HTML 转义，防止产品标题/描述注入页面 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** sharerId 白名单校验（仅字母数字下划线连字符），非法时丢弃 */
function sanitizeSharerId(raw: string | undefined): string {
  if (!raw) return ''
  return /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : ''
}

/** 从富文本描述提取纯文本摘要 */
function toPlainText(html: string, maxLen = 42): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

interface SharePageOptions {
  title: string
  description: string
  imageUrl: string
  targetUrl: string
}

/** 渲染分享落地页 HTML（纯函数，便于单测） */
export function renderSharePage(opts: SharePageOptions): string {
  const { title, description, imageUrl, targetUrl } = opts
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : ''}
    <meta property="og:type" content="product" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(targetUrl)}" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
             display: flex; flex-direction: column; align-items: center; justify-content: center;
             min-height: 100vh; margin: 0; background: #f7f8fa; color: #323233; }
      .card { background: #fff; border-radius: 12px; padding: 24px; max-width: 320px;
              text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
      .card img { width: 100%; border-radius: 8px; }
      .card h1 { font-size: 16px; margin: 12px 0; }
      .card a { display: block; margin-top: 12px; padding: 10px 0; background: #ee0a24;
                color: #fff; border-radius: 20px; text-decoration: none; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="card">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" />` : ''}
      <h1>${escapeHtml(title)}</h1>
      <a href="${escapeHtml(targetUrl)}">立即打开</a>
    </div>
    <script>location.replace(${JSON.stringify(targetUrl)})</script>
  </body>
</html>`
}

/** 404 落地页（产品不存在或已下架） */
function renderNotFound(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>产品不存在</title></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#969799;">
    产品不存在或已下架
  </body>
</html>`
}

/**
 * GET /share/product/:id
 * 按产品输出分享落地页（带 OG 标签），并引导人类访客跳转详情页
 */
export const getProductSharePage = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const product = await readProduct(id)

    // 仅已发布产品可分享；草稿/已下架产品返回 404 落地页
    if (!product || product.status !== 'published') {
      res.status(404).type('html').send(renderNotFound())
      return
    }

    // 请求来源（Nginx 代理场景优先取转发头）
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https'
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || ''
    const origin = `${proto}://${host}`

    // 封面绝对地址
    const cover = product.coverImage || ''
    const imageUrl = cover.startsWith('http') ? cover : cover ? `${origin}${cover}` : ''

    // 跳转目标：详情页（保留分享归因参数）
    const sharerId = sanitizeSharerId(req.query.sharerId as string | undefined)
    const targetUrl = `${origin}/user/product/${encodeURIComponent(id)}?share=true${sharerId ? `&sharerId=${sharerId}` : ''}`

    res
      .status(200)
      .type('html')
      .set('Cache-Control', 'no-cache')
      .send(
        renderSharePage({
          title: product.title || '产品详情',
          description: toPlainText(product.description || '') || '点击查看产品详情',
          imageUrl,
          targetUrl,
        })
      )
  } catch (error) {
    logger.error(`[ShareController] 渲染分享落地页失败: ${getErrorMessage(error)}`)
    res.status(500).type('html').send(renderNotFound())
  }
}
