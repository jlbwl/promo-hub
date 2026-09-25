
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

export async function writeUsers(users: UserRow[]): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  
  for (const u of users) {
    const existing = await queryOne('SELECT id FROM users WHERE id = ?', [u.id])
    if (existing) {
      let updateColumns = ['phone=?', 'password=?', 'nickname=?', 'teamName=?', 'status=?', 'alipayUserId=?', 'wechatOpenId=?', 'loginMethods=?', 'updatedAt=NOW()']
      let updateValues: string[] = [u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods), u.id]
      
      if (hasRole) {
        updateColumns.splice(updateColumns.length - 3, 0, 'role=?')
        updateValues.splice(updateValues.length - 1, 0, u.role || 'user')
      }
      
      try {
        await query(`UPDATE users SET ${updateColumns.join(', ')} WHERE id=?`, updateValues)
      } catch (e) {
        logger.error('[writeUsers] 更新用户失败', { userId: u.id, error: e })
        try {
          const safeUpdateColumns = updateColumns.filter(c => c !== 'loginMethods=?')
          const safeUpdateValues = updateValues.filter((_, i) => updateColumns[i] !== 'loginMethods=?')
          await query(`UPDATE users SET ${safeUpdateColumns.join(', ')} WHERE id=?`, safeUpdateValues)
        } catch (e2) {
          logger.error('[writeUsers] 安全更新也失败了', { userId: u.id, error: e2 })
          throw e2
        }
      }
    } else {
      let insertColumns = ['id', 'phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods', 'createdAt']
      let insertValues: string[] = [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
      let placeholders = insertValues.map(() => '?')
      placeholders.push('NOW()')
      
      if (hasRole) {
        insertColumns.splice(insertColumns.length - 2, 0, 'role')
        insertValues.push(u.role || 'user')
        placeholders.splice(placeholders.length - 1, 0, '?')
      }
      
      try {
        await query(`INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
      } catch (e) {
        logger.error('[writeUsers] 插入用户失败', { userId: u.id, error: e })
        try {
          const safeInsertColumns = insertColumns.filter(c => c !== 'loginMethods')
          const safeInsertValues = insertValues.filter((_, i) => insertColumns[i] !== 'loginMethods')
          safeInsertColumns.push('loginMethods')
          safeInsertValues.push(JSON.stringify(["sms"]))
          const safePlaceholders = safeInsertValues.map(() => '?')
          safePlaceholders[safePlaceholders.length - 1] = 'NOW()'
          
          await query(`INSERT INTO users (${safeInsertColumns.join(', ')}) VALUES (${safePlaceholders.join(', ')})`, safeInsertValues)
        } catch (e2) {
          logger.error('[writeUsers] 安全插入也失败了', { userId: u.id, error: e2 })
          throw e2
        }
      }
    }
  }
}

export async function insertUser(u: UserRow): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  
  let insertColumns = ['id', 'phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods', 'createdAt']
  let insertValues: string[] = [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
  let placeholders = insertValues.map(() => '?')
  placeholders.push('NOW()')
  
  if (hasRole) {
    insertColumns.splice(insertColumns.length - 2, 0, 'role')
    insertValues.push(u.role || 'user')
    placeholders.splice(placeholders.length - 1, 0, '?')
  }
  
  await query(`INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
}

export async function updateUser(id: string, fields: Record<string, unknown>): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    if (key === 'role' && !hasRole) continue
    // updatedAt 由下方 NOW() 统一管理，忽略调用方传入（防止 ISO 字符串写入 DATETIME 列报错）
    if (key === 'updatedAt') continue
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
