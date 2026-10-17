
import logger from '../utils/logger.js'
import { query, queryOne } from '../db.js'
import { serialize, deserialize, columnExists } from './utils.js'

// users 表原始行结构：昵称列为 nickname（与 shared User 的 name 不同名），
// loginMethods 为 JSON 序列化字符串，role 列在旧表结构中可能不存在
export interface UserRow {
  id: string
  phone?: string
  password: string
  nickname?: string
  teamName?: string
  role?: string
  status?: string
  alipayUserId?: string
  wechatOpenId?: string
  loginMethods?: unknown
  createdAt?: string
  lastLoginAt?: string | null
  [key: string]: unknown
}

// 读取后的用户记录：loginMethods 已还原为字符串数组
// （用 interface extends 而非 Omit：UserRow 带索引签名，Omit 会丢失具名属性）
export interface UserRecord extends UserRow {
  loginMethods: string[]
}

export async function readUsers(): Promise<UserRecord[]> {
  const rows = (await query('SELECT * FROM users ORDER BY createdAt DESC')) as UserRow[]
  return rows.map(row => ({
    ...row,
    loginMethods: deserialize<string>(row.loginMethods) || ['sms'],
  }))
}

export async function readUsersPaged(params?: {
  role?: string
  status?: number
  keyword?: string
  teamName?: string
  page?: number
  pageSize?: number
}): Promise<{ list: UserRecord[]; total: number }> {
  let queryStr = 'SELECT * FROM users'
  const values: unknown[] = []
  const conditions: string[] = []

  if (params?.role) {
    conditions.push('role = ?')
    values.push(params.role)
  }
  if (params?.status !== undefined) {
    conditions.push('status = ?')
    values.push(params.status === 1 ? 'active' : 'disabled')
  }
  if (params?.keyword) {
    conditions.push('(nickname LIKE ? OR phone LIKE ? OR teamName LIKE ?)')
    const kw = `%${params.keyword}%`
    values.push(kw, kw, kw)
  }
  if (params?.teamName) {
    conditions.push('teamName LIKE ?')
    values.push(`%${params.teamName}%`)
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ')
  }

  queryStr += ' ORDER BY createdAt DESC'

  const countQuery = 'SELECT COUNT(1) as count FROM users' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '')
  const totalResult = (await queryOne(countQuery, [...values])) as { count: number } | null
  const totalCount = totalResult?.count || 0

  const pageNum = parseInt(String(params?.page || 1), 10)
  const pageSizeNum = parseInt(String(params?.pageSize || 10), 10)
  const offset = (pageNum - 1) * pageSizeNum

  const rows = (await query(queryStr + ' LIMIT ? OFFSET ?', [...values, pageSizeNum, offset])) as UserRow[]

  return {
    list: rows.map(row => ({
      ...row,
      loginMethods: deserialize<string>(row.loginMethods) || ['sms'],
    })),
    total: totalCount,
  }
}

export async function readUser(id: string): Promise<UserRecord | null> {
  const row = (await queryOne('SELECT * FROM users WHERE id = ?', [id])) as UserRow | null
  if (!row) return null
  return { ...row, loginMethods: deserialize<string>(row.loginMethods) || ['sms'] }
}

// 列值构造辅助：columns 与 values 严格一一对应（排除 createdAt/updatedAt 这类 NOW() 列），
// role 列在尾部追加，保证列序 == 值序，杜绝 splice/push 错位写串列的事故
function buildUserColumns(u: UserRow, hasRole: boolean): { columns: string[]; values: unknown[] } {
  const columns = ['phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods']
  const values: unknown[] = [
    u.phone || '',
    u.password || '',
    u.nickname || '',
    u.teamName || '',
    u.status || 'active',
    u.alipayUserId || '',
    u.wechatOpenId || '',
    serialize(u.loginMethods),
  ]
  if (hasRole) {
    columns.push('role')
    values.push(u.role || 'user')
  }
  return { columns, values }
}

export async function writeUsers(users: UserRow[]): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  const hasLoginMethods = await columnExists('users', 'loginMethods')

  for (const u of users) {
    const { columns, values } = buildUserColumns(u, hasRole)

    const existing = await queryOne('SELECT id FROM users WHERE id = ?', [u.id])
    if (existing) {
      const sets = columns.map(c => `${c} = ?`)
      if (!hasLoginMethods) {
        const idx = columns.indexOf('loginMethods')
        sets.splice(idx, 1)
        values.splice(idx, 1)
      }
      await query(`UPDATE users SET ${sets.join(', ')}, updatedAt = NOW() WHERE id = ?`, [...values, u.id])
    } else {
      const cols = [...columns, 'id', 'createdAt']
      const vals = [...values, u.id]
      const placeholders = vals.map(() => '?')
      placeholders.push('NOW()')

      try {
        await query(`INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, vals)
      } catch (e) {
        logger.error('[writeUsers] 插入用户失败', { userId: u.id, error: e })
        // 降级：去掉 loginMethods 列重试（旧表无此列）
        const li = cols.indexOf('loginMethods')
        const safeCols = cols.filter((_, i) => i !== li)
        const safeVals = vals.filter((_, i) => i !== li)
        const safePlaceholders = safeVals.map(() => '?')
        safePlaceholders.push('NOW()')
        await query(`INSERT INTO users (${safeCols.join(', ')}) VALUES (${safePlaceholders.join(', ')})`, safeVals)
      }
    }
  }
}

export async function insertUser(u: UserRow): Promise<void> {
  const hasRole = await columnExists('users', 'role')

  const { columns, values } = buildUserColumns(u, hasRole)
  const cols = [...columns, 'id', 'createdAt']
  const vals = [...values, u.id]
  const placeholders = vals.map(() => '?')
  placeholders.push('NOW()')

  await query(`INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, vals)
}

/**
 * users 表允许动态 UPDATE 的字段白名单（与 insertUser 列保持一致）。
 * 防止调用方意外传入任意 key 拼接进 SQL（mass assignment / SQL 注入纵深防御）。
 */
const USER_MUTABLE_FIELDS = new Set([
  'phone', 'password', 'nickname', 'teamName', 'status',
  'alipayUserId', 'wechatOpenId', 'loginMethods', 'role',
])

export async function updateUser(id: string, fields: object): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
    if (key === 'id' || key === 'updatedAt' || !USER_MUTABLE_FIELDS.has(key)) continue
    if (key === 'role' && !hasRole) continue
    sets.push(`${key} = ?`)
    if (key === 'loginMethods') {
      values.push(serialize(val))
    } else {
      values.push(val ?? '')
    }
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteUser(id: string): Promise<void> {
  await query('DELETE FROM users WHERE id = ?', [id])
}

/**
 * 记录用户最近登录时间：仅登录成功后调用，时间由数据库 NOW() 统一生成。
 * 独立于 updateUser 白名单，避免外部输入伪造登录时间；不更新 updatedAt（登录不算资料变更）。
 */
export async function touchUserLastLogin(id: string): Promise<void> {
  await query('UPDATE users SET lastLoginAt = NOW() WHERE id = ?', [id])
}
