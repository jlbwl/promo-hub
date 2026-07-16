
import { query, queryOne } from '../db.js'
import { columnExists } from './utils.js'

export async function readManagers(): Promise<any[]> {
  return await query('SELECT * FROM managers ORDER BY createdAt DESC')
}

export async function readManager(id: string): Promise<any> {
  return await queryOne('SELECT * FROM managers WHERE id = ?', [id])
}

export async function writeManagers(managers: any[]): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  
  for (const m of managers) {
    const existing = await queryOne('SELECT id FROM managers WHERE id = ?', [m.id])
    if (existing) {
      let updateColumns = ['username=?', 'password=?', 'name=?', 'phone=?', 'status=?', 'teamName=?', 'updatedAt=NOW()']
      let updateValues = [m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '', m.id]
      
      if (hasRole) {
        updateColumns.splice(updateColumns.length - 2, 0, 'role=?')
        updateValues.splice(updateValues.length - 1, 0, m.role || 'manager')
      }
      
      await query(`UPDATE managers SET ${updateColumns.join(', ')} WHERE id=?`, updateValues)
    } else {
      let insertColumns = ['id', 'username', 'password', 'name', 'phone', 'status', 'teamName', 'createdAt']
      let insertValues = [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '']
      let placeholders = insertValues.map(() => '?')
      placeholders.push('NOW()')
      
      if (hasRole) {
        insertColumns.splice(insertColumns.length - 1, 0, 'role')
        insertValues.push(m.role || 'manager')
        placeholders.splice(placeholders.length - 1, 0, '?')
      }
      
      await query(`INSERT INTO managers (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
    }
  }
}

export async function insertManager(m: any): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  
  let insertColumns = ['id', 'username', 'password', 'name', 'phone', 'status', 'teamName', 'createdAt']
  let insertValues = [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '']
  let placeholders = insertValues.map(() => '?')
  placeholders.push('NOW()')
  
  if (hasRole) {
    insertColumns.splice(insertColumns.length - 1, 0, 'role')
    insertValues.push(m.role || 'manager')
    placeholders.splice(placeholders.length - 1, 0, '?')
  }
  
  await query(`INSERT INTO managers (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
}

export async function updateManager(id: string, fields: Record<string, any>): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
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
