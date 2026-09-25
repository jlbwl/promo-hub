/**
 * 统一日志工具
 *
 * - 开发环境：debug/info/warn/error 全部输出，便于调试
 * - 生产环境：debug 静默（消除调试语句的性能影响），info/warn/error 保留
 *   （API 端由 PM2 收集 stdout；前端保留关键错误便于排查）
 *
 * 各端禁止直接使用 console.*，统一从 '@promo/shared/utils/logger' 引入 logger
 */

type LoggerMethod = (...args: unknown[]) => void

const noop: LoggerMethod = () => {}

// 判断生产环境：Node 端读 process.env.NODE_ENV，浏览器端读 Vite 注入的 import.meta.env
const isProduction = (() => {
  const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process
  if (proc?.env?.NODE_ENV) {
    return proc.env.NODE_ENV === 'production'
  }
  return import.meta.env?.PROD === true
})()

/* eslint-disable no-console -- 本文件是 console 的统一封装出口 */
export const logger = {
  debug: (isProduction ? noop : console.debug.bind(console)) as LoggerMethod,
  info: console.info.bind(console) as LoggerMethod,
  warn: console.warn.bind(console) as LoggerMethod,
  error: console.error.bind(console) as LoggerMethod,
}
/* eslint-enable no-console */
