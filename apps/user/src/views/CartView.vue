<template>
  <div class="cart-page">
    <!-- 顶部 hero（与产品大厅一致：大标题在这里，不再用导航栏重复） -->
    <div class="cart-mast">
      <div class="mast-inner">
        <div class="mast-row">
          <span class="mast-brand">COLLECTION</span>
          <span
            v-if="canManage"
            class="manage-toggle"
            @click="toggleManage"
          >
            {{ manageMode ? '完成' : '管理' }}
          </span>
        </div>
        <div class="title-row">
          <h1>收藏</h1>
          <span class="mast-count">共 <b>{{ cartItems.length }}</b> 件</span>
        </div>
      </div>
    </div>

    <!-- 购物车列表 -->
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
    >
      <div
        class="cart-content"
        :class="{ 'has-batch-bar': manageMode }"
      >
        <div
          v-if="cartItems.length > 0"
          class="cart-list"
        >
          <van-swipe-cell
            v-for="item in cartItems"
            :key="`${item.id}-${manageMode}`"
            class="cart-swipe"
            :disabled="!swipeEnabled"
          >
            <CartItem
              :item="item"
              :is-employee="isEmployee"
              :selectable="manageMode"
              :selected="isSelected(item.id)"
              @click="handleItemClick"
              @toggle="toggleItem"
            />
            <template
              v-if="swipeEnabled"
              #right
            >
              <van-button
                class="swipe-delete"
                square
                text="取消收藏"
                @click="handleRemove(item)"
              />
            </template>
          </van-swipe-cell>
        </div>

        <!-- 空状态 -->
        <van-empty
          v-else
          description="收藏是空的"
          image="https://fastly.jsdelivr.net/npm/@vant/assets/custom-empty-image.png"
          image-size="100"
        >
          <template #bottom>
            <van-button
              round
              type="primary"
              to="/home"
              size="small"
            >
              去选产品
            </van-button>
          </template>
        </van-empty>
      </div>
    </van-pull-refresh>

    <!-- 底部批量操作条（仅主账户） -->
    <div
      v-if="manageMode"
      class="batch-bar"
    >
      <van-checkbox
        :model-value="allSelected"
        icon-size="18px"
        class="batch-all"
        @click="toggleAll"
      >
        全选
      </van-checkbox>
      <van-button
        type="danger"
        size="small"
        round
        :disabled="selectedIds.length === 0"
        :loading="removing"
        @click="handleBatchRemove"
      >
        取消收藏{{ selectedIds.length > 0 ? `（${selectedIds.length}）` : '' }}
      </van-button>
    </div>

    <!-- 底部提示（子账户） -->
    <div
      v-if="isEmployee"
      class="employee-tip"
    >
      <van-icon name="info-o" />
      <span>此收藏属于主账户，您可以在做单时快速访问</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { get, del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { CartItem as CartItemEntity } from '@promo/shared/types'
import { showToast, showConfirmDialog } from 'vant'
import CartItem from '../components/CartItem.vue'
import { useUser } from '../composables/useLocalStorage'

/**
 * 路由实例
 */
const router = useRouter()

/**
 * 用户信息 composable
 */
const { getUserId, isEmployee: checkIsEmployee } = useUser()

/**
 * 购物车数据
 */
const cartItems = ref<CartItemEntity[]>([])

/**
 * 下拉刷新状态
 */
const refreshing = ref(false)

/**
 * 是否为员工账户（只读角色，不能做单或移除收藏）
 */
const isEmployee = computed(() => checkIsEmployee())

/**
 * 管理模式与批量选择（仅主账户可用）
 */
const manageMode = ref(false)
const selectedIds = ref<string[]>([])
const removing = ref(false)

const canManage = computed(() => !isEmployee.value && cartItems.value.length > 0)
/**
 * 左滑删除是否可用：员工只读不可删；批量管理模式下沿用原有批量操作
 */
const swipeEnabled = computed(() => !isEmployee.value && !manageMode.value)
const allSelected = computed(
  () => cartItems.value.length > 0 && selectedIds.value.length === cartItems.value.length
)

const isSelected = (id: string): boolean => selectedIds.value.includes(id)

/**
 * 切换管理模式
 */
const toggleManage = () => {
  if (!canManage.value) return
  manageMode.value = !manageMode.value
  selectedIds.value = []
}

/**
 * 切换单项勾选
 */
const toggleItem = (item: CartItemEntity) => {
  if (!manageMode.value) return
  const index = selectedIds.value.indexOf(item.id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(item.id)
  }
}

/**
 * 全选/取消全选
 */
const toggleAll = () => {
  selectedIds.value = allSelected.value ? [] : cartItems.value.map((item) => item.id)
}

/**
 * 加载购物车数据
 * 主账户读取自己的购物车；员工读取其主账户的购物车（user_info.id 即主账户 id）。
 * 统一走 /cart 接口，与 Tabbar 收藏徽标计数口径保持一致。
 * @returns 请求是否成功
 */
const loadCart = async (): Promise<boolean> => {
  try {
    const userId = getUserId()
    if (!userId) {
      cartItems.value = []
      return true
    }
    const res = await get<CartItemEntity[]>('/cart', { userId })
    if (res.code === 0) {
      cartItems.value = res.data || []
    }
    return true
  } catch (error) {
    logger.error('[CartView] 获取购物车失败:', error)
    // 失败时不修改已有列表，保留当前已展示的数据
    return false
  }
}

/**
 * 下拉刷新：重新请求收藏列表，失败时保留已展示的数据
 */
const onRefresh = async () => {
  const success = await loadCart()
  if (!success) {
    showToast('刷新失败，请稍后重试')
  }
  refreshing.value = false
}

/**
 * 点击收藏项：主账户直接进做单（跳转详情页并自动打开做单表单），员工只读进入详情
 */
const handleItemClick = (item: CartItemEntity) => {
  if (isEmployee.value) {
    router.push(`/product/${item.productId}`)
    return
  }
  router.push({
    path: `/product/${item.productId}`,
    query: {
      order: '1',
      ...(item.optionLabel ? { option: item.optionLabel } : {}),
    },
  })
}

/**
 * 取消单条收藏（员工只读，不可操作）
 */
const handleRemove = async (item: CartItemEntity) => {
  if (isEmployee.value) return
  try {
    const res = await del(`/cart/${item.id}`)
    if (res.code === 0) {
      showToast('已取消收藏')
      // 从列表中移除
      const index = cartItems.value.findIndex(i => i.id === item.id)
      if (index > -1) {
        cartItems.value.splice(index, 1)
      }
      // 通知 Tabbar 刷新收藏徽标计数
      window.dispatchEvent(new CustomEvent('cart-changed'))
    } else {
      showToast(res.message || '取消收藏失败')
    }
  } catch (error) {
    logger.error('[CartView] 取消收藏失败:', error)
    showToast(getErrorMessage(error, '取消收藏失败'))
  }
}

/**
 * 批量取消所选收藏（员工只读，不可操作）
 */
const handleBatchRemove = async () => {
  if (isEmployee.value || selectedIds.value.length === 0) return
  const ids = [...selectedIds.value]
  try {
    await showConfirmDialog({
      title: '取消收藏',
      message: `确定取消收藏选中的 ${ids.length} 个产品？`,
    })
  } catch {
    return
  }

  removing.value = true
  try {
    const res = await del('/cart/batch', { ids })
    if (res.code === 0) {
      cartItems.value = cartItems.value.filter((item) => !ids.includes(item.id))
      selectedIds.value = []
      showToast('已取消收藏')
      // 通知 Tabbar 刷新收藏徽标计数
      window.dispatchEvent(new CustomEvent('cart-changed'))
      if (cartItems.value.length === 0) {
        manageMode.value = false
      }
    } else {
      showToast(res.message || '取消收藏失败')
    }
  } catch (error) {
    logger.error('[CartView] 批量取消收藏失败:', error)
    showToast(getErrorMessage(error, '取消收藏失败'))
  } finally {
    removing.value = false
  }
}

/**
 * 组件挂载时加载数据
 */
onMounted(() => {
  loadCart()
})
</script>

<style scoped lang="scss">
.cart-page {
  min-height: 100%;
  background-color: var(--paper);
}

.cart-mast {
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

.mast-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;

  .mast-brand {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: #d8b07a;
  }
}

.title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8px;

  h1 {
    margin: 0;
    font-size: var(--fs-display);
    font-weight: 650;
    letter-spacing: 0.01em;
    color: var(--on-dark);
  }

  .mast-count {
    padding-bottom: 3px;
    font-size: var(--fs-micro);
    color: var(--on-dark-muted);

    b {
      font-size: 11px;
      color: var(--tabbar-active);
    }
  }
}

.cart-swipe {
  border-radius: var(--r-md);

  :deep(.van-swipe-cell__wrapper) {
    border-radius: var(--r-md);
  }

  .swipe-delete {
    height: 100%;
    width: 76px;
    padding: 0 6px;
    border: none;
    border-radius: 0 var(--r-md) var(--r-md) 0;
    background: var(--brand-deep);
    color: var(--on-dark);
    font-size: 12px;
    letter-spacing: 0.06em;
  }
}

.cart-content {
  padding: 12px 14px calc(12px + env(safe-area-inset-bottom));

  &.has-batch-bar {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.manage-toggle {
  padding-left: 6px;
  font-size: 13px;
  color: #e2c48e;
}

.batch-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--van-tabbar-height) + env(safe-area-inset-bottom));
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--surface);
  border-top: 1px solid var(--line);
  box-shadow: 0 -8px 20px -14px rgba(31, 24, 17, 0.4);

  .batch-all {
    font-size: 13px;
    color: var(--ink);
  }

  :deep(.van-button--danger) {
    height: 32px;
    padding: 0 16px;
    font-size: 12px;
  }
}

.employee-tip {
  position: fixed;
  bottom: calc(66px + env(safe-area-inset-bottom));
  left: 14px;
  right: 14px;
  background: rgba(234, 214, 176, 0.35);
  border: 1px solid var(--gold-soft);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--brand-deep);
}
</style>
