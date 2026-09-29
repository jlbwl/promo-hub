import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Product } from '@promo/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = join(__dirname, '..', '..', 'data')

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 通用读写函数
export function readFileData<T>(filename: string): T[] {
  const filepath = join(DATA_DIR, `${filename}.json`)
  if (!fs.existsSync(filepath)) {
    return []
  }
  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(content) as T[]
  } catch {
    return []
  }
}

export function writeFileData(filename: string, data: unknown[]): void {
  const filepath = join(DATA_DIR, `${filename}.json`)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

// 模拟数据库查询（用于兼容原有代码）
export async function queryOne(sql: string, params?: unknown[]): Promise<Product | null> {
  // 简单实现：根据SQL判断查询类型
  if (sql.includes('products') && sql.includes('title')) {
    const products = readFileData<Product>('products')
    return products.find((p) => p.title === params?.[0]) || null
  }
  return null
}
