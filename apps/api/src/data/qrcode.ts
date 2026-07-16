
import { query, queryOne } from '../db.js'

export async function ensureQrCodesTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id VARCHAR(100) PRIMARY KEY,
        url VARCHAR(500) NOT NULL,
        data_url TEXT NOT NULL,
        center_text VARCHAR(50) DEFAULT '',
        top_text VARCHAR(50) DEFAULT '',
        is_default TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_url (url)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('[DB] qr_codes table created/verified')
  } catch (e) {
    console.warn('[DB] qr_codes table creation failed:', e)
  }
}

export async function readQrCodes(): Promise<any[]> {
  await ensureQrCodesTable()
  const rows = await query('SELECT * FROM qr_codes ORDER BY created_at DESC')
  return (rows as any[]).map(row => ({
    id: row.id,
    url: row.url,
    dataUrl: row.data_url,
    centerText: row.center_text || '',
    topText: row.top_text || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function readQrCodeById(id: string): Promise<any> {
  await ensureQrCodesTable()
  const row = await queryOne('SELECT * FROM qr_codes WHERE id = ?', [id])
  if (!row) return null
  return {
    id: row.id,
    url: row.url,
    dataUrl: row.data_url,
    centerText: row.center_text || '',
    topText: row.top_text || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function insertQrCode(qrCode: {
  id: string
  url: string
  dataUrl: string
  centerText?: string
  topText?: string
  isDefault?: boolean
}): Promise<void> {
  await ensureQrCodesTable()
  await query(
    `INSERT INTO qr_codes (id, url, data_url, center_text, top_text, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [qrCode.id, qrCode.url, qrCode.dataUrl, qrCode.centerText || '', qrCode.topText || '', qrCode.isDefault ? 1 : 0]
  )
}

export async function updateQrCode(id: string, fields: Record<string, any>): Promise<void> {
  await ensureQrCodesTable()
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    if (key === 'dataUrl') {
      sets.push('data_url = ?')
    } else if (key === 'centerText') {
      sets.push('center_text = ?')
    } else if (key === 'topText') {
      sets.push('top_text = ?')
    } else if (key === 'isDefault') {
      sets.push('is_default = ?')
      values.push(val ? 1 : 0)
      continue
    } else {
      sets.push(`${key} = ?`)
    }
    values.push(val ?? '')
  }
  if (sets.length === 0) return
  sets.push('updated_at = NOW()')
  values.push(id)
  await query(`UPDATE qr_codes SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteQrCode(id: string): Promise<void> {
  await ensureQrCodesTable()
  await query('DELETE FROM qr_codes WHERE id = ?', [id])
}

export async function setDefaultQrCode(id: string): Promise<void> {
  await ensureQrCodesTable()
  await query('UPDATE qr_codes SET is_default = 0')
  await query('UPDATE qr_codes SET is_default = 1 WHERE id = ?', [id])
}

export async function readDefaultQrCode(): Promise<any> {
  await ensureQrCodesTable()
  const row = await queryOne('SELECT * FROM qr_codes WHERE is_default = 1 LIMIT 1')
  if (!row) return null
  return {
    id: row.id,
    url: row.url,
    dataUrl: row.data_url,
    centerText: row.center_text || '',
    topText: row.top_text || '',
    isDefault: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
