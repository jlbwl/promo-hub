<template>
  <div
    class="cart-item"
    :class="{ 'is-selected': props.selectable && props.selected, 'is-managing': props.selectable }"
  >
    <div
      v-if="props.selectable"
      class="item-check"
    >
      <van-checkbox
        :model-value="props.selected"
        icon-size="18px"
        @click.stop="emit('toggle', props.item)"
      />
    </div>
    <div
      class="item-info"
      @click="handleItemClick"
    >
      <van-image
        v-if="props.item.coverImage"
        :src="props.item.coverImage"
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
          {{ props.item.productName }}
        </h4>
        <p
          v-if="props.item.optionLabel"
          class="item-option"
        >
          {{ props.item.optionLabel }}
        </p>
        <p class="item-price">
          ¥{{ props.item.productPrice }}
        </p>
      </div>
    </div>
    <div
      v-if="!props.selectable"
      class="item-actions"
    >
      <!-- 主账户可以直接做单/移除，子账户为只读角色 -->
      <template v-if="!props.isEmployee">
        <van-button
          class="order-btn"
          size="small"
          round
          @click.stop="emit('order', props.item)"
        >
          做单
        </van-button>
        <van-button
          class="remove-btn"
          size="small"
          round
          @click.stop="emit('remove', props.item)"
        >
          移除
        </van-button>
      </template>
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
import type { CartItem as CartItemEntity } from '@promo/shared/types'

/**
 * 购物车项数据接口
 */
interface CartItemProps {
  item: CartItemEntity
  isEmployee?: boolean
  /** 批量管理模式：展示勾选框并隐藏逐项操作 */
  selectable?: boolean
  /** 是否已勾选 */
  selected?: boolean
}

/**
 * 购物车项组件事件
 */
interface Emits {
  (e: 'click', item: CartItemProps['item']): void
  (e: 'remove', item: CartItemProps['item']): void
  (e: 'order', item: CartItemProps['item']): void
  (e: 'toggle', item: CartItemProps['item']): void
}

// 不解构 props：解构后的布尔属性不会随父组件更新而响应（管理模式切换失效）
const props = withDefaults(defineProps<CartItemProps>(), {
  isEmployee: false,
  selectable: false,
  selected: false
})

const emit = defineEmits<Emits>()

/**
 * 点击购物车项：管理模式下切换勾选，否则进入详情
 */
const handleItemClick = () => {
  if (props.selectable) {
    emit('toggle', props.item)
    return
  }
  emit('click', props.item)
}
</script>

<style scoped lang="scss">
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  transition: border-color var(--duration) var(--ease), background var(--duration) var(--ease);

  &.is-selected {
    border-color: var(--gold);
    background: var(--surface-2);
  }
}

.item-check {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 10px;

  :deep(.van-checkbox__icon--checked .van-icon) {
    background: var(--brand);
    border-color: var(--brand);
  }
}

.item-info {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 0;

  :deep(.van-image) {
    flex: none;
  }

  .no-image {
    width: 80px;
    height: 80px;
    border-radius: 8px;
    background: var(--surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--faint);
    font-size: 12px;
  }
}

.item-detail {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;

  .item-name {
    font-size: 13px;
    font-weight: 650;
    color: var(--ink);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-option {
    font-size: 10.5px;
    color: var(--muted);
    margin: 0;
  }

  .item-price {
    margin: 0;
    font-size: 16px;
    font-weight: 750;
    color: var(--profit);
    font-variant-numeric: tabular-nums;
  }
}

.item-actions {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin-left: 8px;

  .order-btn,
  .remove-btn {
    font-size: 11px;
    height: 28px;
    padding: 0 11px;
    border-radius: var(--r-full);
  }

  .order-btn {
    color: var(--brand-deep);
    background: var(--surface-2);
    border-color: var(--gold);
    font-weight: 600;
  }

  .remove-btn {
    color: var(--muted);
    background: var(--surface);
    border-color: var(--line);
  }
}
</style>
