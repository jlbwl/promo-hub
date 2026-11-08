/**
 * 产品分类管理
 */
import { logger } from '@promo/shared/utils/logger'
import { ref, computed, onMounted } from 'vue'
import { get } from '@promo/shared/utils/request'
import type { ProductCategory } from '@promo/shared/types'

/** 用户端展示的归并分类键 */
export type CategoryGroupKey = 'all' | 'comprehensive' | 'personal' | 'limit3' | 'unlimit3' | 'third'

/** 归并分类组 */
export interface CategoryGroup {
  key: CategoryGroupKey
  name: string
  /** 该组包含的二级分类值，全部为空 */
  values: string[]
}

/** 归并分类组定义，顺序即展示顺序 */
const categoryGroupDefs: { key: CategoryGroupKey; name: string }[] = [
  { key: 'all', name: '全部' },
  { key: 'comprehensive', name: '综合' },
  { key: 'personal', name: '个养加挂' },
  { key: 'limit3', name: '限三' },
  { key: 'unlimit3', name: '不限三' },
  { key: 'third', name: '三方' },
]

/**
 * 按二级分类名称归入展示分组
 * 无法识别的分类统一归入「综合」
 */
export function resolveCategoryGroupKey(name: string): Exclude<CategoryGroupKey, 'all'> {
  const normalized = (name || '').trim()
  if (normalized.includes('不限三')) return 'unlimit3'
  if (normalized.includes('限三')) return 'limit3'
  if (normalized.includes('三方')) return 'third'
  if (normalized.includes('个养')) return 'personal'
  return 'comprehensive'
}

// 默认分类，作为降级方案
const defaultCategories = [
  { id: 'cat_1', name: '综合-立返', value: 'comprehensive-instant', sort: 1, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_2', name: '综合-数据', value: 'comprehensive-data', sort: 2, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_3', name: '个养和加挂', value: 'personal-insurance', sort: 3, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_4', name: '限三-立返', value: 'limit3-instant', sort: 4, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_5', name: '限三-数据', value: 'limit3-data', sort: 5, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_6', name: '不限三-立返', value: 'unlimit3-instant', sort: 6, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_7', name: '不限三-数据', value: 'unlimit3-data', sort: 7, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_8', name: '三方-立返', value: 'third-party-instant', sort: 8, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_9', name: '三方-数据', value: 'third-party-data', sort: 9, status: 'active' as const, createdAt: '', updatedAt: '' },
  { id: 'cat_10', name: '其它', value: 'other', sort: 10, status: 'active' as const, createdAt: '', updatedAt: '' }
]

// 分类数据
const categories = ref<ProductCategory[]>(defaultCategories)
// 加载状态
const loading = ref(false)

/**
 * 归并分类组：由接口返回的二级分类动态聚合，「全部」为前端固定项
 */
const categoryGroups = computed<CategoryGroup[]>(() => {
  const valuesByKey = new Map<CategoryGroupKey, string[]>([
    ['all', []],
    ['comprehensive', []],
    ['personal', []],
    ['limit3', []],
    ['unlimit3', []],
    ['third', []],
  ])

  categories.value.forEach((category) => {
    const key = resolveCategoryGroupKey(category.name)
    valuesByKey.get(key)?.push(category.value)
  })

  return categoryGroupDefs.map(({ key, name }) => ({
    key,
    name,
    values: valuesByKey.get(key) || [],
  }))
})

/**
 * 从 API 获取分类列表
 */
async function fetchCategories() {
  loading.value = true
  try {
    const res = await get<{ list: ProductCategory[] }>('/categories')
    if (res.data?.list) {
      categories.value = res.data.list
    }
  } catch (error) {
    logger.error('获取分类失败:', error)
    // 使用默认分类
  } finally {
    loading.value = false
  }
}

/**
 * 获取分类名称，优先使用快照名称
 */
function getCategoryName(categoryValue: string, categoryNameSnapshot?: string): string {
  if (categoryNameSnapshot) {
    return categoryNameSnapshot
  }
  const category = categories.value.find((c: ProductCategory) => c.value === categoryValue)
  return category?.name || ''
}

/**
 * 产品分类管理 composable
 */
export function useProductCategories() {
  onMounted(() => {
    if (categories.value.length === defaultCategories.length) {
      fetchCategories()
    }
  })

  return {
    categories,
    categoryGroups,
    loading,
    getCategoryName,
    fetchCategories
  }
}

export { categories, categoryGroups, defaultCategories }
