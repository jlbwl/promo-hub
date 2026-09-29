import type { ProductCategory } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Product Categories (产品分类) ============

export async function readCategories(includeArchived = false): Promise<ProductCategory[]> {
  let categories = readFileData<ProductCategory>('categories')
  if (!includeArchived) {
    categories = categories.filter((c) => c.status === 'active')
  }
  categories.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  return categories
}

export async function readCategoryById(id: string): Promise<ProductCategory | null> {
  const categories = readFileData<ProductCategory>('categories')
  return categories.find((c) => c.id === id) || null
}

export async function createCategory(name: string, value: string, sort?: number): Promise<ProductCategory> {
  const categories = readFileData<ProductCategory>('categories')
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const category: ProductCategory = {
    id,
    name,
    value,
    sort: sort || 0,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  categories.push(category)
  writeFileData('categories', categories)
  return category
}

export async function updateCategory(id: string, data: Partial<{ name: string; sort: number; status: 'active' | 'archived' }>): Promise<ProductCategory | null> {
  const categories = readFileData<ProductCategory>('categories')
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) {
    return null
  }
  categories[index] = {
    ...categories[index],
    ...data,
    updatedAt: new Date().toISOString()
  }
  writeFileData('categories', categories)
  return categories[index]
}

export async function archiveCategory(id: string): Promise<boolean> {
  const categories = readFileData<ProductCategory>('categories')
  const index = categories.findIndex((c) => c.id === id)
  if (index === -1) {
    return false
  }
  categories[index] = {
    ...categories[index],
    status: 'archived',
    updatedAt: new Date().toISOString()
  }
  writeFileData('categories', categories)
  return true
}
