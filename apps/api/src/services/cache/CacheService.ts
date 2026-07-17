/**
 * Redis 缓存服务
 * 提供高性能的缓存功能，支持自动降级到内存缓存
 */
import { createClient, RedisClientType } from 'redis'

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

/**
 * Redis缓存服务类
 */
export class CacheService {
  private client: RedisClientType | null = null
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map()
  private isRedisConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private config: RedisConfig
  private cacheConfig: CacheConfig

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
    } catch {
      this.isRedisConnected = false
    }
  }

  /**
   * 断开Redis连接
   */
  async disconnect(): Promise<void> {
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
      } catch {
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

    if (this.isRedisConnected && this.client) {
      try {
        await this.client.setEx(fullKey, expiryTime, serialized)
      } catch {
      }
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
      } catch {
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
        const keys = await this.client.keys(fullPattern)
        if (keys.length > 0) {
          await this.client.del(keys)
        }
      } catch {
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
      } catch {
      }
    }

    this.memoryCache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    redisConnected: boolean
    memoryCacheSize: number
    memoryCacheKeys: string[]
  } {
    return {
      redisConnected: this.isRedisConnected,
      memoryCacheSize: this.memoryCache.size,
      memoryCacheKeys: Array.from(this.memoryCache.keys()).map(k => k.replace(this.cacheConfig.prefix, ''))
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
    } catch {
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
  console.log('[Cache] 全局缓存服务初始化完成')
}

export async function closeCacheService(): Promise<void> {
  if (cacheServiceInstance) {
    await cacheServiceInstance.disconnect()
    cacheServiceInstance = null
  }
}
