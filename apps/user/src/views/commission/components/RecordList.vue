<template>
  <!-- 订单记录列表 -->
  <van-list
    :loading="loading"
    :finished="finished"
    finished-text="没有更多了"
    @update:loading="emit('update:loading', $event)"
    @load="emit('load')"
  >
    <div class="record-list">
      <van-swipe-cell
        v-for="record in records"
        :key="record.id"
        :ref="el => { if (el) swipeCellRefs[record.id] = el as SwipeCellInstance }"
        :right-width="getSwipeWidth(record.id)"
        @close="handleSwipeClose(record.id)"
      >
        <div class="record-card">
          <div class="record-left">
            <h4 class="record-title">
              {{ record.productName }} <van-tag
                v-if="record.optionLabel"
                type="primary"
                plain
                size="medium"
                style="vertical-align: middle; margin-left: 4px;"
              >
                {{ record.optionLabel }}
              </van-tag><van-tag
                v-if="record.fundAccount"
                type="primary"
                plain
                size="medium"
                style="vertical-align: middle; margin-left: 4px;"
              >
                {{ record.fundAccount }}
              </van-tag>
            </h4>
            <div
              v-if="record.userName || record.userPhone"
              class="record-user-info"
            >
              <span v-if="record.userName">姓名：{{ maskName(record.userName) }}</span>
              <span
                v-if="record.userPhone"
                style="margin-left: 8px;"
              >手机：{{ maskPhone(record.userPhone) }}</span>
            </div>
            <span class="record-time">{{ formatTime(record.createdAt) }}</span>
            <span
              v-if="record.rejectReason"
              class="reject-reason"
            >驳回原因：{{ record.rejectReason }}</span>
          </div>
          <div class="record-right">
            <span class="record-price">{{ record.productPrice }}</span>
            <van-tag
              :type="statusType(record.status)"
              size="medium"
              round
            >
              {{ statusLabel(record.status) }}
            </van-tag>
          </div>
        </div>
        <template #right>
          <div class="swipe-actions">
            <!-- 确认删除状态：只显示删除确认按钮 -->
            <template v-if="confirmingIds.includes(record.id)">
              <van-button
                type="warning"
                square
                text="移除记录同时存放回收站"
                @click="handleDelete(record)"
              />
            </template>

            <!-- 输入资金号状态：只显示输入框和提交按钮 -->
            <template v-else-if="fundInputIds.includes(record.id)">
              <div class="fund-action">
                <input
                  :ref="(el) => { if (el) fundInputRefs[record.id] = el as HTMLInputElement }"
                  v-model="fundAccountNumbers[record.id]"
                  type="text"
                  class="fund-input"
                  placeholder="请输入资金号"
                  @keyup.enter="submitFundAccount(record)"
                  @click.stop
                  @touchend.stop
                >
                <van-button
                  type="primary"
                  size="small"
                  text="提交"
                  @click.stop="submitFundAccount(record)"
                />
              </div>
            </template>

            <!-- 正常状态：显示提交资金号和删除按钮 -->
            <template v-else>
              <van-button
                type="primary"
                square
                text="提交资金号"
                @click="handleShowFundInput(record)"
              />
              <van-button
                type="danger"
                square
                text="删除"
                @click="handleDelete(record)"
              />
            </template>
          </div>
        </template>
      </van-swipe-cell>
    </div>

    <!-- 空状态 -->
    <van-empty
      v-if="!loading && records.length === 0"
      description="暂无做单记录"
    />
  </van-list>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { reactive, ref } from 'vue'
import { showToast } from 'vant'
import { post, del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { getUserId, statusType, statusLabel, formatTime, maskPhone, maskName } from '../utils'
import type { Order } from '@promo/shared/types'
import type { SwipeCellInstance } from 'vant'

defineProps<{
  records: Order[]
  loading: boolean
  finished: boolean
}>()

const emit = defineEmits<{
  'update:loading': [value: boolean]
  load: []
  deleted: [record: Order]
  'fund-submitted': [record: Order, fundAccount: string]
}>()

// 正在确认删除的记录ID列表（两步删除确认）
const confirmingIds = ref<string[]>([])

// swipe-cell 组件引用，用于控制菜单打开状态
const swipeCellRefs: Record<string, SwipeCellInstance> = {}

// 资金号输入框引用
const fundInputRefs: Record<string, HTMLInputElement> = {}

// 标记正在切换状态的记录（用于防止close事件清除确认状态）
const switchingIds = ref<string[]>([])

// 正在显示资金号输入框的记录ID列表
const fundInputIds = ref<string[]>([])

// 存储用户输入的资金号（响应式）
const fundAccountNumbers = reactive<Record<string, string>>({})

// 侧拉菜单关闭时，重置确认状态和资金号输入状态
const handleSwipeClose = (recordId: string) => {
  // 如果正在切换状态，则不清除确认状态
  if (switchingIds.value.includes(recordId)) {
    return
  }
  const index = confirmingIds.value.indexOf(recordId)
  if (index > -1) {
    confirmingIds.value.splice(index, 1)
  }
  // 重置资金号输入状态
  const fundIndex = fundInputIds.value.indexOf(recordId)
  if (fundIndex > -1) {
    fundInputIds.value.splice(fundIndex, 1)
  }
}

// 获取侧拉菜单宽度
const getSwipeWidth = (recordId: string): number => {
  if (confirmingIds.value.includes(recordId)) {
    return 200
  }
  if (fundInputIds.value.includes(recordId)) {
    return 240
  }
  return 140
}

// 显示资金号输入框
const handleShowFundInput = (record: Order) => {
  // 标记正在切换状态
  switchingIds.value.push(record.id)
  // 进入资金号输入状态
  fundInputIds.value.push(record.id)
  // 初始化输入框值
  if (!fundAccountNumbers[record.id]) {
    fundAccountNumbers[record.id] = ''
  }
  // 保持侧拉菜单打开状态并聚焦输入框
  setTimeout(() => {
    const swipeCell = swipeCellRefs[record.id]
    if (swipeCell && swipeCell.open) {
      swipeCell.open('right')
    }
    // 聚焦到输入框
    setTimeout(() => {
      const inputEl = fundInputRefs[record.id]
      if (inputEl) {
        inputEl.focus()
      }
    }, 100)
    // 清除切换状态标记
    const idx = switchingIds.value.indexOf(record.id)
    if (idx > -1) {
      switchingIds.value.splice(idx, 1)
    }
  }, 50)
}

// 提交资金号
const submitFundAccount = async (record: Order) => {
  const fundAccount = fundAccountNumbers[record.id]?.trim()
  if (!fundAccount) {
    showToast('请输入资金号')
    return
  }

  try {
    const res = await post('/user/orders/fund-account', {
      userId: getUserId(),
      orderId: record.id,
      fundAccount
    })
    if (res.code === 0) {
      showToast('提交成功')
      // 更新订单记录中的资金号
      emit('fund-submitted', record, fundAccount)
      // 重置输入状态
      const index = fundInputIds.value.indexOf(record.id)
      if (index > -1) {
        fundInputIds.value.splice(index, 1)
      }
      fundAccountNumbers[record.id] = ''
    } else {
      showToast(res.message || '提交失败')
    }
  } catch (error) {
    logger.error('提交资金号失败:', error)
    showToast(getErrorMessage(error, '提交失败'))
  }
}

// 删除订单（两步确认）
const handleDelete = async (record: Order) => {
  // 检查是否已处于确认状态
  const isConfirming = confirmingIds.value.includes(record.id)

  if (isConfirming) {
    // 第二步：确认删除，执行软删除
    try {
      const res = await del(`/user/orders/${record.id}`, { userId: getUserId() })
      if (res.code === 0) {
        showToast('已移至回收站')
        // 从列表中移除并更新统计
        emit('deleted', record)
      } else {
        showToast(res.message || '删除失败')
      }
    } catch (error) {
      logger.error('删除订单失败:', error)
      showToast(getErrorMessage(error, '删除失败'))
    } finally {
      // 移除确认状态
      const idx = confirmingIds.value.indexOf(record.id)
      if (idx > -1) {
        confirmingIds.value.splice(idx, 1)
      }
    }
  } else {
    // 第一步：仅允许删除待审核状态的订单
    if (record.status !== 'pending') {
      showToast('仅支持删除待审核状态的订单')
      return
    }
    // 标记正在切换状态，防止close事件清除确认状态
    switchingIds.value.push(record.id)
    // 进入确认状态
    confirmingIds.value.push(record.id)
    // 保持侧拉菜单打开状态（延迟执行确保DOM更新后再打开）
    setTimeout(() => {
      const swipeCell = swipeCellRefs[record.id]
      if (swipeCell && swipeCell.open) {
        swipeCell.open('right')
      }
      // 清除切换状态标记
      const idx = switchingIds.value.indexOf(record.id)
      if (idx > -1) {
        switchingIds.value.splice(idx, 1)
      }
    }, 50)
  }
}
</script>

<style scoped lang="scss">
// 记录列表
.record-list {
  padding: 0 12px;
}

.record-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 8px;
}

.record-left {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-user-info {
  font-size: 12px;
  color: #646566;
  margin-bottom: 4px;
}

.record-time {
  font-size: 12px;
  color: #969799;
  display: block;
  margin-bottom: 2px;
}

.reject-reason {
  font-size: 12px;
  color: #ee0a24;
  display: block;
  margin-top: 4px;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}

.record-price {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

// 侧拉菜单样式（微信风格）
:deep(.van-swipe-cell__right) {
  display: flex;
  align-items: stretch;
  height: 100%;
}

.swipe-actions {
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

    &.van-button--warning {
      background-color: #ff976a;
      color: #ffffff;
    }

    &.van-button--primary {
      background-color: #1989fa;
      color: #ffffff;
    }
  }
}

// 资金号输入框区域
.fund-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background-color: #1989fa;
}

.fund-input {
  flex: 1;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  background-color: #ffffff;
  color: #323233;
  outline: none;
}

.fund-input::placeholder {
  color: #969799;
}
</style>
