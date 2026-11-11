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

// 分类数据（不做硬编码兜底，加载失败时保持为空并暴露错误态）
const categories = ref<ProductCategory[]>([])
// 加载状态
const loading = ref(false)
// 加载失败状态：由页面呈现错误态并提供重试，禁止用假数据顶替
const loadError = ref(false)

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
 * @returns 是否加载成功
 */
async function fetchCategories(): Promise<boolean> {
  loading.value = true
  try {
    const res = await get<{ list: ProductCategory[] }>('/categories')
    if (res.data?.list) {
      categories.value = res.data.list
      loadError.value = false
      return true
    }
    loadError.value = true
    return false
  } catch (error) {
    logger.error('获取分类失败:', error)
    // 不注入任何默认分类，交由页面显示错误态并重试
    loadError.value = true
    return false
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
    // 已有数据不重复拉取；为空（含上次失败）时重试
    if (categories.value.length === 0) {
      fetchCategories()
    }
  })

  return {
    categories,
    categoryGroups,
    loading,
    loadError,
    getCategoryName,
    fetchCategories
  }
}

export { categories, categoryGroups, loadError }
