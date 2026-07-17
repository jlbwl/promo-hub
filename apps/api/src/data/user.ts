
import { query, queryOne } from '../db.js'
import { serialize, deserialize, columnExists } from './utils.js'

export async function readUsers(): Promise<any[]> {
  const rows = await query('SELECT * FROM users ORDER BY createdAt DESC')
  return (rows as any[]).map(row => ({
    ...row,
    loginMethods: deserialize(row.loginMethods) || ['sms'],
  }))
}

export async function readUser(id: string): Promise<any> {
  const row = await queryOne('SELECT * FROM users WHERE id = ?', [id])
  if (!row) return null
  return { ...row, loginMethods: deserialize(row.loginMethods) || ['sms'] }
}

export async function writeUsers(users: any[]): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  
  for (const u of users) {
    const existing = await queryOne('SELECT id FROM users WHERE id = ?', [u.id])
    if (existing) {
      let updateColumns = ['phone=?', 'password=?', 'nickname=?', 'teamName=?', 'status=?', 'alipayUserId=?', 'wechatOpenId=?', 'loginMethods=?', 'updatedAt=NOW()']
      let updateValues = [u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods), u.id]
      
      if (hasRole) {
        updateColumns.splice(updateColumns.length - 3, 0, 'role=?')
        updateValues.splice(updateValues.length - 1, 0, u.role || 'user')
      }
      
      try {
        await query(`UPDATE users SET ${updateColumns.join(', ')} WHERE id=?`, updateValues)
      } catch (e) {
        console.error('[writeUsers] 更新用户失败', { userId: u.id, error: e })
        try {
          const safeUpdateColumns = updateColumns.filter(c => c !== 'loginMethods=?')
          const safeUpdateValues = updateValues.filter((_, i) => updateColumns[i] !== 'loginMethods=?')
          await query(`UPDATE users SET ${safeUpdateColumns.join(', ')} WHERE id=?`, safeUpdateValues)
        } catch (e2) {
          console.error('[writeUsers] 安全更新也失败了', { userId: u.id, error: e2 })
          throw e2
        }
      }
    } else {
      let insertColumns = ['id', 'phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods', 'createdAt']
      let insertValues = [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
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
        console.error('[writeUsers] 插入用户失败', { userId: u.id, error: e })
        try {
          const safeInsertColumns = insertColumns.filter(c => c !== 'loginMethods')
          const safeInsertValues = insertValues.filter((_, i) => insertColumns[i] !== 'loginMethods')
          safeInsertColumns.push('loginMethods')
          safeInsertValues.push(JSON.stringify(["sms"]))
          const safePlaceholders = safeInsertValues.map(() => '?')
          safePlaceholders[safePlaceholders.length - 1] = 'NOW()'
          
          await query(`INSERT INTO users (${safeInsertColumns.join(', ')}) VALUES (${safePlaceholders.join(', ')})`, safeInsertValues)
        } catch (e2) {
          console.error('[writeUsers] 安全插入也失败了', { userId: u.id, error: e2 })
          throw e2
        }
      }
    }
  }
}

export async function insertUser(u: any): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  
  let insertColumns = ['id', 'phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods', 'createdAt']
  let insertValues = [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
  let placeholders = insertValues.map(() => '?')
  placeholders.push('NOW()')
  
  if (hasRole) {
    insertColumns.splice(insertColumns.length - 2, 0, 'role')
    insertValues.push(u.role || 'user')
    placeholders.splice(placeholders.length - 1, 0, '?')
  }
  
  await query(`INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
}

export async function updateUser(id: string, fields: Record<string, any>): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
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
