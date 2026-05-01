<template>
  <div class="product-detail-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="产品详情"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <!-- 产品轮播图 -->
    <van-swipe :autoplay="3000" indicator-color="#1989fa" class="product-swipe">
      <van-swipe-item v-for="(image, index) in product.images" :key="index">
        <van-image
          width="100%"
          height="375"
          fit="cover"
          :src="image"
        >
          <template #error>
            <div class="image-placeholder">
              <van-icon name="photo-fail" size="48" color="#ddd" />
            </div>
          </template>
        </van-image>
      </van-swipe-item>
    </van-swipe>

    <!-- 产品基本信息 -->
    <div class="product-info">
      <div class="price-row">
        <span class="price">¥{{ product.price }}</span>
        <span v-if="product.stock > 0" class="stock-badge">
          库存 {{ product.stock }} 件
        </span>
        <span v-else class="stock-badge unlimited">
          库存充足
        </span>
      </div>
      <h2 class="title">{{ product.title }}</h2>
      <div class="meta-row">
        <span class="sales">已售 {{ product.sales || 0 }} 件</span>
        <span class="rate">好评率 {{ product.rate || '100%' }}</span>
      </div>
    </div>

    <!-- 产品描述 -->
    <div class="product-desc">
      <h3 class="section-title">产品描述</h3>
      <div class="desc-content" v-html="product.description"></div>
    </div>

    <!-- 单选框组（推广经理设置的选项） -->
    <div v-if="product.options && product.options.length > 0" class="option-section">
      <h3 class="section-title">选择推广选项</h3>
      <van-radio-group v-model="selectedOption" class="option-radio-group">
        <van-cell-group inset>
          <van-cell
            v-for="(opt, idx) in product.options"
            :key="idx"
            :title="opt.label"
            clickable
            @click="selectedOption = idx"
          >
            <template #right-icon>
              <van-radio :name="idx" />
            </template>
            <template #label>
              <div class="option-meta">
                <span v-if="opt.limit" class="option-limit">
                  限量 {{ opt.limit }} 单
                </span>
                <span v-if="opt.redirectUrl" class="option-redirect">
                  做单后跳转
                </span>
              </div>
            </template>
          </van-cell>
        </van-cell-group>
      </van-radio-group>
    </div>

    <!-- 底部操作栏 -->
    <van-action-bar>
      <van-action-bar-icon icon="chat-o" text="客服" />
      <van-action-bar-icon icon="star-o" text="收藏" />
      <van-action-bar-icon icon="share-o" text="分享" @click="handleShare" />
      <van-action-bar-button
        type="primary"
        text="去做单"
        @click="handleGoOrder"
      />
      <van-action-bar-button
        color="#ff976a"
        text="推广赚钱"
        @click="handlePromote"
      />
    </van-action-bar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showDialog } from 'vant'
import { get, post } from '@promo/shared/utils/request'

// 路由实例
const router = useRouter()
const route = useRoute()

// 获取产品 ID
const productId = route.params.id as string

// 选中的选项
const selectedOption = ref<number>(-1)

// 产品数据
const product = reactive({
  id: productId,
  title: '',
  price: '0',
  stock: 0,
  sales: '0',
  rate: '-',
  images: [] as string[],
  description: '',
  options: [] as { label: string; limit: string; redirectUrl: string }[]
})

// 加载产品详情
const fetchProductDetail = async () => {
  try {
    const res = await get<any>(`/products/${productId}`)
    if (res.data) {
      const p = res.data
      product.id = p.id
      product.title = p.title || ''
      product.price = String(p.price || 0)
      product.stock = p.stock || 0
      product.sales = String(p.sales || 0)
      product.images = p.images && p.images.length > 0 ? p.images : (p.coverImage ? [p.coverImage] : [])
      product.description = p.description || ''
      product.options = p.options || []
    }
  } catch (error) {
    console.error('获取产品详情失败:', error)
    showToast('获取产品详情失败')
  }
}

onMounted(() => {
  fetchProductDetail()
})

// 分享产品
const handleShare = () => {
  // TODO: 调用分享功能
  showDialog({
    title: '分享产品',
    message: '分享链接已复制到剪贴板，快去分享给好友吧！',
    confirmButtonText: '知道了'
  })
}

// 检查是否已登录
const isLoggedIn = () => !!localStorage.getItem('user_token')

// 需要登录的操作
const requireLogin = (action: string) => {
  if (!isLoggedIn()) {
    showDialog({
      title: '提示',
      message: `${action}需要先登录，是否前往登录？`,
      showCancelButton: true,
      confirmButtonText: '去登录',
      cancelButtonText: '再看看',
    }).then(() => {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }).catch(() => {})
    return false
  }
  return true
}

// 去做单
const handleGoOrder = () => {
  if (!requireLogin('去做单')) return

  // 如果有单选框组，必须先选择
  if (product.options.length > 0 && selectedOption.value < 0) {
    showToast('请先选择推广选项')
    return
  }

  // 检查库存
  if (product.stock > 0 && product.stock < 1) {
    showToast('库存不足')
    return
  }

  // 获取选中的选项
  const chosenOption = product.options.length > 0 ? product.options[selectedOption.value] : null

  // 调用做单接口
  const userId = (() => {
    try { return JSON.parse(localStorage.getItem('user_info') || '{}').id || '' } catch { return '' }
  })()

  const payload: any = { productId: product.id, userId }
  if (chosenOption) {
    payload.optionLabel = chosenOption.label
    payload.redirectUrl = chosenOption.redirectUrl || ''
  }

  post('/orders', payload).then(() => {
    // 如果有跳转链接，做单成功后跳转
    if (chosenOption?.redirectUrl) {
      showDialog({
        title: '做单成功',
        message: `已选择「${chosenOption.label}」，即将跳转完成推广任务`,
        confirmButtonText: '立即跳转',
      }).then(() => {
        window.open(chosenOption.redirectUrl, '_blank')
      }).catch(() => {})
    } else {
      showDialog({
        title: '做单成功',
        message: '订单已提交，请按照产品要求完成推广。推广结果将由经理审核。',
        confirmButtonText: '好的',
      })
    }
    // 刷新产品信息（更新库存）
    fetchProductDetail()
  }).catch((error: any) => {
    showToast(error.message || '做单失败')
  })
}

// 推广产品
const handlePromote = () => {
  if (!requireLogin('推广赚钱')) return
  // TODO: 生成推广链接或海报
  showToast('推广链接已生成，快去分享吧！')
}
</script>

<style scoped lang="scss">
.product-detail-page {
  min-height: 100%;
  background-color: #f7f8fa;
  padding-bottom: 60px;
}

// 轮播图
.product-swipe {
  .image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background-color: #f5f5f5;
  }
}

// 产品信息
.product-info {
  background-color: #ffffff;
  padding: 16px;
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.price {
  font-size: 24px;
  font-weight: 700;
  color: #ee0a24;
}

.stock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #ffffff;
  background: linear-gradient(135deg, #ff6034, #ee0a24);

  &.unlimited {
    background: linear-gradient(135deg, #07c160, #06ad56);
  }
}

.title {
  font-size: 16px;
  font-weight: 500;
  color: #323233;
  line-height: 1.5;
  margin-bottom: 8px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: #969799;
}

// 佣金卡片
.commission-card {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.commission-detail {
  width: 100%;
}

.commission-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;

  .label {
    color: #969799;
  }

  .value {
    color: #323233;

    &.highlight {
      color: #ee0a24;
      font-weight: 600;
    }
  }
}

// 产品描述
.product-desc {
  background-color: #ffffff;
  padding: 16px;
  margin-bottom: 12px;
}

// 单选框组
.option-section {
  background-color: #ffffff;
  padding: 16px;
  margin-bottom: 12px;

  .option-radio-group {
    margin-top: 8px;
  }

  .option-meta {
    display: flex;
    gap: 12px;
    margin-top: 4px;

    .option-limit {
      font-size: 12px;
      color: #e6a23c;
    }

    .option-redirect {
      font-size: 12px;
      color: #1989fa;
    }
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #1989fa;
}

.desc-content {
  font-size: 14px;
  color: #666;
  line-height: 1.8;

  :deep(ul) {
    padding-left: 20px;
    margin: 8px 0;
  }

  :deep(li) {
    margin-bottom: 4px;
  }
}
</style>
