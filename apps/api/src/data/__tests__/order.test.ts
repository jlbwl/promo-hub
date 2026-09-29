import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 数据库连接层：data/order.ts 依赖 ../db.js 的 query/queryOne/withTransaction
vi.mock('../../db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}))

import { query, queryOne, withTransaction } from '../../db.js'
import {
  updateOrder,
  updateOrderIfStatus,
  applyOrderReview,
  deleteOrder,
  restoreOrder,
  purgeOrder,
  getOrderStats,
} from '../order.js'

const mockQuery = vi.mocked(query)
const mockQueryOne = vi.mocked(queryOne)
const mockWithTransaction = vi.mocked(withTransaction)

const lastSql = (): string => {
  const calls = mockQuery.mock.calls
  return String(calls[calls.length - 1]?.[0])
}

const lastParams = (): unknown[] => {
  const calls = mockQuery.mock.calls
  return (calls[calls.length - 1]?.[1] as unknown[]) ?? []
}

// 从 withTransaction 的回调参数类型中提取连接类型，避免显式 any
type Conn = Parameters<Parameters<typeof withTransaction>[0]>[0]

function setupTransaction(connResult: { affectedRows: number }[] = [{ affectedRows: 1 }]) {
  const conn = {
    query: vi.fn().mockResolvedValue(connResult),
    execute: vi.fn().mockResolvedValue([]),
  } as unknown as Conn & { query: ReturnType<typeof vi.fn> }
  mockWithTransaction.mockImplementation(async (fn) => fn(conn))
  return conn
}

describe('data/order.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ affectedRows: 1 })
  })

  describe('updateOrder 动态 UPDATE', () => {
    it('普通字段生成参数化 SET 子句，null 保持 null', async () => {
      await updateOrder('o_1', { status: 'approved', rejectReason: null })

      expect(lastSql()).toContain('UPDATE orders SET')
      expect(lastSql()).toContain('status = ?')
      expect(lastSql()).toContain('rejectReason = ?')
      expect(lastSql()).toContain('WHERE id = ?')
      expect(lastParams()).toEqual(['approved', null, 'o_1'])
    })

    it('id 字段被跳过，不允许更新主键', async () => {
      await updateOrder('o_1', { id: 'o_hacked', status: 'approved' })

      // SET 子句仅含 status，id 仅出现在 WHERE 子句；'o_hacked' 不得进入参数
      expect(lastSql()).toBe('UPDATE orders SET status = ? WHERE id = ?')
      expect(lastParams()).toEqual(['approved', 'o_1'])
    })

    it('空更新对象不执行 SQL', async () => {
      await updateOrder('o_1', {})

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('非白名单字段被过滤，不拼进 SQL', async () => {
      await updateOrder('o_1', {
        teamName: '新团队',
        password: 'leaked',
        isAdmin: true,
      })

      const sql = lastSql()
      expect(sql).toContain('teamName = ?')
      expect(sql).not.toContain('password')
      expect(sql).not.toContain('isAdmin')
      expect(lastParams()).toEqual(['新团队', 'o_1'])
    })
  })

  describe('updateOrderIfStatus 条件更新', () => {
    it('命中时生成 WHERE id = ? AND status = ? 并返回 true', async () => {
      mockQuery.mockResolvedValue({ affectedRows: 1 })

      const result = await updateOrderIfStatus(
        'o_1',
        { status: 'approved', reviewedAt: '2026-09-29 08:00:00' },
        'pending'
      )

      expect(result).toBe(true)
      expect(lastSql()).toContain('WHERE id = ? AND status = ?')
      // status 不进入普通 SET，作为目标状态参数在倒数第二位
      expect(lastParams()).toEqual(['2026-09-29 08:00:00', 'approved', 'o_1', 'pending'])
    })

    it('affectedRows 为 0（并发下已被处理）返回 false', async () => {
      mockQuery.mockResolvedValue({ affectedRows: 0 })

      const result = await updateOrderIfStatus('o_1', { status: 'approved' }, 'pending')

      expect(result).toBe(false)
    })

    it('查询结果异常时安全返回 false', async () => {
      mockQuery.mockResolvedValue(null)

      const result = await updateOrderIfStatus('o_1', { status: 'approved' }, 'pending')

      expect(result).toBe(false)
    })

    it('除 status 外无有效字段时不执行 SQL 并返回 false', async () => {
      const result = await updateOrderIfStatus('o_1', { status: 'approved' }, 'pending')

      expect(result).toBe(false)
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('仅含 id 与 status 时无有效 SET 字段，返回 false 且不执行 SQL', async () => {
      const result = await updateOrderIfStatus('o_1', { id: 'o_hacked', status: 'settled' }, 'approved')

      expect(result).toBe(false)
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  describe('applyOrderReview 事务审核', () => {
    it('条件更新命中时插入佣金并回补库存，返回 true', async () => {
      const conn = setupTransaction([{ affectedRows: 1 }])

      const result = await applyOrderReview(
        'o_1',
        { reviewedAt: '2026-09-29 08:00:00' },
        'pending',
        'approved',
        {
          id: 'c_1',
          orderId: 'o_1',
          userId: 'u_1',
          managerId: 'm_1',
          productName: '产品',
          amount: 50,
          status: 'pending',
        },
        'p_1'
      )

      expect(result).toBe(true)
      expect(mockWithTransaction).toHaveBeenCalledTimes(1)
      const sqls = conn.query.mock.calls.map(c => String(c[0]))
      expect(sqls[0]).toContain('UPDATE orders SET status = ?')
      expect(sqls[0]).toContain('WHERE id = ? AND status = ?')
      expect(sqls[1]).toContain('INSERT INTO commissions')
      expect(sqls[2]).toContain('stock = COALESCE(stock, 0) + 1')
    })

    it('条件更新未命中（并发已审核）返回 false 且不插入佣金、不回补库存', async () => {
      const conn = setupTransaction([{ affectedRows: 0 }])

      const result = await applyOrderReview(
        'o_1',
        { reviewedAt: '2026-09-29 08:00:00' },
        'pending',
        'approved',
        { id: 'c_1', orderId: 'o_1', amount: 50 },
        'p_1'
      )

      expect(result).toBe(false)
      expect(conn.query).toHaveBeenCalledTimes(1)
    })

    it('佣金字段缺省时使用默认值', async () => {
      const conn = setupTransaction([{ affectedRows: 1 }])

      await applyOrderReview('o_1', {}, 'pending', 'approved', { id: 'c_1', orderId: 'o_1' })

      const insertCall = conn.query.mock.calls[1]
      expect(String(insertCall[0])).toContain('INSERT INTO commissions')
      const values = insertCall[1] as unknown[]
      expect(values[2]).toBe('') // userId 缺省
      expect(values[3]).toBe('') // managerId 缺省
      expect(values[5]).toBe(0) // amount 缺省
      expect(values[6]).toBe('pending') // status 缺省
    })
  })

  describe('软删除/恢复/物理删除', () => {
    it('deleteOrder 软删除（deleted = 1）', async () => {
      await deleteOrder('o_1')

      expect(lastSql()).toContain('deleted = 1')
      expect(lastSql()).toContain('deletedAt = NOW()')
      expect(lastParams()).toEqual(['o_1'])
    })

    it('restoreOrder 恢复（deleted = 0）', async () => {
      await restoreOrder('o_1')

      expect(lastSql()).toContain('deleted = 0')
      expect(lastSql()).toContain('deletedAt = NULL')
    })

    it('purgeOrder 仅物理删除回收站中的订单（AND deleted = 1）', async () => {
      await purgeOrder('o_1')

      expect(lastSql()).toBe('DELETE FROM orders WHERE id = ? AND deleted = 1')
      expect(lastParams()).toEqual(['o_1'])
    })
  })

  describe('getOrderStats 统计聚合', () => {
    it('字符串数字转 Number、null 转 0', async () => {
      mockQueryOne.mockResolvedValue({
        total: '10',
        pending: '3',
        approved: '2',
        pendingPayment: null,
        settled: null,
        rejected: '1',
      })

      const stats = await getOrderStats()

      expect(stats).toEqual({
        total: 10,
        pending: 3,
        approved: 2,
        pendingPayment: 0,
        settled: 0,
        rejected: 1,
      })
    })

    it('传入 managerId 时附加过滤条件', async () => {
      mockQueryOne.mockResolvedValue(null)

      await getOrderStats('m_1')

      expect(mockQueryOne).toHaveBeenCalledTimes(1)
      const sql = String(mockQueryOne.mock.calls[0][0])
      expect(sql).toContain('managerId = ?')
      expect(mockQueryOne.mock.calls[0][1]).toEqual(['m_1'])
    })
  })
})
