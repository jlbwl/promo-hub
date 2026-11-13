/**
 * 客户数据导入回归：源项目「客户数据」导出文件（含 5 个额外汇总列）能被解析成有效行。
 * 复现线上「已解析 111 行」的场景：表头别名匹配、多余列忽略、111 行全部可新增。
 */
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { parseCustomerWorkbook } from '../utils'
import { buildCustomerImportPlan } from '../../../../../api/src/utils/customerImport'

/** 源项目 exportCustomerData 的列顺序 */
const CUSTOMER_DATA_HEADERS = [
  '群号简称',
  '对接人',
  '收款方式',
  '卡号/备注',
  '是否有收款码',
  '使用次数',
  '收单笔数',
  '推广费合计',
  '渠道价合计',
  '利润合计',
  '最近收单时间',
]

const ROW_COUNT = 111

async function buildCustomerDataFile(): Promise<File> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('客户数据')
  worksheet.addRow(CUSTOMER_DATA_HEADERS)
  for (let i = 1; i <= ROW_COUNT; i++) {
    worksheet.addRow([
      `群号${i}`,
      `对接人${i}`,
      i % 3 === 0 ? '微信' : i % 3 === 1 ? '支付宝' : 'USDT',
      `卡号${i}`,
      i % 2 === 0 ? '是' : '否',
      i,
      i * 2,
      10.5,
      8.5,
      2,
      '2026-11-13',
    ])
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer], '客户数据_2026-11-13 (1).xlsx')
}

describe('客户数据文件导入流程', () => {
  it('解析出 111 行，表头正确匹配且多余汇总列被忽略', async () => {
    const result = await parseCustomerWorkbook(await buildCustomerDataFile())

    expect(result.rows).toHaveLength(ROW_COUNT)
    expect(result.ignoredHeaders).toEqual(['收单笔数', '推广费合计', '渠道价合计', '利润合计', '最近收单时间'])
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      groupName: '群号1',
      contactName: '对接人1',
      payMethod: '支付宝',
      cardNo: '卡号1',
      searchCount: 1,
    })
  })

  it('111 行在库中不存在时全部可新增（预览 created=111）', async () => {
    const { rows } = await parseCustomerWorkbook(await buildCustomerDataFile())
    const plan = buildCustomerImportPlan(rows, [], 'overwrite')

    expect(plan.totalRows).toBe(ROW_COUNT)
    expect(plan.toCreate).toHaveLength(ROW_COUNT)
    expect(plan.errors).toHaveLength(0)
    expect(plan.skipped).toHaveLength(0)
  })
})
