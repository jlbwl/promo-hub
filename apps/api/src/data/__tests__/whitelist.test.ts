import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 数据库连接层：data/*.ts 与 columnExists 均依赖 ../db.js
vi.mock('../../db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}))

import { query, queryOne } from '../../db.js'
import { updateUser } from '../user.js'
import { updateManager } from '../manager.js'
import { updateEmployee } from '../employee.js'
import { updateAdmin } from '../admin.js'
import { updateCommission } from '../commission.js'
import { updateQrCode } from '../qrcode.js'

const mockQuery = vi.mocked(query)
const mockQueryOne = vi.mocked(queryOne)

/**
 * 从每次调用生成的 SET 子句中提取字段名列表（按出现顺序）。
 * 形如 "UPDATE xxx SET a = ?, b = ?, updatedAt = NOW() WHERE id = ?"
 */
function extractSetFields(sql: string, table: string): string[] {
  const match = sql.match(new RegExp(`UPDATE ${table} SET (.+?) WHERE`))
  if (!match) return []
  return match[1]
    .split(',')
    .map(part => part.trim().split(' ')[0].replace(/=.*$/, '').trim())
}

// columnExists 通过 INFORMATION_SCHEMA 查询的 params [tableName, columnName] 控制：
// 统一让 role 列视为存在（user/manager 更新函数会探测该列）
function setupColumnExists() {
  mockQueryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes('INFORMATION_SCHEMA')) {
      return params?.[1] === 'role' ? { COLUMN_NAME: 'role' } : null
    }
    return null
  })
}

describe('data 层动态 UPDATE 字段白名单', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ affectedRows: 1 })
    setupColumnExists()
  })

  it('updateUser 仅允许白名单字段，role 列探测通过时正常更新', async () => {
    await updateUser('u_1', {
      teamName: '新团队',
      loginMethods: ['sms'],
      malicious: 'x',
      createdAt: '2026-01-01',
    })

    const fields = extractSetFields(String(mockQuery.mock.calls[0][0]), 'users')
    expect(fields).toContain('teamName')
    expect(fields).toContain('loginMethods')
    expect(fields).toContain('updatedAt')
    expect(fields).not.toContain('malicious')
    expect(fields).not.toContain('createdAt')
  })

  it('updateUser role 列不存在时跳过 role 字段', async () => {
    mockQueryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INFORMATION_SCHEMA')) return null
      return null
    })

    await updateUser('u_1', { role: 'admin', nickname: '昵称' })

    const fields = extractSetFields(String(mockQuery.mock.calls[0][0]), 'users')
    expect(fields).toContain('nickname')
    expect(fields).not.toContain('role')
  })

  it('updateManager 过滤整行 spread 传入的 id/createdAt/updatedAt', async () => {
    // manager.controller 更新经理时 spread 完整行 + status，白名单应过滤非业务列
    await updateManager('m_1', {
      id: 'm_1',
      name: '经理甲',
      phone: '13800000000',
      password: 'hash',
      teamName: '渠道A',
      role: 'manager',
      status: 'inactive',
      createdAt: '2025-01-01 00:00:00',
      updatedAt: '2026-01-01 00:00:00',
    })

    const fields = extractSetFields(String(mockQuery.mock.calls[0][0]), 'managers')
    expect(fields).toEqual(
      expect.arrayContaining(['name', 'phone', 'password', 'teamName', 'role', 'status', 'updatedAt'])
    )
    expect(fields).not.toContain('id')
    expect(fields).not.toContain('createdAt')
    // updatedAt 只能是 NOW()，不允许调用方传入值
    const setClause = String(mockQuery.mock.calls[0][0]).match(/SET (.+?) WHERE/)![1]
    expect(setClause).toContain('updatedAt = NOW()')
    expect(setClause).not.toContain('updatedAt = ?')
  })

  it('updateEmployee 仅允许白名单字段（password/nickname/expiresAt）', async () => {
    await updateEmployee('e_1', {
      password: 'hashed',
      nickname: '小王',
      expiresAt: new Date(),
      role: 'hacker',
    })

    const fields = extractSetFields(String(mockQuery.mock.calls[0][0]), 'employees')
    expect(fields).toEqual(expect.arrayContaining(['password', 'nickname', 'expiresAt']))
    expect(fields).not.toContain('role')
  })

  it('updateAdmin 仅允许 phone/password/status', async () => {
    await updateAdmin('a_1', { password: 'newHash', nickname: 'hacker' })

    const fields = extractSetFields(String(mockQuery.mock.calls[0][0]), 'admins')
    expect(fields).toContain('password')
    expect(fields).not.toContain('nickname')
  })

  it('updateCommission 仅允许 status/paidAt，金额不允许事后修改', async () => {
    await updateCommission('c_1', {
      status: 'paid',
      paidAt: '2026-09-29 08:00:00',
      amount: 999999,
      userId: 'hacked',
    })

    const fields = extractSetFields(String(mockQuery.mock.calls[0][0]), 'commissions')
    expect(fields).toEqual(expect.arrayContaining(['status', 'paidAt']))
    expect(fields).not.toContain('amount')
    expect(fields).not.toContain('userId')
  })

  it('updateQrCode 仅允许白名单字段，驼峰 key 正确映射蛇形列', async () => {
    await updateQrCode('q_1', {
      url: 'https://example.com',
      dataUrl: 'data:image/png;base64,...',
      centerText: '标题',
      isDefault: true,
      hacked: 'x',
    })

    const sql = String(mockQuery.mock.calls.find(c => String(c[0]).startsWith('UPDATE qr_codes'))![0])
    expect(sql).toContain('data_url = ?')
    expect(sql).toContain('center_text = ?')
    expect(sql).toContain('is_default = ?')
    expect(sql).toContain('url = ?')
    expect(sql).not.toContain('hacked')
  })

  it('updateQrCode 仅传非白名单字段时不执行 UPDATE', async () => {
    await updateQrCode('q_1', { hacked: 'x' })

    expect(mockQuery.mock.calls.filter(c => String(c[0]).startsWith('UPDATE qr_codes'))).toHaveLength(0)
  })
})
