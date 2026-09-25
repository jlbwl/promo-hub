<template>
  <!-- 回收站弹窗 -->
  <van-action-sheet
    :show="show"
    title="回收站"
    cancel-text="关闭"
    @update:show="emit('update:show', $event)"
  >
    <template #description>
      <div class="recycle-bin-content">
        <div
          v-if="orders.length === 0"
          class="empty-recycle"
        >
          <van-icon
            name="trash-o"
            size="48"
            color="#ccc"
          />
          <p>回收站是空的</p>
        </div>
        <div
          v-else
          class="deleted-list"
        >
          <van-swipe-cell
            v-for="order in orders"
            :key="order.id"
            right-width="140"
          >
            <div class="deleted-item">
              <div class="deleted-info">
                <div class="deleted-title-row">
                  <span class="deleted-title">{{ order.productName }}</span>
                  <van-tag
                    v-if="order.optionLabel"
                    type="primary"
                    plain
                    size="medium"
                  >
                    {{ order.optionLabel }}
                  </van-tag>
                  <van-tag
                    v-if="order.fundAccount"
                    type="primary"
                    plain
                    size="medium"
                  >
                    {{ order.fundAccount }}
                  </van-tag>
                </div>
                <div
                  v-if="order.userName || order.userPhone"
                  class="deleted-user-info"
                >
                  <span v-if="order.userName">姓名：{{ maskName(order.userName) }}</span>
                  <span
                    v-if="order.userPhone"
                    class="phone-span"
                  >手机：{{ maskPhone(order.userPhone) }}</span>
                </div>
                <div class="deleted-price-row">
                  <span class="deleted-price">{{ order.productPrice }}</span>
                  <span class="deleted-time">删除于 {{ formatTime(order.deletedAt) }}</span>
                </div>
              </div>
            </div>
            <template #right>
              <div class="recycle-swipe-actions">
                <van-button
                  type="primary"
                  square
                  text="恢复"
                  @click="emit('restore', order)"
                />
                <van-button
                  type="danger"
                  square
                  text="取消"
                />
              </div>
            </template>
          </van-swipe-cell>
        </div>
      </div>
    </template>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { formatTime, maskPhone, maskName } from '../utils'
import type { Order } from '@promo/shared/types'

defineProps<{
  show: boolean
  orders: Order[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  restore: [order: Order]
}>()
</script>

<style scoped lang="scss">
// 回收站样式
.recycle-bin-content {
  padding: 8px 0;
}

.empty-recycle {
  text-align: center;
  padding: 32px 0;

  p {
    margin-top: 12px;
    font-size: 14px;
    color: #969799;
  }
}

.deleted-list {
  padding: 0 8px;
}

.deleted-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 8px;
  background-color: #f5f5f5;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease;

  &:active {
    background-color: #ebebeb;
  }

  &.active {
    background-color: #e8f4fd;
    border-color: #1989fa;

    .deleted-title {
      color: #1989fa;
    }
  }
}

.deleted-info {
  flex: 1;
  min-width: 0;
}

.deleted-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.deleted-title {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deleted-user-info {
  font-size: 13px;
  color: #646566;
  margin-bottom: 6px;

  .phone-span {
    margin-left: 12px;
  }
}

.deleted-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.deleted-price {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.deleted-time {
  font-size: 12px;
  color: #969799;
}

// 回收站侧拉菜单样式
.recycle-swipe-actions {
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;

  :deep(.van-button) {
    flex: 1;
    height: 100%;
    border-radius: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    font-size: 14px;
    font-weight: 500;

    &.van-button--danger {
      background-color: #ee0a24;
      color: #ffffff;
    }

    &.van-button--primary {
      background-color: #1989fa;
      color: #ffffff;
    }
  }
}
</style>
