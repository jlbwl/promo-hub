import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
}))

vi.mock('../../data/index.js', () => ({
  readOperationLogs: vi.fn(),
}))

import { readOperationLogs } from '../../data/index.js'
import { exportOperationLogs } from '../operationLogExport.controller.js'

const makeReq = (query: Record<string, string> = {}): Request => ({ query }) as unknown as Request

const makeRes = () => {
  const chunks: string[] = []
  const headers: Record<string, string> = {}
  const status = vi.fn().mockReturnThis()
  const setHeader = vi.fn((key: string, value: string) => {
    headers[key] = value
  })
  const write = vi.fn((chunk: string) => {
    chunks.push(chunk)
    return true
  })
  const end = vi.fn()
  const json = vi.fn()
  const res = { status, setHeader, write, end, json } as unknown as Response
  return { res, chunks, headers, status, write, end, json }
}

describe('exportOperationLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('按筛选条件流式导出 CSV：兼容结构化 JSON 与历史文本，并做公式注入转义', async () => {
    vi.mocked(readOperationLogs).mockResolvedValue({
      total: 2,
      list: [
        {
          createdAt: '2026-11-06T02:00:00.000Z',
          adminName: '管理员A',
          adminPhone: '13800000000',
          operationType: 'update',
          targetType: 'user',
          targetId: 'u_1',
          targetName: '测试用户',
          reason: '',
          detail: JSON.stringify({
            summary: '修改用户状态',
            changes: [{ field: 'status', label: '状态', from: '启用', to: '禁用' }],
          }),
        },
        {
          createdAt: '2026-11-05T02:00:00.000Z',
          adminName: '管理员B',
          adminPhone: '13900000000',
          operationType: 'create',
          targetType: 'order',
          targetId: '=1+1',
          targetName: '=2+2',
          reason: '',
          detail: '历史自由文本详情',
        },
        {
          createdAt: '2026-11-04T02:00:00.000Z',
          adminName: '管理员C',
          adminPhone: '13700000000',
          operationType: 'create',
          targetType: 'order',
          targetId: '20261107000123456',
          targetName: '客户 13812345678',
          reason: '',
          detail: '历史详情：联系人 13612345678',
        },
      ],
    })

    const { res, chunks, headers, json, end } = makeRes()
    await exportOperationLogs(makeReq({ targetType: 'user', startTime: '2026-11-01' }), res)

    expect(vi.mocked(readOperationLogs).mock.calls[0][0]).toMatchObject({
      page: 1,
      pageSize: 100,
      targetType: 'user',
      startTime: '2026-11-01',
    })

    expect(headers['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(headers['Content-Disposition']).toContain('attachment; filename="operation-logs-')
    expect(chunks[0]).toBe('\uFEFF')

    const csv = chunks.join('')
    expect(csv).toContain('"操作时间","操作类型","目标类型","目标ID","目标名称","操作人","操作人手机号","操作原因","详情摘要","详情变更"')
    // ① ② 档结构化 JSON：summary 与 changes 均被展开
    expect(csv).toContain('修改用户状态')
    expect(csv).toContain('状态：启用 → 禁用')
    // 历史自由文本：整段作为摘要
    expect(csv).toContain('历史自由文本详情')
    // 以 = 开头的单元格前置单引号，阻断 Excel 公式注入
    expect(csv).toContain(`"'=1+1"`)
    expect(csv).toContain(`"'=2+2"`)
    // 操作人手机号、目标名称/详情中的手机号统一脱敏，原始号码不落盘
    expect(csv).toContain('"138****0000"')
    expect(csv).toContain('"137****0000"')
    expect(csv).toContain('"客户 138****5678"')
    expect(csv).toContain('136****5678')
    expect(csv).not.toContain('13800000000')
    expect(csv).not.toContain('13700000000')
    // 订单号（长数字串）沿用词边界 + 1[3-9] 规则，不被误脱敏
    expect(csv).toContain('"20261107000123456"')

    expect(end).toHaveBeenCalledTimes(1)
    expect(json).not.toHaveBeenCalled()
  })

  it('无数据时仍返回带 BOM 的表头，不报错', async () => {
    vi.mocked(readOperationLogs).mockResolvedValue({ total: 0, list: [] })

    const { res, chunks, json, end } = makeRes()
    await exportOperationLogs(makeReq(), res)

    expect(chunks[0]).toBe('\uFEFF')
    expect(chunks.join('')).toContain('"操作时间"')
    expect(end).toHaveBeenCalledTimes(1)
    expect(json).not.toHaveBeenCalled()
  })
})
