/**
 * 日志工具 - 统一的日志记录
 */
/* eslint-disable no-console -- 本文件是 console 的统一封装出口 */

import { maskPhone } from './phone.js'

// 日志级别
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// 日志格式
interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
}

/**
 * 格式化日志输出
 */
const formatLog = (entry: LogEntry): string => {
  let log = `[${entry.timestamp}] [${entry.level}] ${entry.message}`
  
  if (entry.meta && Object.keys(entry.meta).length > 0) {
    log += `\n  Meta: ${JSON.stringify(entry.meta, null, 2)}`
  }
  
  return log
}

/**
 * 获取当前时间戳
 */
const getTimestamp = (): string => {
  return new Date().toISOString()
}

/**
 * 记录日志
 */
const log = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  const entry: LogEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    meta,
  }

  const formatted = formatLog(entry)

  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted)
      break
    case LogLevel.WARN:
      console.warn(formatted)
      break
    case LogLevel.INFO:
      console.info(formatted)
      break
    case LogLevel.DEBUG:
      console.debug(formatted)
      break
  }
}

/**
 * 记录调试信息
 */
export const debug = (message: string, meta?: Record<string, unknown>): void => {
  log(LogLevel.DEBUG, message, meta)
}

/**
 * 记录一般信息
 */
export const info = (message: string, meta?: Record<string, unknown>): void => {
  log(LogLevel.INFO, message, meta)
}

/**
 * 记录警告
 */
export const warn = (message: string, meta?: Record<string, unknown>): void => {
  log(LogLevel.WARN, message, meta)
}

/**
 * 记录错误
 */
export const error = (message: string, meta?: Record<string, unknown>): void => {
  log(LogLevel.ERROR, message, meta)
}

/**
 * 手机号脱敏：保留前 3 位与后 4 位，日志中禁止出现完整号码
 * 实现见 utils/phone.ts，这里保留导出以兼容既有引用
 */
export { maskPhone }

/**
 * 日志中必须脱敏的查询参数：一次性验证码、令牌、密码等
 * 这些值一旦落日志，等于把凭据写进磁盘与日志采集系统
 */
const SENSITIVE_QUERY_KEYS = [
  'smscode',
  'sms_code',
  'code',
  'token',
  'accesstoken',
  'refreshtoken',
  'password',
  'secret',
]

/** 把 URL 查询串里的敏感参数值替换为 ***，保留参数名便于排查 */
export const redactUrlQuery = (url: string): string => {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return url

  const path = url.slice(0, queryIndex)
  const query = url.slice(queryIndex + 1)
  const redacted = query
    .split('&')
    .map(pair => {
      const equalsIndex = pair.indexOf('=')
      const rawKey = equalsIndex === -1 ? pair : pair.slice(0, equalsIndex)
      const decodedKey = decodeURIComponent(rawKey).toLowerCase()
      if (SENSITIVE_QUERY_KEYS.includes(decodedKey)) {
        return `${rawKey}=***`
      }
      return pair
    })
    .join('&')

  return `${path}?${redacted}`
}

/**
 * 记录 API 请求日志
 */
export const logRequest = (method: string, url: string, ip?: string, userId?: string): void => {
  info(`${method} ${redactUrlQuery(url)}`, { ip, userId })
}

/**
 * 记录 API 错误日志
 */
export const logError = (err: Error, method: string, url: string, ip?: string, userId?: string): void => {
  error(`API Error: ${method} ${redactUrlQuery(url)}`, {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    ip,
    userId,
  })
}

export default {
  debug,
  info,
  warn,
  error,
  maskPhone,
  redactUrlQuery,
  logRequest,
  logError,
}
