/**
 * Redis 缓存服务
 * 提供高性能的缓存功能，支持自动降级到内存缓存
 */
import { createClient, RedisClientType } from 'redis'
import logger from '../../utils/logger.js'

/**
 * Redis 配置接口
 */
export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  ttl: number
  prefix: string
}

/**
 * 缓存默认值
 */
const DEFAULT_CACHE_TTL = 300 // 5分钟
const DEFAULT_PREFIX = 'promo:'
/** O5：内存缓存定时清扫间隔（5 分钟） */
const MEMORY_CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/**
 * Redis缓存服务类
 */
export class CacheService {
  private client: RedisClientType | null = null
  private memoryCache: Map<string, { value: unknown; expiry: number }> = new Map()
  private isRedisConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private config: RedisConfig
  private cacheConfig: CacheConfig
  /** O5：内存缓存定时清扫器，避免过期键与登出黑名单常驻 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(redisConfig?: RedisConfig, cacheConfig?: Partial<CacheConfig>) {
    this.config = redisConfig || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    }

    this.cacheConfig = {
      ttl: cacheConfig?.ttl || DEFAULT_CACHE_TTL,
      prefix: cacheConfig?.prefix || DEFAULT_PREFIX
    }

    this.startCleanupTimer()
  }

  /**
   * O5：每 5 分钟清理一次过期键；unref 避免测试/脚本因定时器无法退出
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => {
      const removed = this.pruneMemoryCache()
      if (removed > 0) {
        logger.info('[Cache] 已清理过期内存缓存', { removed })
      }
    }, MEMORY_CLEANUP_INTERVAL_MS)
    this.cleanupTimer.unref?.()
  }

  /** 清理所有已过期的内存缓存键，返回清理数量 */
  pruneMemoryCache(): number {
    const now = Date.now()
    let removed = 0
    for (const [key, entry] of this.memoryCache) {
      if (entry.expiry <= now) {
        this.memoryCache.delete(key)
        removed += 1
      }
    }
    return removed
  }

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              return false
            }
            return Math.min(retries * 100, 3000)
          }
        },
        password: this.config.password,
        database: this.config.db
      })

      this.client.on('error', () => {
        this.isRedisConnected = false
      })

      this.client.on('connect', () => {
        this.isRedisConnected = true
        this.reconnectAttempts = 0
      })

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++
      })

      await this.client.connect()
      this.isRedisConnected = true
    } catch (error) {
      logger.warn('Redis connect failed', { error: (error as Error).message })
      this.isRedisConnected = false
    }
  }

  /**
   * 断开Redis连接
   */
  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    if (this.client) {
      await this.client.quit()
      this.client = null
      this.isRedisConnected = false
    }
  }

  /**
   * 生成缓存键
   */
  private buildKey(key: string): string {
    return `${this.cacheConfig.prefix}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key)

    if (this.isRedisConnected && this.client) {
      try {
        const value = await this.client.get(fullKey)
        if (value) {
          return JSON.parse(value) as T
        }
      } catch (error) {
        logger.warn('Redis get failed, falling back to memory', { key: fullKey, error: (error as Error).message })
      }
    }

    const memValue = this.memoryCache.get(fullKey)
    if (memValue) {
      if (memValue.expiry > Date.now()) {
        return memValue.value as T
      }
      this.memoryCache.delete(fullKey)
    }

    return null
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key)
    const expiryTime = ttl || this.cacheConfig.ttl
    const serialized = JSON.stringify(value)

    let storedInRedis = false
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.setEx(fullKey, expiryTime, serialized)
        storedInRedis = true
      } catch (error) {
        logger.warn('Redis set failed, using memory only', { key: fullKey, error: (error as Error).message })
      }
    }

    // O5：Redis 正常时不再镜像写内存，避免同一份数据双份常驻
    if (storedInRedis) {
      this.memoryCache.delete(fullKey)
      return
    }

    this.memoryCache.set(fullKey, {
      value,
      expiry: Date.now() + expiryTime * 1000
    })
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key)

    if (this.isRedisConnected && this.client) {
      try {
        await this.client.del(fullKey)
      } catch (error) {
        logger.warn('Redis delete failed', { key: fullKey, error: (error as Error).message })
      }
    }

    this.memoryCache.delete(fullKey)
  }

  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.buildKey(pattern)
    
    const matchesPattern = (key: string): boolean => {
      if (pattern.endsWith('*')) {
        const prefixPattern = pattern.slice(0, -1)
        const fullPrefix = this.buildKey(prefixPattern)
        return key.startsWith(fullPrefix)
      }
      return key.includes(fullPattern.replace(/\*/g, ''))
    }

    if (this.isRedisConnected && this.client) {
      try {
        // O6：用 SCAN 游标遍历替代 KEYS，避免大键空间阻塞 Redis 主线程
        let cursor = '0'
        do {
          const reply = await this.client.scan(cursor, { MATCH: fullPattern, COUNT: 100 })
          cursor = reply.cursor
          if (reply.keys.length > 0) {
            await this.client.del(reply.keys)
          }
        } while (cursor !== '0')
      } catch (error) {
        logger.warn('Redis scan/delete failed', { pattern: fullPattern, error: (error as Error).message })
      }
    }

    const allMemoryKeys = Array.from(this.memoryCache.keys())
    const keysToDelete: string[] = []
    for (const key of allMemoryKeys) {
      if (matchesPattern(key)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.memoryCache.delete(key))
  }

  async flush(): Promise<void> {
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.flushDb()
      } catch (error) {
        logger.warn('Redis flushDb failed', { error: (error as Error).message })
      }
    }

    this.memoryCache.clear()
  }

  /**
   * M22：对外暴露 Redis 连接状态，供鉴权层明确降级行为（而非静默退化为内存）
   */
  isRedisAvailable(): boolean {
    return this.isRedisConnected
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    redisConnected: boolean
    memoryCacheSize: number
    memoryCacheKeys: string[]
  } {
    // 安全：getStats 用于 /api/health 公开端点，只返回去重后的键类型前缀，
    // 避免泄漏 refresh_token 等敏感键名（完整键名含 JWT，可被用于刷新令牌劫持账号）
    return {
      redisConnected: this.isRedisConnected,
      memoryCacheSize: this.memoryCache.size,
      memoryCacheKeys: Array.from(
        new Set(
          Array.from(this.memoryCache.keys()).map(k =>
            k.replace(this.cacheConfig.prefix, '').split(':')[0]
          )
        )
      )
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isRedisConnected || !this.client) {
      return false
    }

    try {
      await this.client.ping()
      return true
    } catch (error) {
      logger.warn('Redis health check failed', { error: (error as Error).message })
      return false
    }
  }
}

// 缓存键常量
export const CacheKeys = {
  // 产品相关
  PRODUCT: 'product',
  PRODUCT_LIST: 'product:list',
  PRODUCT_DETAIL: (id: string) => `product:${id}`,

  // 用户相关
  USER: 'user',
  USER_PROFILE: (id: string) => `user:${id}`,

  // 经理相关
  MANAGER: 'manager',
  MANAGER_PROFILE: (id: string) => `manager:${id}`,

  // 订单相关
  ORDER: 'order',
  ORDER_LIST: 'order:list',

  // 统计相关
  STATS: 'stats',
  STATS_SUMMARY: (userId: string) => `stats:${userId}`,
}

// 缓存TTL配置（秒）
export const CacheTTL = {
  SHORT: 60,      // 1分钟 - 频繁变化的数据
  MEDIUM: 300,    // 5分钟 - 一般数据
  LONG: 1800,     // 30分钟 - 相对稳定的数据
  VERY_LONG: 3600 // 1小时 - 几乎不变的数据
}

let cacheServiceInstance: CacheService | null = null

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService()
  }
  return cacheServiceInstance
}

export async function initCacheService(): Promise<void> {
  const svc = getCacheService()
  await svc.connect()
}

export async function closeCacheService(): Promise<void> {
  if (cacheServiceInstance) {
    await cacheServiceInstance.disconnect()
    cacheServiceInstance = null
  }
}
