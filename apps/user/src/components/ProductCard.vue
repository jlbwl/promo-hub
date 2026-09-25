<template>
  <div
    class="product-card"
    @click="handleCardClick"
  >
    <!-- 产品封面图 -->
    <div class="product-image">
      <van-image
        width="100%"
        height="160"
        fit="cover"
        :src="product.cover || product.coverImage"
        lazy-load
      >
        <template #error>
          <div class="image-error">
            <van-icon
              name="photo-fail"
              size="32"
            />
          </div>
        </template>
      </van-image>
      <!-- 分类标签 -->
      <div
        v-if="categoryName"
        class="category-tag"
      >
        {{ categoryName }}
      </div>
    </div>
    <!-- 产品信息 -->
    <div class="product-info">
      <h3 class="product-title">
        {{ product.title }}
      </h3>
      <div class="product-bottom">
        <span class="product-price">¥{{ product.price }}</span>
      </div>
      <!-- 产品操作按钮（访客隐藏收藏按钮） -->
      <div
        v-if="showAddButton"
        class="product-actions"
      >
        <van-button
          size="small"
          type="primary"
          plain
          round
          :icon="product.inCart ? 'star' : 'star-o'"
          :disabled="product.inCart"
          @click.stop="handleAddToCart"
        >
          {{ product.inCart ? '已收藏' : '加入收藏' }}
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Product } from '@promo/shared/types'

/**
 * 产品数据接口（在 Product 基础上附加本地展示状态）
 */
interface ProductCardProduct extends Product {
  cover?: string
  inCart?: boolean
  sales?: number
}

interface ProductCardProps {
  product: ProductCardProduct
  categoryName?: string
  showActions?: boolean
}

/**
 * 组件事件
 */
interface Emits {
  (e: 'click', product: ProductCardProps['product']): void
  (e: 'add-to-cart', product: ProductCardProps['product']): void
}

const props = withDefaults(defineProps<ProductCardProps>(), {
  showActions: true
})

const emit = defineEmits<Emits>()

const route = useRoute()

/**
 * 收藏按钮是否可见：访客隐藏，登录用户（主账户/员工账户）可见
 * 依赖 route.path：localStorage 非响应式，登录跳转回首页后随路由重新求值
 */
const showAddButton = computed(() => {
  void route.path
  return props.showActions && (!!localStorage.getItem('user_token') || !!localStorage.getItem('employee_token'))
})

/**
 * 点击产品卡片
 */
const handleCardClick = () => {
  emit('click', props.product)
}

/**
 * 添加到购物车
 */
const handleAddToCart = () => {
  emit('add-to-cart', props.product)
}
</script>

<style scoped lang="scss">
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
    height: 160px;
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
