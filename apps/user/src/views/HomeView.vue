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
    <div class="category-scroll">
      <div class="category-list">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{ active: activeCategory === category.id }"
          @click="selectCategory(category.id)"
        >
          <span class="category-name">{{ category.name }}</span>
        </div>
      </div>
    </div>

    <!-- 产品列表 -->
    <div class="product-list">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        finished-text="没有更多了"
        @load="loadProducts"
      >
        <div class="product-grid">
          <div
            v-for="product in products"
            :key="product.id"
            class="product-card"
            @click="goToDetail(product.id)"
          >
            <!-- 产品封面图 -->
            <div class="product-image">
              <van-image
                width="100%"
                height="160"
                fit="cover"
                :src="product.cover"
                lazy-load
              >
                <template #error>
                  <div class="image-error">
                    <van-icon name="photo-fail" size="32" />
                  </div>
                </template>
              </van-image>
              <!-- 分类标签 -->
              <div v-if="getCategoryName(product.category)" class="category-tag">
                {{ getCategoryName(product.category) }}
              </div>
            </div>
            <!-- 产品信息 -->
            <div class="product-info">
              <h3 class="product-title">{{ product.title }}</h3>
              <div class="product-bottom">
                <span class="product-price">¥{{ product.price }}</span>
                <span class="product-sales">已售 {{ product.sales }}</span>
              </div>
              <div class="product-actions">
                <van-button
                  size="small"
                  type="primary"
                  plain
                  round
                  :icon="product.inCart ? 'success' : 'shopping-cart-o'"
                  :disabled="product.inCart"
                  @click.stop="addToCart(product)"
                >
                  {{ product.inCart ? '已加入' : '加购' }}
                </van-button>
              </div>
            </div>
          </div>
        </div>
      </van-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { get, post } from '@promo/shared/utils/request'

// 路由实例
const router = useRouter()

// 搜索关键词
const searchKeyword = ref('')

// 当前激活的分类
const activeCategory = ref(0)

// 产品列表数据
const products = ref<any[]>([])

// 加载状态
const loading = ref(false)
const finished = ref(false)

// 分页
const page = ref(1)
const pageSize = 10

// 分类数据（id 对应 API 的 category value）
const categories = reactive([
  { id: 0, name: '全部', value: '' },
  { id: 1, name: '综合-立返', value: 'comprehensive-instant' },
  { id: 2, name: '综合-数据', value: 'comprehensive-data' },
  { id: 3, name: '个养和加挂', value: 'personal-insurance' },
  { id: 4, name: '限三-立返', value: 'limit3-instant' },
  { id: 5, name: '限三-数据', value: 'limit3-data' },
  { id: 6, name: '不限三-立返', value: 'no-limit3-instant' },
  { id: 7, name: '不限三-数据', value: 'no-limit3-data' },
  { id: 8, name: '三方-立返', value: 'third-party-instant' },
  { id: 9, name: '三方-数据', value: 'third-party-data' },
  { id: 10, name: '其它', value: 'other' }
])

// 根据 category value 获取分类名称
const getCategoryName = (categoryValue: string) => {
  return categories.find(c => c.value === categoryValue)?.name || ''
}

// 加载产品列表
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
      const userId = getUserId()
      const newProducts = list.map((p: any) => ({
        ...p,
        cover: p.coverImage || '',
        inCart: p.inCart || false
      }))
      products.value.push(...newProducts)
      page.value++

      // 如果是第一页且有用户ID，检查购物车状态
      if (page.value === 2 && userId) {
        await checkCartStatus()
      }
    }
  } catch (error) {
    console.error('加载产品失败:', error)
    finished.value = true
  } finally {
    loading.value = false
  }
}

// 检查产品在购物车中的状态
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
    console.error('检查购物车状态失败:', error)
  }
}

// 选择分类
const selectCategory = (categoryId: number) => {
  activeCategory.value = categoryId
  products.value = []
  finished.value = false
  page.value = 1
}

// 搜索产品
const handleSearch = () => {
  products.value = []
  finished.value = false
  page.value = 1
}

// 跳转产品详情
const goToDetail = (productId: string) => {
  router.push(`/product/${productId}`)
}

// 获取当前用户ID
const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 加入购物车
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
      showToast('已加入购物车')
      product.inCart = true
    } else {
      showToast(res.message || '加入失败')
    }
  } catch (error: any) {
    console.error('加入购物车失败:', error)
    showToast(error.message || '加入失败')
  }
}

// 显示提示
const showToast = (message: string) => {
  // @ts-ignore
  uni.showToast({
    title: message,
    icon: 'none',
    duration: 2000
  })
}
</script>

<style scoped lang="scss">
.home-page {
  min-height: 100%;
  background-color: #f7f8fa;
}

// 搜索栏
.search-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #ffffff;

  :deep(.van-search) {
    padding: 8px 12px;
  }
}

// 分类横向滚动
.category-scroll {
  background-color: #ffffff;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.category-list {
  display: flex;
  overflow-x: auto;
  padding: 0 12px;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-item {
  flex-shrink: 0;
  padding: 8px 16px;
  margin-right: 8px;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  background-color: #f5f5f5;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    color: #ffffff;
    background-color: #1989fa;
  }
}

// 产品列表
.product-list {
  padding: 12px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

// 产品卡片
.product-card {
  background-color: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.98);
  }
}

.product-image {
  position: relative;
  overflow: hidden;

  .image-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background-color: #f5f5f5;
    color: #ccc;
  }
}

.category-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #ffffff;
  background: linear-gradient(135deg, #1989fa, #4fc3f7);
}

.product-info {
  padding: 10px;
}

.product-title {
  font-size: 13px;
  font-weight: 400;
  color: #323233;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-price {
  font-size: 16px;
  font-weight: 600;
  color: #ee0a24;
}

.product-sales {
  font-size: 11px;
  color: #969799;
}

.product-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
