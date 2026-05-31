<template>
  <div class="cart-item">
    <div
      class="item-info"
      @click="handleItemClick"
    >
      <van-image
        v-if="item.coverImage"
        :src="item.coverImage"
        width="80"
        height="80"
        fit="cover"
        round
      />
      <div
        v-else
        class="no-image"
      >
        无图
      </div>
      <div class="item-detail">
        <h4 class="item-name">
          {{ item.productName }}
        </h4>
        <p
          v-if="item.optionLabel"
          class="item-option"
        >
          {{ item.optionLabel }}
        </p>
        <p class="item-price">
          ¥{{ item.productPrice }}
        </p>
      </div>
    </div>
    <div class="item-actions">
      <!-- 主账户可以移除，子账户只能查看 -->
      <van-button
        v-if="!isEmployee"
        type="danger"
        size="small"
        plain
        round
        @click="handleRemove"
      >
        移除
      </van-button>
      <van-tag
        v-else
        type="warning"
        size="medium"
      >
        主账户加入
      </van-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 购物车项数据接口
 */
interface CartItemProps {
  item: {
    id: string
    productId: string
    productName: string
    productPrice: number
    coverImage?: string
    optionLabel?: string
    [key: string]: any
  }
  isEmployee?: boolean
}

/**
 * 购物车项组件事件
 */
interface Emits {
  (e: 'click', item: CartItemProps['item']): void
  (e: 'remove', item: CartItemProps['item']): void
}

const { item, isEmployee } = withDefaults(defineProps<CartItemProps>(), {
  isEmployee: false
})

const emit = defineEmits<Emits>()

/**
 * 点击购物车项
 */
const handleItemClick = () => {
  emit('click', item)
}

/**
 * 移除购物车项
 */
const handleRemove = () => {
  emit('remove', item)
}
</script>

<style scoped lang="scss">
.cart-item {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-info {
  display: flex;
  gap: 12px;
  flex: 1;

  .no-image {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
  }
}

.item-detail {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;

  .item-name {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-option {
    font-size: 12px;
    color: #666;
    margin: 0;
  }

  .item-price {
    font-size: 16px;
    font-weight: 700;
    color: #ee0a24;
    margin: 0;
  }
}

.item-actions {
  display: flex;
  align-items: center;
}
</style>
