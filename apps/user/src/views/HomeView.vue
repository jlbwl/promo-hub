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
              <!-- 佣金标签 -->
              <div class="commission-tag">
                佣金 ¥{{ product.commission }}
              </div>
            </div>
            <!-- 产品信息 -->
            <div class="product-info">
              <h3 class="product-title">{{ product.title }}</h3>
              <div class="product-bottom">
                <span class="product-price">¥{{ product.price }}</span>
                <span class="product-sales">已售 {{ product.sales }}</span>
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

// 分类数据
const categories = reactive([
  { id: 0, name: '全部' },
  { id: 1, name: '数码电子' },
  { id: 2, name: '美妆护肤' },
  { id: 3, name: '食品饮料' },
  { id: 4, name: '家居生活' },
  { id: 5, name: '服饰鞋包' },
  { id: 6, name: '母婴用品' }
])

// 模拟产品数据
const mockProducts = [
  { id: 1, title: '无线蓝牙耳机 降噪运动防水', cover: '', price: '199.00', commission: '30.00', sales: '2.3万' },
  { id: 2, title: '保湿面膜套装 补水修护', cover: '', price: '89.00', commission: '15.00', sales: '5.1万' },
  { id: 3, title: '智能手表 多功能运动健康监测', cover: '', price: '399.00', commission: '60.00', sales: '1.2万' },
  { id: 4, title: '有机坚果礼盒 每日坚果混合装', cover: '', price: '69.00', commission: '10.00', sales: '8.6万' },
  { id: 5, title: '便携式充电宝 20000mAh大容量', cover: '', price: '129.00', commission: '20.00', sales: '3.4万' },
  { id: 6, title: '真丝睡衣套装 丝绸家居服', cover: '', price: '259.00', commission: '40.00', sales: '6800' },
  { id: 7, title: '儿童益智积木 拼装玩具', cover: '', price: '149.00', commission: '25.00', sales: '1.5万' },
  { id: 8, title: '空气炸锅 家用多功能', cover: '', price: '299.00', commission: '45.00', sales: '4.2万' }
]

// 加载产品列表
const loadProducts = async () => {
  try {
    // TODO: 替换为实际 API 调用
    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, 800))

    // 模拟分页加载
    if (products.value.length >= mockProducts.length) {
      finished.value = true
    } else {
      products.value.push(...mockProducts)
    }
  } finally {
    loading.value = false
  }
}

// 选择分类
const selectCategory = (categoryId: number) => {
  activeCategory.value = categoryId
  products.value = []
  finished.value = false
  // TODO: 根据分类重新加载产品
}

// 搜索产品
const handleSearch = () => {
  products.value = []
  finished.value = false
  // TODO: 根据搜索关键词重新加载产品
}

// 跳转产品详情
const goToDetail = (productId: number) => {
  router.push(`/product/${productId}`)
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

.commission-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #ffffff;
  background: linear-gradient(135deg, #ff6034, #ee0a24);
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
</style>
