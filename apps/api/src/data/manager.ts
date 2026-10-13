
import { query, queryOne } from '../db.js'
import { columnExists } from './utils.js'
import type { Manager } from '@promo/shared'

// 写入参数：id 必填，其余字段可缺省；status/role 以普通字符串写入 DB
// （role 列在旧表结构中可能不存在）
type ManagerInput = Partial<Omit<Manager, 'status' | 'role'>> & {
  id: string
  status?: string
  role?: string
}

export async function readManagers(): Promise<Manager[]> {
  return (await query('SELECT * FROM managers ORDER BY createdAt DESC')) as Manager[]
}

export async function readManager(id: string): Promise<Manager | null> {
  return (await queryOne('SELECT * FROM managers WHERE id = ?', [id])) as Manager | null
}

// 列值构造辅助：columns 与 values 严格一一对应（排除 createdAt/updatedAt 这类 NOW() 列），
// role 列在尾部追加，保证列序 == 值序，杜绝 splice/push 错位写串列的事故
function buildManagerColumns(m: ManagerInput, hasRole: boolean): { columns: string[]; values: unknown[] } {
  const columns = ['username', 'password', 'name', 'phone', 'status', 'teamName']
  const values: unknown[] = [
    m.username || '',
    m.password || '',
    m.name || '',
    m.phone || '',
    m.status || 'active',
    m.teamName || '',
  ]
  if (hasRole) {
    columns.push('role')
    values.push(m.role || 'manager')
  }
  return { columns, values }
}

export async function writeManagers(managers: ManagerInput[]): Promise<void> {
  const hasRole = await columnExists('managers', 'role')

  for (const m of managers) {
    const { columns, values } = buildManagerColumns(m, hasRole)

    const existing = await queryOne('SELECT id FROM managers WHERE id = ?', [m.id])
    if (existing) {
      const sets = columns.map(c => `${c} = ?`)
      await query(`UPDATE managers SET ${sets.join(', ')}, updatedAt = NOW() WHERE id = ?`, [...values, m.id])
    } else {
      const cols = [...columns, 'id', 'createdAt']
      const vals = [...values, m.id]
      const placeholders = vals.map(() => '?')
      placeholders.push('NOW()')

      await query(`INSERT INTO managers (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, vals)
    }
  }
}

export async function insertManager(m: ManagerInput): Promise<void> {
  const hasRole = await columnExists('managers', 'role')

  const { columns, values } = buildManagerColumns(m, hasRole)
  const cols = [...columns, 'id', 'createdAt']
  const vals = [...values, m.id]
  const placeholders = vals.map(() => '?')
  placeholders.push('NOW()')

  await query(`INSERT INTO managers (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`, vals)
}

/**
 * managers 表允许动态 UPDATE 的字段白名单（防止任意 key 拼接进 SQL）。
 */
const MANAGER_MUTABLE_FIELDS = new Set(['name', 'phone', 'password', 'teamName', 'role', 'status'])

export async function updateManager(id: string, fields: object): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
    if (key === 'id' || !MANAGER_MUTABLE_FIELDS.has(key)) continue
    if (key === 'role' && !hasRole) continue
    sets.push(`${key} = ?`)
    values.push(val ?? '')
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE managers SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteManager(id: string): Promise<void> {
  await query('DELETE FROM managers WHERE id = ?', [id])
}
