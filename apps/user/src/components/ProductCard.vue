<template>
  <div
    class="product-card"
    @click="handleCardClick"
  >
    <!-- 产品封面图 -->
    <div class="product-image">
      <van-image
        width="100%"
        height="100"
        fit="cover"
        :src="product.cover || product.coverImage"
        lazy-load
      >
        <template #error>
          <div class="image-error">
            <van-icon
              name="photo-fail"
              size="26"
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
        <span class="product-price"><span class="cur">¥</span><b>{{ product.price }}</b></span>
        <!-- 产品操作按钮（访客隐藏收藏按钮） -->
        <div
          v-if="showAddButton"
          class="product-actions"
        >
          <button
            type="button"
            class="fav-btn"
            :class="{ active: product.inCart }"
            :disabled="product.inCart"
            :aria-label="product.inCart ? '已收藏' : '收藏'"
            @click.stop="handleAddToCart"
          >
            <van-icon :name="product.inCart ? 'star' : 'star-o'" />
          </button>
        </div>
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
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform var(--duration) var(--ease);

  &:active {
    transform: scale(0.98);
  }
}

.product-image {
  position: relative;
  height: 100px;
  overflow: hidden;

  .image-error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    background-color: var(--surface-2);
    color: var(--faint);
  }
}

.category-tag {
  position: absolute;
  top: 7px;
  right: 7px;
  padding: 2px 5px;
  border-radius: var(--r-xs);
  font-size: 8.5px;
  letter-spacing: 0.04em;
  color: var(--on-dark);
  background: rgba(30, 20, 12, 0.42);
  border: 1px solid rgba(232, 206, 158, 0.28);
  backdrop-filter: blur(4px);
}

.product-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 9px 10px 10px;
}

.product-title {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--ink);
  line-height: 1.4;
  height: 35px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 7px;
}

.product-price {
  display: flex;
  align-items: baseline;
  color: var(--profit);
  font-variant-numeric: tabular-nums;

  .cur {
    font-size: 9.5px;
    font-weight: 600;
  }

  b {
    font-size: var(--fs-price-card);
    font-weight: 750;
    letter-spacing: -0.02em;
  }
}

.product-actions {
  position: relative;
  display: flex;
  align-items: center;

  // 视觉 27px，点击热区扩到约 44px
  &::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
}

.fav-btn {
  position: relative;
  z-index: 1;
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--brand);
  cursor: pointer;
  transition: all var(--duration) var(--ease);

  .van-icon {
    font-size: 13px;
  }

  &.active {
    color: var(--gold);
    border-color: var(--gold-soft);
    background: rgba(234, 214, 176, 0.5);
  }

  &:disabled {
    cursor: default;
  }

  &:active:not(:disabled) {
    transform: scale(0.94);
  }
}
</style>
