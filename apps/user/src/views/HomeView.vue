<template>
  <div class="home-page">
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
    >
      <!-- 深色主视觉：品牌位 / 页面标题 / 搜索 / 分类 -->
      <div class="home-mast">
        <div class="mast-inner">
          <div class="brand-row">
            <span class="brand">PRODUCT HALL</span>
            <span class="spacer" />
            <span class="mast-note">严选产品</span>
          </div>
          <div class="title-row">
            <h1>产品大厅</h1>
            <span class="cnt">
              共 <b>{{ totalCount }}</b> 款
            </span>
          </div>

          <!-- 顶部搜索栏 -->
          <van-search
            v-model="searchKeyword"
            class="mast-search"
            shape="round"
            placeholder="搜索产品"
            @search="handleSearch"
          />

          <!-- 产品分类横向滚动 -->
          <CategoryList
            :categories="displayCategories"
            :active-category="activeCategory"
            @select="selectCategory"
          />
          <!-- 分类加载失败：显式错误态与重试，不使用硬编码兜底分类 -->
          <div
            v-if="categoryError"
            class="category-error"
          >
            <span>分类加载失败</span>
            <button
              type="button"
              class="retry-link"
              @click="retryCategories"
            >
              重试
            </button>
          </div>
        </div>
      </div>

      <!-- 产品列表 -->
      <div class="product-list">
        <van-list
          v-model:loading="loading"
          :finished="finished"
          :finished-text="listError ? '' : '没有更多了'"
          @load="loadProducts"
        >
          <!-- 列表加载失败：独立错误态，避免与「没有更多了」空态混淆 -->
          <div
            v-if="listError && products.length === 0"
            class="list-error"
          >
            <p>产品加载失败</p>
            <van-button
              size="small"
              type="primary"
              plain
              @click="retryLoad"
            >
              重新加载
            </van-button>
          </div>
          <div class="product-grid">
            <ProductCard
              v-for="product in products"
              :key="product.id"
              :product="product"
              :category-name="getCategoryName(product.category, product.categoryNameSnapshot)"
              @click="goToDetail"
              @add-to-cart="addToCart"
            />
          </div>
        </van-list>
      </div>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { get, post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { CartItem, Product } from '@promo/shared/types'
import { showToast, showConfirmDialog } from 'vant'
import ProductCard from '../components/ProductCard.vue'
import CategoryList from '../components/CategoryList.vue'
import { useUser } from '../composables/useLocalStorage'
import { useProductCategories } from '../composables/useProductCategories'

/**
 * 路由实例
 */
const router = useRouter()

/**
 * 用户信息 composable
 */
const { getUserId } = useUser()

/**
 * 产品分类 composable
 */
const { categoryGroups, getCategoryName, fetchCategories, loadError: categoryError } = useProductCategories()

/**
 * 显示的分类：接口二级分类动态归并为六组，「全部」固定在前
 */
const displayCategories = computed(() =>
  categoryGroups.value.map(group => ({
    id: group.key,
    name: group.name,
    value: group.key,
  }))
)

/**
 * 搜索关键词
 */
const searchKeyword = ref('')

/**
 * 当前激活的分类
 */
const activeCategory = ref('all')

/**
 * 首页产品项（在 Product 基础上附加本地展示状态）
 */
type HomeProduct = Product & {
  cover?: string
  inCart?: boolean
}

/**
 * 产品列表数据
 */
const products = ref<HomeProduct[]>([])

/**
 * 产品总数（展示用，来自 /products 的 total）
 */
const totalCount = ref(0)

/**
 * 加载状态
 */
const loading = ref(false)
const finished = ref(false)

/**
 * 列表加载失败状态：用于呈现独立错误态，避免伪装成空列表
 */
const listError = ref(false)

/**
 * 下拉刷新状态
 */
const refreshing = ref(false)

/**
 * 请求序号：切换分类/搜索/下拉刷新时自增，用于丢弃过期响应
 */
let querySeq = 0

/**
 * 进行中的请求数量：分页追加时若有请求未完成则忽略，避免重复请求叠加
 */
let inFlightCount = 0

/**
 * 分页
 */
const page = ref(1)
const pageSize = 10

/**
 * 加载产品列表
 * @param replace 为 true 时整体替换列表（下拉刷新、切换分类/搜索）
 * @returns 请求是否成功（分页追加时若有请求进行中则跳过，避免重复请求）
 */
const loadProducts = async (replace = false): Promise<boolean> => {
  // 分页追加请求：已有请求未完成时忽略；首屏/刷新/切换查询需要覆盖旧结果，允许并发发起
  if (!replace && inFlightCount > 0) {
    return true
  }
  if (replace) {
    querySeq += 1
  }
  const seq = querySeq
  inFlightCount += 1
  try {
    const activeGroup = categoryGroups.value.find(group => group.key === activeCategory.value)
    const res = await get<{ list: HomeProduct[]; total: number }>('/products', {
      page: page.value,
      pageSize,
      categories: activeGroup && activeGroup.key !== 'all' ? activeGroup.values.join(',') : undefined,
      keyword: searchKeyword.value || undefined,
    })
    // 请求期间切换了分类/搜索或再次刷新，丢弃过期响应
    if (seq !== querySeq) {
      return true
    }
    listError.value = false
    const { list, total } = res.data
    totalCount.value = total
    // 检查产品在购物车中的状态
    const newProducts = list.map((p) => ({
      ...p,
      cover: p.coverImage || '',
      inCart: p.inCart || false
    }))

    if (replace) {
      // 下拉刷新：成功后整体替换列表，失败时由调用方保留原有数据
      products.value = newProducts
      page.value = 2
      finished.value = products.value.length >= total
      if (getUserId()) {
        await checkCartStatus()
      }
      return true
    }

    if (list.length === 0 || products.value.length >= total) {
      finished.value = true
    } else {
      products.value.push(...newProducts)
      page.value++

      // 如果是第一页且有用户ID，检查购物车状态
      if (page.value === 2 && getUserId()) {
        await checkCartStatus()
      }
    }
    return true
  } catch (error) {
    // 过期请求的失败不打扰用户
    if (seq !== querySeq) {
      return true
    }
    logger.error('[HomeView] 加载产品失败:', error)
    // 首屏/刷新且无任何数据时进入错误态，由用户主动重试
    if (products.value.length === 0) {
      listError.value = true
    }
    if (!replace) {
      finished.value = true
    }
    return false
  } finally {
    inFlightCount -= 1
    if (inFlightCount === 0) {
      loading.value = false
    }
  }
}

/**
 * 检查产品在购物车中的状态
 */
const checkCartStatus = async () => {
  const userId = getUserId()
  if (!userId) return

  try {
    const res = await get<CartItem[]>('/cart', { userId })
    if (res.code === 0 && res.data) {
      const cartProductIds = res.data.map((item) => item.productId)
      products.value.forEach(p => {
        if (cartProductIds.includes(p.id)) {
          p.inCart = true
        }
      })
    }
  } catch (error) {
    logger.error('[HomeView] 检查购物车状态失败:', error)
  }
}

/**
 * 重置分页并重新加载第一页（切换分类/搜索后使用）
 */
const reloadProducts = async () => {
  products.value = []
  page.value = 1
  finished.value = false
  listError.value = false
  await loadProducts(true)
}

/**
 * 列表错误态重试
 */
const retryLoad = () => reloadProducts()

/**
 * 分类加载失败重试：成功后重新加载当前筛选结果
 */
const retryCategories = async () => {
  const success = await fetchCategories()
  if (!success) {
    showToast('分类加载失败，请稍后重试')
    return
  }
  if (activeCategory.value !== 'all') {
    await reloadProducts()
  }
}

/**
 * 选择分类
 */
const selectCategory = (categoryId: string) => {
  if (categoryId === activeCategory.value) {
    return
  }
  // 分类未加载成功时切换分组只会得到空列表，提示先重试分类
  if (categoryError.value && categoryId !== 'all') {
    showToast('分类加载失败，请先点击重试')
    return
  }
  activeCategory.value = categoryId
  reloadProducts()
}

/**
 * 搜索产品
 */
const handleSearch = () => {
  reloadProducts()
}

/**
 * 跳转产品详情
 * 访客模式：不进入详情页，弹窗引导登录（做单业绩归属登录者）
 */
const goToDetail = (product: HomeProduct) => {
  const loggedIn = !!localStorage.getItem('user_token') || !!localStorage.getItem('employee_token')
  if (loggedIn) {
    router.push(`/product/${product.id}`)
    return
  }
  showConfirmDialog({
    title: '访客模式',
    message: '登录后做单或分享给兼职做单，业绩归属您',
    confirmButtonText: '去登录',
    cancelButtonText: '随便逛逛'
  })
    .then(() => {
      router.push('/login')
    })
    .catch(() => {})
}

/**
 * 加入购物车
 */
const addToCart = async (product: HomeProduct) => {
  const userId = getUserId()
  if (!userId) {
    const guestDialogOptions = {
      title: '提示',
      message: '访客模式不支持此功能，请登录后使用',
      confirmButtonText: '我知道了',
      teleport: 'body',
      safeAreaInsetBottom: true,
    }
    showConfirmDialog(guestDialogOptions)
    return
  }
  try {
    const res = await post('/cart', {
      userId,
      managerId: product.managerId || '',
      productId: product.id,
      productName: product.title || '',
      productPrice: product.price || 0,
      coverImage: product.coverImage || '',
      optionLabel: '',
      redirectUrl: ''
    })
    if (res.code === 0) {
      showToast('已收藏')
      product.inCart = true
      // 通知 Tabbar 刷新收藏徽标计数
      window.dispatchEvent(new CustomEvent('cart-changed'))
    } else {
      showToast(res.message || '加入失败')
    }
  } catch (error) {
    logger.error('[HomeView] 加入购物车失败:', error)
    showToast(getErrorMessage(error, '加入失败'))
  }
}

/**
 * 下拉刷新：重新请求第一页数据，失败时保留已展示的数据
 */
const onRefresh = async () => {
  const prevPage = page.value
  const prevFinished = finished.value
  page.value = 1
  // 产品列表与分类同时重新请求
  const [success] = await Promise.all([loadProducts(true), fetchCategories()])
  if (!success) {
    // 刷新失败：回退分页状态，保留当前列表，并给出可见提示
    page.value = prevPage
    finished.value = prevFinished
    showToast('刷新失败，请稍后重试')
  }
  refreshing.value = false
}
</script>

<style scoped lang="scss">
.home-page {
  min-height: 100%;
  background-color: var(--paper);
}

// 分类/列表加载失败态
.category-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
}

.retry-link {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--on-dark);
  text-decoration: underline;
}

.list-error {
  padding: 40px 16px;
  text-align: center;

  p {
    margin-bottom: 12px;
    font-size: 14px;
    color: var(--ink-2);
  }
}

// 深色主视觉
.home-mast {
  position: relative;
  overflow: hidden;
  padding: 10px 14px 14px;
  background: var(--mast);
  color: var(--on-dark);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      96deg,
      rgba(255, 235, 205, 0.045) 0 1px,
      transparent 1px 7px
    );
  }
}

.mast-inner {
  position: relative;
  z-index: 1;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;

  .brand {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: #d8b07a;
  }

  .spacer {
    flex: 1;
  }

  .mast-note {
    font-size: 10px;
    color: var(--on-dark-muted);
    letter-spacing: 0.08em;
  }
}

.title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8px;

  h1 {
    font-size: var(--fs-display);
    font-weight: 650;
    letter-spacing: 0.01em;
    color: var(--on-dark);
  }

  .cnt {
    padding-bottom: 3px;
    font-size: var(--fs-micro);
    color: var(--on-dark-muted);

    b {
      font-size: 11px;
      color: var(--tabbar-active);
    }
  }
}

.mast-search {
  padding: 10px 0 0 !important;
  background: transparent;

  :deep(.van-search__content) {
    height: 38px;
    align-items: center;
    background: rgba(255, 248, 236, 0.07);
    border: 1px solid var(--on-dark-line);
    border-radius: 10px;
  }

  :deep(.van-field__control) {
    font-size: 11.5px;
    color: var(--on-dark);
  }

  :deep(.van-field__control::placeholder) {
    color: rgba(247, 235, 216, 0.55);
  }

  :deep(.van-icon) {
    color: #c6ad8c;
  }
}

.product-list {
  padding: 12px 14px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 9px;
}
</style>
