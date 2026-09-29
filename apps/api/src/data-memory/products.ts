import type { Product } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Products ============

export async function readProducts(): Promise<Product[]> {
  return readFileData<Product>('products')
}

export async function writeProducts(products: Product[]): Promise<void> {
  writeFileData('products', products)
}

export async function readProduct(id: string): Promise<Product | null> {
  const products = await readProducts()
  return products.find((p) => p.id === id) || null
}

export async function insertProduct(p: Product): Promise<void> {
  const products = await readProducts()
  products.push(p)
  await writeProducts(products)
}

export async function updateProduct(id: string, fields: Record<string, unknown>): Promise<void> {
  const products = await readProducts()
  const index = products.findIndex((p) => p.id === id)
  if (index !== -1) {
    products[index] = { ...products[index], ...fields }
    await writeProducts(products)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await readProducts()
  const index = products.findIndex((p) => p.id === id)
  if (index !== -1) {
    products.splice(index, 1)
    await writeProducts(products)
  }
}
