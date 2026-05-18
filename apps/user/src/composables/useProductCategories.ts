/**
 * 产品分类管理
 */
export const productCategories = [
  { id: 0, name: '全部', value: '' },
  { id: 1, name: '综合-立返', value: 'comprehensive-instant' },
  { id: 2, name: '综合-数据', value: 'comprehensive-data' },
  { id: 3, name: '个养和加挂', value: 'personal-insurance' },
  { id: 4, name: '限三-立返', value: 'limit3-instant' },
  { id: 5, name: '限三-数据', value: 'limit3-data' },
  { id: 6, name: '不限三-立返', value: 'unlimit3-instant' },
  { id: 7, name: '不限三-数据', value: 'unlimit3-data' },
  { id: 8, name: '三方-立返', value: 'third-party-instant' },
  { id: 9, name: '三方-数据', value: 'third-party-data' },
  { id: 10, name: '其它', value: 'other' }
]

/**
 * 产品分类管理 composable
 */
export function useProductCategories() {
  const getCategoryName = (categoryValue: string): string => {
    const category = productCategories.find(c => c.value === categoryValue)
    return category?.name || ''
  }

  return {
    categories: productCategories,
    getCategoryName
  }
}
