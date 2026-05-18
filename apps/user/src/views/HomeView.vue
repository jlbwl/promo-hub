<template>
  <div class="home-page">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <van-search
        v-model="searchKeyword"
        shape="round"
        placeholder="搜索产品"
        @search="handleSearch"
      />
    </div>

    <!-- 产品分类横向滚动 -->
    <CategoryList
      :categories="categories"
      :active-category="activeCategory"
      @select="selectCategory"
    />

    <!-- 产品列表 -->
    <div class="product-list">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadProducts"
      >
        <div class="product-grid">
          <ProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            :category-name="getCategoryName(product.category)"
            @click="goToDetail"
            @add-to-cart="addToCart"
          />
        </div>
      </van-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { get, post } from '@promo/shared/utils/request'
import { showToast } from 'vant'
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
const { categories, getCategoryName } = useProductCategories()

/**
 * 搜索关键词
 */
const searchKeyword = ref('')

/**
 * 当前激活的分类
 */
const activeCategory = ref(0)

/**
 * 产品列表数据
 */
const products = ref<any[]>([])

/**
 * 加载状态
 */
const loading = ref(false)
const finished = ref(false)

/**
 * 分页
 */
const page = ref(1)
const pageSize = 10

/**
 * 加载产品列表
 */
const loadProducts = async () => {
  try {
    const categoryValue = categories.find(c => c.id === activeCategory.value)?.value
    const res = await get<any>('/products', {
      page: page.value,
      pageSize,
      category: categoryValue || undefined,
    })
    const { list, total } = res.data
    if (list.length === 0 || products.value.length >= total) {
      finished.value = true
    } else {
      // 检查产品在购物车中的状态
      const newProducts = list.map((p: any) => ({
        ...p,
        cover: p.coverImage || '',
        inCart: p.inCart || false
      }))
      products.value.push(...newProducts)
      page.value++

      // 如果是第一页且有用户ID，检查购物车状态
      if (page.value === 2 && getUserId()) {
        await checkCartStatus()
      }
    }
  } catch (error) {
    console.error('[HomeView] 加载产品失败:', error)
    finished.value = true
  } finally {
    loading.value = false
  }
}

/**
 * 检查产品在购物车中的状态
 */
const checkCartStatus = async () => {
  const userId = getUserId()
  if (!userId) return

  try {
    const res = await get<any[]>('/cart', { userId })
    if (res.code === 0 && res.data) {
      const cartProductIds = res.data.map((item: any) => item.productId)
      products.value.forEach(p => {
        if (cartProductIds.includes(p.id)) {
          p.inCart = true
        }
      })
    }
  } catch (error) {
    console.error('[HomeView] 检查购物车状态失败:', error)
  }
}

/**
 * 选择分类
 */
const selectCategory = (categoryId: number) => {
  activeCategory.value = categoryId
  products.value = []
  finished.value = false
  page.value = 1
}

/**
 * 搜索产品
 */
const handleSearch = () => {
  products.value = []
  finished.value = false
  page.value = 1
}

/**
 * 跳转产品详情
 */
const goToDetail = (product: any) => {
  router.push(`/product/${product.id}`)
}

/**
 * 加入购物车
 */
const addToCart = async (product: any) => {
  const userId = getUserId()
  if (!userId) {
    showToast('请先登录')
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
    } else {
      showToast(res.message || '加入失败')
    }
  } catch (error: any) {
    console.error('[HomeView] 加入购物车失败:', error)
    showToast(error.message || '加入失败')
  }
}

/**
 * 组件挂载时初始化
 */
onMounted(() => {
  loadProducts()
})
</script>

<style scoped lang="scss">
.home-page {
  min-height: 100%;
  background-color: #f7f8fa;
}

.search-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #ffffff;

  :deep(.van-search) {
    padding: 8px 12px;
  }
}

.product-list {
  padding: 12px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
</style>
