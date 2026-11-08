/** 单页最大条数，避免前端传入过大 pageSize 造成全表扫描与内存放大 */
export const MAX_PAGE_SIZE = 100

/** 最大页码，避免深分页 OFFSET 过大拖慢数据库（O7） */
export const MAX_PAGE = 1000

/** 解析页码，非法值回退到默认页，超过上限按上限截断 */
export function parsePage(value: unknown, fallback = 1): number {
  const page = parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(page) || page <= 0) return fallback
  return Math.min(page, MAX_PAGE)
}

/** 解析每页条数，非法值回退到默认值，超过上限按上限截断 */
export function parsePageSize(value: unknown, fallback = 10): number {
  const size = parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(size) || size < 1) return fallback
  return Math.min(size, MAX_PAGE_SIZE)
}
