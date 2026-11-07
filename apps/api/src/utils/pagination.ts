/** 单页最大条数，避免前端传入过大 pageSize 造成全表扫描与内存放大 */
export const MAX_PAGE_SIZE = 100

/** 解析页码，非法值回退到默认页 */
export function parsePage(value: unknown, fallback = 1): number {
  const page = parseInt(String(value ?? ''), 10)
  return Number.isFinite(page) && page > 0 ? page : fallback
}

/** 解析每页条数，非法值回退到默认值，超过上限按上限截断 */
export function parsePageSize(value: unknown, fallback = 10): number {
  const size = parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(size) || size < 1) return fallback
  return Math.min(size, MAX_PAGE_SIZE)
}
