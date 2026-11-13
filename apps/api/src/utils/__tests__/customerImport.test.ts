import { describe, it, expect } from 'vitest'
import {
  normalizePayMethod,
  normalizeImportRows,
  buildCustomerImportPlan,
  parseSearchCount,
} from '../customerImport.js'

describe('normalizePayMethod', () => {
  it('兼容中英文与常见别名', () => {
    expect(normalizePayMethod('支付宝')).toBe('alipay')
    expect(normalizePayMethod('alipay')).toBe('alipay')
    expect(normalizePayMethod('微信')).toBe('wechat')
    expect(normalizePayMethod('微信支付')).toBe('wechat')
    expect(normalizePayMethod('WeChat')).toBe('wechat')
    expect(normalizePayMethod('USDT')).toBe('usdt')
    expect(normalizePayMethod('usdt')).toBe('usdt')
  })

  it('空值按源项目默认值归一化为支付宝', () => {
    expect(normalizePayMethod('')).toBe('alipay')
    expect(normalizePayMethod(null)).toBe('alipay')
    expect(normalizePayMethod(undefined)).toBe('alipay')
  })

  it('无法识别的值返回 null', () => {
    expect(normalizePayMethod('银行卡')).toBeNull()
    expect(normalizePayMethod('paypal')).toBeNull()
  })
})

describe('parseSearchCount', () => {
  it('未提供时返回 null，保留库中原值', () => {
    expect(parseSearchCount(undefined)).toBeNull()
    expect(parseSearchCount('')).toBeNull()
  })

  it('支持数字字符串与千分位', () => {
    expect(parseSearchCount(12)).toBe(12)
    expect(parseSearchCount('1,234')).toBe(1234)
  })

  it('负数、小数与非法文本返回 undefined', () => {
    expect(parseSearchCount(-1)).toBeUndefined()
    expect(parseSearchCount('1.5')).toBeUndefined()
    expect(parseSearchCount('abc')).toBeUndefined()
  })
})

describe('normalizeImportRows', () => {
  it('必填字段缺失时按行号返回错误原因', () => {
    const result = normalizeImportRows([
      { rowNumber: 2, groupName: '', contactName: '张三' },
      { rowNumber: 3, groupName: '888', contactName: '' },
      { rowNumber: 4, groupName: '999', contactName: '李四', payMethod: '银行卡' },
    ])

    expect(result.rows).toHaveLength(0)
    expect(result.errors).toEqual([
      { rowNumber: 2, groupName: '', reason: '群号简称不能为空' },
      { rowNumber: 3, groupName: '888', reason: '对接人不能为空' },
      { rowNumber: 4, groupName: '999', reason: '无法识别的收款方式：银行卡（仅支持支付宝/微信/USDT）' },
    ])
  })

  it('使用次数非法时报错并给出行号', () => {
    const result = normalizeImportRows([
      { rowNumber: 7, groupName: '888', contactName: '张三', searchCount: '-3' },
    ])

    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]).toMatchObject({ rowNumber: 7, reason: '使用次数必须是非负整数：-3' })
  })

  it('整行空白忽略且不计入错误；缺省行号按表头第 1 行推算', () => {
    const result = normalizeImportRows([
      { groupName: '', contactName: '', payMethod: '', cardNo: '' },
      { groupName: '888', contactName: '张三' },
    ])

    expect(result.blankRows).toEqual([{ rowNumber: 2, groupName: '', reason: '空行已忽略' }])
    expect(result.errors).toHaveLength(0)
    expect(result.rows[0]).toMatchObject({ rowNumber: 3, groupName: '888', payMethod: 'alipay', searchCount: null })
  })

  it('文件内群号简称重复时保留最后一行，前一行记为跳过', () => {
    const result = normalizeImportRows([
      { rowNumber: 2, groupName: '888', contactName: '旧对接人' },
      { rowNumber: 5, groupName: '888', contactName: '新对接人' },
    ])

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ rowNumber: 5, contactName: '新对接人' })
    expect(result.duplicates).toEqual([
      { rowNumber: 2, groupName: '888', reason: '文件内群号简称重复，已采用第 5 行' },
    ])
  })
})

describe('buildCustomerImportPlan', () => {
  const existing = [
    { id: 'cust_1', groupName: '888', searchCount: 42 },
    { id: 'cust_2', groupName: '999', searchCount: 7 },
  ]

  const rows = [
    { rowNumber: 2, groupName: '888', contactName: '张三', payMethod: '微信', cardNo: '卡A', searchCount: 100 },
    { rowNumber: 3, groupName: '999', contactName: '李四', payMethod: 'USDT', cardNo: '卡B' },
    { rowNumber: 4, groupName: '777', contactName: '王五', payMethod: '支付宝', cardNo: '', searchCount: 5 },
  ]

  it('覆盖模式：命中已有群号则更新，未命中则新增', () => {
    const plan = buildCustomerImportPlan(rows, existing, 'overwrite')

    expect(plan.toUpdate.map((row) => row.id)).toEqual(['cust_1', 'cust_2'])
    expect(plan.toCreate.map((row) => row.groupName)).toEqual(['777'])
    expect(plan.skipped).toHaveLength(0)
    expect(plan.errors).toHaveLength(0)
  })

  it('覆盖模式：文件带使用次数采用文件值，未带则保留库中原值', () => {
    const plan = buildCustomerImportPlan(rows, existing, 'overwrite')

    const updated888 = plan.toUpdate.find((row) => row.groupName === '888')
    const updated999 = plan.toUpdate.find((row) => row.groupName === '999')
    expect(updated888?.effectiveSearchCount).toBe(100)
    expect(updated999?.effectiveSearchCount).toBe(7)
  })

  it('跳过模式：已存在的群号不更新、计入跳过，新客户仍新增', () => {
    const plan = buildCustomerImportPlan(rows, existing, 'skip')

    expect(plan.toUpdate).toHaveLength(0)
    expect(plan.toCreate.map((row) => row.groupName)).toEqual(['777'])
    expect(plan.skipped).toEqual([
      { rowNumber: 2, groupName: '888', reason: '库中已存在该群号简称，按跳过处理' },
      { rowNumber: 3, groupName: '999', reason: '库中已存在该群号简称，按跳过处理' },
    ])
  })

  it('错误行不影响其他合法行入库', () => {
    const plan = buildCustomerImportPlan(
      [...rows, { rowNumber: 5, groupName: '', contactName: '错误行' }],
      existing,
      'overwrite'
    )

    expect(plan.errors).toEqual([{ rowNumber: 5, groupName: '', reason: '群号简称不能为空' }])
    expect(plan.toCreate).toHaveLength(1)
    expect(plan.toUpdate).toHaveLength(2)
  })
})
