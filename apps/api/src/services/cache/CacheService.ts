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

  /**
   * 初始化Redis连接
   */
  async connect(): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host: this.config.host,
          port: this.config.port,
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              console.warn('[Cache] Redis连接失败，切换到内存缓存模式')
              return false
            }
            return Math.min(retries * 100, 3000)
          }
        },
        password: this.config.password,
        database: this.config.db
      })

      this.client.on('error', (err) => {
        console.error('[Cache] Redis错误:', err.message)
        this.isRedisConnected = false
      })

      this.client.on('connect', () => {
        console.log('[Cache] Redis连接成功')
        this.isRedisConnected = true
        this.reconnectAttempts = 0
      })

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++
        console.log(`[Cache] Redis重连中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      })

      await this.client.connect()
      this.isRedisConnected = true
    } catch (error: any) {
      console.warn('[Cache] Redis初始化失败，将使用内存缓存:', error.message)
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

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key)

    // 优先使用Redis
    if (this.isRedisConnected && this.client) {
      try {
        const value = await this.client.get(fullKey)
        if (value) {
          console.log(`[Cache] Redis命中: ${key}`)
          return JSON.parse(value) as T
        }
      } catch (error: any) {
        console.error(`[Cache] Redis GET错误: ${error.message}`)
      }
    }

    // 降级到内存缓存
    const memValue = this.memoryCache.get(fullKey)
    if (memValue) {
      if (memValue.expiry > Date.now()) {
        console.log(`[Cache] Memory命中: ${key}`)
        return memValue.value as T
      }
      this.memoryCache.delete(fullKey)
    }

    console.log(`[Cache] 未命中: ${key}`)
    return null
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key)
    const expiryTime = ttl || this.cacheConfig.ttl
    const serialized = JSON.stringify(value)

    // 优先使用Redis
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.setEx(fullKey, expiryTime, serialized)
        console.log(`[Cache] Redis设置成功: ${key} (TTL: ${expiryTime}s)`)
      } catch (error: any) {
        console.error(`[Cache] Redis SET错误: ${error.message}`)
      }
    }

    // 同时设置内存缓存作为备份
    this.memoryCache.set(fullKey, {
      value,
      expiry: Date.now() + expiryTime * 1000
    })
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key)

    // 优先删除Redis缓存
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.del(fullKey)
        console.log(`[Cache] Redis删除: ${key}`)
      } catch (error: any) {
        console.error(`[Cache] Redis DEL错误: ${error.message}`)
      }
    }

    // 同时删除内存缓存
    this.memoryCache.delete(fullKey)
  }

  /**
   * 删除匹配的缓存（支持通配符）
   */
  async deletePattern(pattern: string): Promise<void> {
    console.log(`[Cache] 开始清除缓存，模式: ${pattern}`)
    const fullPattern = this.buildKey(pattern)
    
    // 简化匹配逻辑：支持前缀匹配（*在末尾）和包含匹配
    const matchesPattern = (key: string): boolean => {
      // 模式格式为 "xxx*" 的前缀匹配
      if (pattern.endsWith('*')) {
        const prefixPattern = pattern.slice(0, -1)
        const fullPrefix = this.buildKey(prefixPattern)
        return key.startsWith(fullPrefix)
      }
      // 简单的精确匹配或包含匹配
      return key.includes(fullPattern.replace(/\*/g, ''))
    }

    // 删除Redis缓存
    if (this.isRedisConnected && this.client) {
      try {
        const keys = await this.client.keys(fullPattern)
        if (keys.length > 0) {
          await this.client.del(keys)
          console.log(`[Cache] Redis批量删除: ${keys.length}个键，模式: ${fullPattern}`)
        }
      } catch (error: any) {
        console.error(`[Cache] Redis DEL模式错误: ${error.message}`)
      }
    }

    // 删除内存缓存 - 打印当前键以便调试
    console.log(`[Cache] 内存缓存当前键数: ${this.memoryCache.size}`)
    const allMemoryKeys = Array.from(this.memoryCache.keys())
    console.log(`[Cache] 内存缓存所有键:`, allMemoryKeys)
    
    const keysToDelete: string[] = []
    for (const key of allMemoryKeys) {
      if (matchesPattern(key)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.memoryCache.delete(key))
    if (keysToDelete.length > 0) {
      console.log(`[Cache] Memory批量删除: ${keysToDelete.length}个键`)
      console.log(`[Cache] 删除的键:`, keysToDelete)
    } else {
      console.log(`[Cache] Memory没有匹配到任何键，模式: ${pattern}`)
    }
  }

  /**
   * 清空所有缓存
   */
  async flush(): Promise<void> {
    if (this.isRedisConnected && this.client) {
      try {
        await this.client.flushDb()
        console.log('[Cache] Redis清空成功')
      } catch (error: any) {
        console.error(`[Cache] Redis FLUSH错误: ${error.message}`)
      }
    }

    this.memoryCache.clear()
    console.log('[Cache] 内存缓存已清空')
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
