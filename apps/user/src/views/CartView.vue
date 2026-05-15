<template>
  <div class="cart-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="收藏"
      fixed
      placeholder
    />

    <!-- 购物车列表 -->
    <div class="cart-content">
      <div v-if="cartItems.length > 0" class="cart-list">
        <div
          v-for="item in cartItems"
          :key="item.id"
          class="cart-item"
        >
          <div class="item-info" @click="goToProduct(item)">
            <van-image
              v-if="item.coverImage"
              :src="item.coverImage"
              width="80"
              height="80"
              fit="cover"
              round
            />
            <div v-else class="no-image">无图</div>
            <div class="item-detail">
              <h4 class="item-name">{{ item.productName }}</h4>
              <p v-if="item.optionLabel" class="item-option">{{ item.optionLabel }}</p>
              <p class="item-price">¥{{ item.productPrice }}</p>
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
              @click="handleRemove(item)"
            >
              移除
            </van-button>
            <van-tag v-else type="warning" size="medium">主账户加入</van-tag>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <van-empty
        v-else
        description="收藏是空的"
        image="https://fastly.jsdelivr.net/npm/@vant/assets/custom-empty-image.png"
        image-size="100"
      >
        <template #bottom>
          <van-button round type="primary" to="/home" size="small">
            去选产品
          </van-button>
        </template>
      </van-empty>
    </div>

    <!-- 底部提示（子账户） -->
    <div v-if="isEmployee" class="employee-tip">
      <van-icon name="info-o" />
      <span>此收藏属于主账户，您可以在做单时快速访问</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { get, del } from '@promo/shared/utils/request'
import { showToast } from 'vant'

const router = useRouter()

const cartItems = ref<any[]>([])

// 是否为员工账户
const isEmployee = computed(() => {
  return localStorage.getItem('login_type') === 'employee'
})

// 获取当前用户ID
const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 获取员工所属经理ID
const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.managerId || ''
  } catch { return '' }
}

// 加载购物车数据
const loadCart = async () => {
  try {
    let items: any[] = []
    if (isEmployee.value) {
      // 员工账户：获取其所属经理负责的主账户的购物车
      const managerId = getManagerId()
      if (managerId) {
        const res = await get<any[]>('/manager/cart', { managerId })
        if (res.code === 0) {
          items = res.data || []
        }
      }
    } else {
      // 主账户：获取自己的购物车
      const res = await get<any[]>('/cart', { userId: getUserId() })
      if (res.code === 0) {
        items = res.data || []
      }
    }
    cartItems.value = items
  } catch (error) {
    console.error('获取购物车失败:', error)
  }
}

// 跳转到产品详情
const goToProduct = (item: any) => {
  router.push(`/product/${item.productId}`)
}

// 移除购物车项
const handleRemove = async (item: any) => {
  try {
    const res = await del(`/cart/${item.id}`)
    if (res.code === 0) {
      showToast('已移除')
      // 从列表中移除
      const index = cartItems.value.findIndex(i => i.id === item.id)
      if (index > -1) {
        cartItems.value.splice(index, 1)
      }
    } else {
      showToast(res.message || '移除失败')
    }
  } catch (error: any) {
    console.error('移除失败:', error)
    showToast(error.message || '移除失败')
  }
}

onMounted(() => {
  loadCart()
})
</script>

<style scoped lang="scss">
.cart-page {
  min-height: 100%;
  background-color: #f7f8fa;
}

.cart-content {
  padding: 12px 16px;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

.employee-tip {
  position: fixed;
  bottom: 60px;
  left: 16px;
  right: 16px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #856404;
}
</style>