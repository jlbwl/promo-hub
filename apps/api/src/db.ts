import mysql, { type RowDataPacket } from 'mysql2/promise'
import dotenv from 'dotenv'
import { getErrorMessage } from '@promo/shared'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import logger from './utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const SLOW_QUERY_THRESHOLD = 1000
const isDev = process.env.NODE_ENV !== 'production'
// M19：查询级超时（mysql2 触发后会销毁该连接，避免 Promise.race 只报错不释放连接）
const QUERY_TIMEOUT_MS = 20000
// M19：等待队列上限，超限直接快速失败，避免请求无限堆积
const POOL_QUEUE_LIMIT = 100

// DB 模块日志：常规查询日志仅开发环境输出（生产避免 SQL 日志刷盘），慢查询/错误始终输出
const dbLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (isDev) logger.debug(`[DB] ${msg}`, meta)
  },
  error: (msg: string, meta?: Record<string, unknown>) => logger.error(`[DB ERROR] ${msg}`, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => logger.warn(`[DB WARN] ${msg}`, meta),
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: POOL_QUEUE_LIMIT,
  charset: 'utf8mb4',
  connectTimeout: 10000,
})

export async function query(sql: string, params?: unknown[]): Promise<unknown> {
  const startTime = Date.now()
  try {
    // M19：用 mysql2 的查询级 timeout，超时即销毁连接并释放回池
    const [rows] = await pool.query({ sql, values: params ?? [], timeout: QUERY_TIMEOUT_MS })
    const duration = Date.now() - startTime
    dbLogger.info(`Query completed in ${duration}ms`, { sql: sql.substring(0, 100) })
    if (!isDev && duration >= SLOW_QUERY_THRESHOLD) {
      dbLogger.warn(`Slow query: ${duration}ms`, { sql: sql.substring(0, 200) })
    }
    return rows
  } catch (error) {
    const duration = Date.now() - startTime
    // M18：错误日志只记录 SQL 摘要与参数个数，避免手机号/资金号/密码哈希等落盘
    dbLogger.error(`Query failed after ${duration}ms`, {
      sql: sql.substring(0, 100),
      paramCount: params?.length ?? 0,
      error: getErrorMessage(error),
    })
    throw error
  }
}

// 泛型行查询：调用方通过类型参数声明期望的行结构；
// 未声明时返回 unknown，消费处需自行收窄（truthy 判断可直接用）
export async function queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const startTime = Date.now()
  try {
    const [rows] = await pool.query({ sql, values: params ?? [], timeout: QUERY_TIMEOUT_MS })
    const duration = Date.now() - startTime
    dbLogger.info(`QueryOne completed in ${duration}ms`, { sql: sql.substring(0, 100) })
    if (!isDev && duration >= SLOW_QUERY_THRESHOLD) {
      dbLogger.warn(`Slow query (queryOne): ${duration}ms`, { sql: sql.substring(0, 200) })
    }
    return ((rows as RowDataPacket[])[0] as unknown as T) || null
  } catch (error) {
    const duration = Date.now() - startTime
    dbLogger.error(`QueryOne failed after ${duration}ms`, {
      sql: sql.substring(0, 100),
      paramCount: params?.length ?? 0,
      error: getErrorMessage(error),
    })
    throw error
  }
}

export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export default pool
