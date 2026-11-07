/**
 * 审计日志 detail 的结构化构造与敏感信息脱敏工具。
 * detail 统一存 JSON：{ summary, meta?, changes? }，前端按结构渲染，历史自由文本仍兼容。
 */

export interface AuditChangeInput {
  field: string
  label?: string
  from?: string | number | null
  to?: string | number | null
}

export interface AuditDetailInput {
  summary: string
  meta?: Record<string, string | number | null | undefined>
  changes?: AuditChangeInput[]
}

/** 手机号脱敏：11 位号码保留前 3 后 4，如 138****0000 */
export function maskPhone(phone?: string | null): string {
  const value = String(phone ?? '').trim()
  if (!value) return '-'
  return /^\d{11}$/.test(value) ? `${value.slice(0, 3)}****${value.slice(-4)}` : value
}

/** 历史日志可能存有完整手机号，导出等展示场景统一兜底脱敏（11 位号码保留前 3 后 4） */
export function maskPhonesInText(text: string): string {
  return text.replace(/\b1[3-9]\d{9}\b/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`)
}

/**
 * 解析 detail 字段。
 * 兼容① ② 档的结构化 JSON（{ summary, meta?, changes? }）与历史自由文本：
 * - JSON 解析成功：返回 summary 与可读的变更摘要；
 * - 解析失败（历史自由文本）：整段文本作为 summary。
 */
export function parseAuditDetail(detail?: string | null): {
  summary: string
  changesText: string
  isJson: boolean
} {
  const raw = String(detail ?? '')
  if (!raw) return { summary: '', changesText: '', isJson: false }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { summary: raw, changesText: '', isJson: false }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { summary: raw, changesText: '', isJson: false }
  }

  const obj = parsed as { summary?: unknown; changes?: unknown }
  const summary = typeof obj.summary === 'string' ? obj.summary : ''
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
  const changesText = Array.isArray(obj.changes)
    ? obj.changes
        .map((item, index) => {
          const entry = (item || {}) as { field?: unknown; label?: unknown; from?: unknown; to?: unknown }
          const label = String(entry.label ?? entry.field ?? `字段${index + 1}`)
          return `${label}：${formatValue(entry.from)} → ${formatValue(entry.to)}`
        })
        .join('；')
    : ''

  return { summary, changesText, isJson: true }
}

/**
 * 构造结构化 detail JSON。
 * 空值统一落为 '-'，避免前端展示空白；不写入任何密码、哈希等敏感字段。
 */
export function buildAuditDetail(input: AuditDetailInput): string {
  const payload: Record<string, unknown> = { summary: input.summary }

  if (input.meta) {
    payload.meta = input.meta
  }

  if (input.changes && input.changes.length > 0) {
    payload.changes = input.changes.map((change) => ({
      field: change.field,
      ...(change.label ? { label: change.label } : {}),
      from: change.from ?? '-',
      to: change.to ?? '-',
    }))
  }

  return JSON.stringify(payload)
}
