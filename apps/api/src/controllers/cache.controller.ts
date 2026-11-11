import type { Request, Response } from 'express'
import { getErrorMessage } from '@promo/shared'
import { getCacheService } from '../services/cache/index.js'
import logger from '../utils/logger.js'

/**
 * 缓存清理只允许清理业务前缀，禁止触碰令牌键空间：
 * refresh_token:* / refresh_token_grace:* / access_token_blacklist:* / admin_active_token:*
 *
 * 安全：历史上这里调用 CacheService.flush()，其底层是 Redis FLUSHDB，
 * 会连带删除上述令牌键 —— 导致全站被踢下线，且已登出的 access token
 * 在剩余有效期内复活。flush() 已从 CacheService 移除，此处只做前缀精准清理。
 */
const BUSINESS_CACHE_PATTERNS = ['product:*'] as const

/**
 * POST /cache/clear（管理员）
 * 保持原有响应结构与语义：成功 code=0，失败 HTTP 200 + code=500。
 */
export async function clearBusinessCache(_req: Request, res: Response): Promise<void> {
  try {
    const cacheService = getCacheService()
    for (const pattern of BUSINESS_CACHE_PATTERNS) {
      await cacheService.deletePattern(pattern)
    }
    logger.info('[缓存清理] 已按业务前缀清理缓存', { patterns: BUSINESS_CACHE_PATTERNS })
    res.json({ code: 0, message: '缓存已清空', data: null })
  } catch (error) {
    logger.error('[缓存清理] 清理失败', { error: getErrorMessage(error) })
    res.json({ code: 500, message: '清空缓存失败: ' + getErrorMessage(error), data: null })
  }
}
