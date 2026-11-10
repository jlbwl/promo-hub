/**
 * ConfigService - 统一配置管理服务
 * 管理应用配置，包括环境变量和默认配置
 */
import { injectable } from 'tsyringe'

export interface AppConfig {
  port: number
  nodeEnv: string
  jwtSecret: string
  dataDir: string
}

@injectable()
export class ConfigService {
  private config: AppConfig

  constructor() {
    this.config = this.loadConfig()
  }

  /**
   * 加载配置
   * 优先级：环境变量 > 默认值
   */
  private loadConfig(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      // SESSION_SECRET 已废弃，仅保留一个版本周期作为历史环境的回退来源
      jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET || this.generateFallbackSecret(),
      dataDir: process.env.DATA_DIR || '',
    }
  }

  /**
   * 生成临时备用密钥（仅用于开发）
   */
  private generateFallbackSecret(): string {
    return `fallback-secret-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * 获取完整配置
   */
  getConfig(): AppConfig {
    return { ...this.config }
  }

  /**
   * 获取单个配置值
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key]
  }

  /**
   * 判断是否为生产环境
   */
  isProduction(): boolean {
    return this.config.nodeEnv === 'production'
  }

  /**
   * 判断是否为开发环境
   */
  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development'
  }
}
