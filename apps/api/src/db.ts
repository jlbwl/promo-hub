import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

const SLOW_QUERY_THRESHOLD = 1000
const isDev = process.env.NODE_ENV !== 'production'

const logger = {
  info: (msg: string, meta?: any) => {
    if (isDev) console.log(`[DB] ${msg}`, meta || '')
  },
  error: (msg: string, meta?: any) => console.error(`[DB ERROR] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[DB WARN] ${msg}`, meta || ''),
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 10000,
})

export async function query(sql: string, params?: any[]): Promise<any> {
  const startTime = Date.now()
  let timeoutId: ReturnType<typeof setTimeout>
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Query timeout after 20s')), 20000)
    })
    const queryPromise = pool.query(sql, params)
    const [rows] = await Promise.race([queryPromise, timeoutPromise]) as any
    const duration = Date.now() - startTime
    clearTimeout(timeoutId!)
    logger.info(`Query completed in ${duration}ms`, { sql: sql.substring(0, 100) })
    if (!isDev && duration >= SLOW_QUERY_THRESHOLD) {
      logger.warn(`Slow query: ${duration}ms`, { sql: sql.substring(0, 200) })
    }
    return rows
  } catch (error: any) {
    const duration = Date.now() - startTime
    clearTimeout(timeoutId!)
    logger.error(`Query failed after ${duration}ms`, { 
      sql: sql.substring(0, 100), 
      error: error.message,
      params 
    })
    throw error
  }
}

export async function queryOne(sql: string, params?: any[]): Promise<any> {
  const startTime = Date.now()
  let timeoutId: ReturnType<typeof setTimeout>
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Query timeout after 20s')), 20000)
    })
    const queryPromise = pool.query(sql, params)
    const [rows] = await Promise.race([queryPromise, timeoutPromise]) as any
    const duration = Date.now() - startTime
    clearTimeout(timeoutId!)
    logger.info(`QueryOne completed in ${duration}ms`, { sql: sql.substring(0, 100) })
    if (!isDev && duration >= SLOW_QUERY_THRESHOLD) {
      logger.warn(`Slow query (queryOne): ${duration}ms`, { sql: sql.substring(0, 200) })
    }
    return (rows as any[])[0] || null
  } catch (error: any) {
    const duration = Date.now() - startTime
    clearTimeout(timeoutId!)
    logger.error(`QueryOne failed after ${duration}ms`, { 
      sql: sql.substring(0, 100), 
      error: error.message,
      params 
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
