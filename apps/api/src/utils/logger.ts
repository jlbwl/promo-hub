/**
 * 日志工具 - 统一的日志记录
 */

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
  meta?: Record<string, any>
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
const log = (level: LogLevel, message: string, meta?: Record<string, any>): void => {
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
export const debug = (message: string, meta?: Record<string, any>): void => {
  log(LogLevel.DEBUG, message, meta)
}

/**
 * 记录一般信息
 */
export const info = (message: string, meta?: Record<string, any>): void => {
  log(LogLevel.INFO, message, meta)
}

/**
 * 记录警告
 */
export const warn = (message: string, meta?: Record<string, any>): void => {
  log(LogLevel.WARN, message, meta)
}

/**
 * 记录错误
 */
export const error = (message: string, meta?: Record<string, any>): void => {
  log(LogLevel.ERROR, message, meta)
}

/**
 * 记录 API 请求日志
 */
export const logRequest = (method: string, url: string, ip?: string, userId?: string): void => {
  info(`${method} ${url}`, { ip, userId })
}

/**
 * 记录 API 错误日志
 */
export const logError = (err: Error, method: string, url: string, ip?: string, userId?: string): void => {
  error(`API Error: ${method} ${url}`, {
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
  logRequest,
  logError,
}
