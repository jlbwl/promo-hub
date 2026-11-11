import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

// 与 ProductService 回归测试同款：按 'promo:' 前缀真实存取键的假缓存，
// 用于验证"清缓存是否会误删令牌类键"
const cacheMock = vi.hoisted(() => {
  const PREFIX = 'promo:'
  const store = new Map<string, unknown>()
  const full = (key: string) => `${PREFIX}${key}`

  return {
    store,
    seed: (key: string, value: unknown) => {
      store.set(full(key), value)
    },
    has: (key: string) => store.has(full(key)),
    get: vi.fn(async (key: string) => store.get(full(key)) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(full(key), value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(full(key))
    }),
    deletePattern: vi.fn(async (pattern: string) => {
      const prefix = full(pattern.replace(/\*$/, ''))
      for (const key of Array.from(store.keys())) {
        if (key.startsWith(prefix)) store.delete(key)
      }
    }),
    flush: vi.fn(async () => {
      store.clear()
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn(() => ({ redisConnected: false, memoryCacheSize: store.size, memoryCacheKeys: [] })),
    isRedisAvailable: vi.fn(() => false),
  }
})

vi.mock('../../services/cache/index.js', () => ({
  CacheService: class {},
  getCacheService: vi.fn(() => cacheMock),
  initCacheService: vi.fn().mockResolvedValue(undefined),
  closeCacheService: vi.fn().mockResolvedValue(undefined),
  CacheKeys: {
    PRODUCT: 'product',
    PRODUCT_LIST: 'product:list',
    PRODUCT_DETAIL: (id: string) => `product:${id}`
  },
  CacheTTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 1800
  }
}))

import { clearBusinessCache } from '../cache.controller.js'

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

function createMockRes() {
  const json = vi.fn()
  return { res: { json } as unknown as Response, json }
}

describe('cache.controller clearBusinessCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheMock.store.clear()
  })

  it('只清理产品域缓存，refresh token / 黑名单 / 管理员单设备令牌必须保留', async () => {
    cacheMock.seed('refresh_token:user-refresh', { id: 'u1', role: 'user' })
    cacheMock.seed('refresh_token_grace:user-grace', { id: 'u1' })
    cacheMock.seed('access_token_blacklist:revoked-jwt', '1')
    cacheMock.seed('admin_active_token:admin1', 'admin-refresh')
    cacheMock.seed('product:p1', { product: { id: 'p1' }, sales: 2 })
    cacheMock.seed('product:list:page1', [{ id: 'p1' }])

    const { res, json } = createMockRes()
    await clearBusinessCache({} as Request, res)

    // 对外响应语义保持不变
    expect(json).toHaveBeenCalledWith({ code: 0, message: '缓存已清空', data: null })
    // 核心回归：不允许走 flush()（其实现为 Redis FLUSHDB）
    expect(cacheMock.flush).not.toHaveBeenCalled()
    // 令牌键空间不受影响
    expect(cacheMock.has('refresh_token:user-refresh')).toBe(true)
    expect(cacheMock.has('refresh_token_grace:user-grace')).toBe(true)
    expect(cacheMock.has('access_token_blacklist:revoked-jwt')).toBe(true)
    expect(cacheMock.has('admin_active_token:admin1')).toBe(true)
    // 业务键被清理
    expect(cacheMock.deletePattern).toHaveBeenCalledWith('product:*')
    expect(cacheMock.has('product:p1')).toBe(false)
    expect(cacheMock.has('product:list:page1')).toBe(false)
  })

  it('清理失败时保持原有响应结构（HTTP 200 + code=500）', async () => {
    cacheMock.deletePattern.mockRejectedValueOnce(new Error('redis down'))

    const { res, json } = createMockRes()
    await clearBusinessCache({} as Request, res)

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 500, data: null, message: expect.stringContaining('清空缓存失败') })
    )
    expect(cacheMock.flush).not.toHaveBeenCalled()
  })
})
