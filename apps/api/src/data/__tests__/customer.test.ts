import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}))

import { query, queryOne, withTransaction } from '../../db.js'
import {
  readCustomersPaged,
  readCustomersForExport,
  updateCustomer,
  applyCustomerImport,
  CUSTOMER_EXPORT_LIMIT,
} from '../customer.js'

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

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockResolvedValue([])
  mockQueryOne.mockResolvedValue({ count: 0 })
})

describe('readCustomersPaged', () => {
  it('按关键字/收款方式/状态过滤并分页，默认按使用次数倒序', async () => {
    mockQueryOne.mockResolvedValue({ count: 3 })
    mockQuery.mockResolvedValue([
      { id: 'cust_1', groupName: '888', contactName: '张三', payMethod: 'alipay', searchCount: '12' },
    ])

    const result = await readCustomersPaged({
      keyword: '88',
      payMethod: 'wechat',
      status: 'active',
      page: 2,
      pageSize: 10,
    })

    const countSql = String(mockQueryOne.mock.calls[0]?.[0])
    expect(countSql).toContain('WHERE')
    expect(countSql).toContain('groupName LIKE ?')
    expect(countSql).toContain('contactName LIKE ?')
    expect(countSql).toContain('cardNo LIKE ?')
    expect(countSql).toContain('payMethod = ?')
    expect(countSql).toContain('status = ?')
    expect(mockQueryOne.mock.calls[0]?.[1]).toEqual(['%88%', '%88%', '%88%', 'wechat', 'active'])

    expect(lastSql()).toContain('ORDER BY searchCount DESC')
    expect(lastParams()).toEqual(['%88%', '%88%', '%88%', 'wechat', 'active', 10, 10])
    expect(result.total).toBe(3)
    expect(result.list[0].searchCount).toBe(12)
  })

  it('pageSize 超过 100 时按上限 100 截断', async () => {
    await readCustomersPaged({ page: 1, pageSize: 500 })

    expect(lastParams()).toEqual([100, 0])
    expect(lastSql()).not.toContain('WHERE')
  })

  it('无筛选条件时不拼接 WHERE', async () => {
    await readCustomersPaged()

    expect(String(mockQueryOne.mock.calls[0]?.[0])).not.toContain('WHERE')
    expect(lastSql()).not.toContain('WHERE')
  })
})

describe('readCustomersForExport', () => {
  it('返回同一套筛选下的全量数据并标记截断', async () => {
    mockQueryOne.mockResolvedValue({ count: 12 })
    mockQuery.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `cust_${i}`,
        groupName: String(i),
        contactName: '张三',
        payMethod: 'alipay',
        searchCount: 0,
      }))
    )

    const result = await readCustomersForExport({ payMethod: 'alipay' })

    expect(lastParams()).toEqual(['alipay', CUSTOMER_EXPORT_LIMIT])
    expect(result.total).toBe(12)
    expect(result.truncated).toBe(true)
  })
})

describe('updateCustomer', () => {
  it('仅更新白名单字段并追加 updatedAt', async () => {
    await updateCustomer('cust_1', {
      groupName: '888',
      contactName: '张三',
      searchCount: '15',
      id: 'cust_hacked',
      createdAt: '2026-01-01',
    } as Record<string, unknown>)

    const sql = lastSql()
    expect(sql).toContain('groupName = ?')
    expect(sql).toContain('contactName = ?')
    expect(sql).toContain('updatedAt = NOW()')
    expect(sql).not.toContain('createdAt')
    // id 只能出现在 WHERE 子句，不能进入 SET
    expect(sql.split('WHERE')[0]).not.toContain('id = ?')
    expect(lastParams()).toEqual(['888', '张三', 15, 'cust_1'])
  })

  it('没有可更新字段时不执行 SQL', async () => {
    await updateCustomer('cust_1', { id: 'cust_hacked' } as Record<string, unknown>)

    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('applyCustomerImport', () => {
  // 从 withTransaction 的回调参数类型中提取连接类型，避免显式 any
  type Conn = Parameters<Parameters<typeof withTransaction>[0]>[0]

  it('在同一事务内先新增后覆盖更新，更新使用次数采用计划值', async () => {
    const execute = vi.fn().mockResolvedValue([])
    const conn = { execute } as unknown as Conn & { execute: ReturnType<typeof vi.fn> }
    mockWithTransaction.mockImplementation(async (fn) => fn(conn))

    await applyCustomerImport(
      {
        toCreate: [
          {
            groupName: '777',
            contactName: '王五',
            payMethod: 'alipay',
            cardNo: '',
            searchCount: 5,
            source: 'import',
          },
        ],
        toUpdate: [
          { id: 'cust_1', contactName: '张三', payMethod: 'wechat', cardNo: '卡A', searchCount: 42 },
        ],
      },
      'admin_1'
    )

    expect(mockWithTransaction).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(2)

    const insertSql = String(execute.mock.calls[0][0])
    expect(insertSql).toContain('INSERT INTO customers')
    const insertParams = execute.mock.calls[0][1] as unknown[]
    expect(insertParams).toContain('777')
    expect(insertParams).toContain('admin_1')
    expect(insertParams).toContain(5)

    const updateSql = String(execute.mock.calls[1][0])
    expect(updateSql).toContain('UPDATE customers')
    expect(execute.mock.calls[1][1]).toEqual(['张三', 'wechat', '卡A', 42, 'cust_1'])
  })
})
