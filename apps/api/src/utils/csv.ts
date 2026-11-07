/**
 * CSV 输出工具：防公式注入 + RFC 4180 引号转义。
 * 导出文件统一使用 UTF-8 BOM，避免 Excel 打开中文乱码。
 */

/** UTF-8 BOM（Excel 识别编码用） */
export const UTF8_BOM = '\uFEFF'

/** Excel/WPS 会执行以这些字符开头的单元格，前置单引号阻断公式注入 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text
  // 始终用双引号包裹，内部双引号按 CSV 规范转义为两个双引号
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsvLine(cells: unknown[]): string {
  return `${cells.map(escapeCsvCell).join(',')}\r\n`
}
