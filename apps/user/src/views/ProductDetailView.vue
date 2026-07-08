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

    <!-- 产品轮播图已隐藏 -->

    <!-- 产品基本信息 -->
    <div class="product-info">
      <div class="price-row" v-if="!isShareMode">
        <span class="price">{{ product.price }}</span>
        <span
          v-if="product.stock > 0"
          class="stock-badge"
        >
          库存 {{ product.stock }} 件
        </span>
        <span
          v-else
          class="stock-badge unlimited"
        >
          库存充足
        </span>
      </div>
      <h2 class="title">
        {{ product.title }}
      </h2>
      <div class="meta-row">
        <span class="sales">已售 {{ product.sales || 0 }} 件</span>
        <span class="rate">好评率 {{ product.rate || '100%' }}</span>
      </div>
    </div>

    <!-- 产品描述 -->
    <div class="product-desc">
      <h3 class="section-title">
        产品描述
      </h3>
      <div
        class="desc-content"
        v-html="product.description"
      />
    </div>

    <!-- 单选框组（渠道经理设置的选项） -->
    <div
      v-if="product.options && product.options.length > 0"
      class="option-section"
    >
      <h3 class="section-title">
        产品选项
      </h3>
      <van-radio-group
        v-model="selectedOption"
        class="option-radio-group"
      >
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
                <span
                  v-if="opt.limit"
                  class="option-limit"
                >
                  限量 {{ opt.limit }} 单
                </span>
                <span
                  v-if="opt.redirectUrl"
                  class="option-redirect"
                >
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
      <van-action-bar-icon
        v-if="!isShareMode"
        icon="chat-o"
        text="客服"
      />
      <van-action-bar-icon
        v-if="!isShareMode"
        icon="share-o"
        text="转发分享"
        @click="handleShare"
      />
      <van-action-bar-button
        type="primary"
        text="去做单"
        @click="handleGoOrder"
      />
    </van-action-bar>

    <!-- 分享弹窗 -->
    <van-popup
      v-model:show="shareVisible"
      position="center"
      :style="{ width: '300px' }"
    >
      <div class="share-container">
        <div class="share-header">
          <span class="share-title">{{ product.title }}</span>
          <van-icon
            name="cross"
            @click="shareVisible = false"
          />
        </div>
        <div class="share-qrcode">
          <img
            v-if="shareQrCode"
            :src="shareQrCode"
            alt="分享二维码"
            class="qrcode-image"
          />
          <div v-else class="qrcode-loading">
            <van-loading type="spinner" />
          </div>
        </div>
        <div class="share-tip">扫码即可做单</div>
      </div>
    </van-popup>

    <!-- 用户信息填写弹窗 -->
    <van-popup
      v-model:show="infoFormVisible"
      position="bottom"
      :style="{ height: 'auto' }"
    >
      <div class="info-form-container">
        <div class="info-form-header">
          <span class="info-form-title">请填写您的信息</span>
          <van-icon
            name="cross"
            @click="infoFormVisible = false"
          />
        </div>
        <van-form @submit="submitInfoForm">
          <van-cell-group inset>
            <van-field
              v-if="product.requireName"
              v-model="infoForm.name"
              name="name"
              label="姓名"
              placeholder="请输入姓名"
              :rules="[{ required: true, message: '请填写姓名' }]"
            />
            <van-field
              v-if="product.requirePhone"
              v-model="infoForm.phone"
              name="phone"
              label="手机号"
              type="tel"
              placeholder="请输入手机号"
              :rules="[
                { required: true, message: '请填写手机号' },
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
              ]"
            />
          </van-cell-group>
          <div class="info-form-footer">
            <van-button
              type="primary"
              native-type="submit"
              block
            >
              确认提交并做单
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showDialog } from 'vant'
import { get, post } from '@promo/shared/utils/request'
import QRCode from 'qrcode'

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
  options: [] as { label: string; limit: string; redirectUrl: string }[],
  requireName: false,
  requirePhone: false
})

// 信息填写弹窗
const infoFormVisible = ref(false)
const infoForm = reactive({
  name: '',
  phone: ''
})

// 分享弹窗
const shareVisible = ref(false)
const shareQrCode = ref('')

// 是否是分享模式
const isShareMode = ref(false)

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
      product.requireName = p.requireName || false
      product.requirePhone = p.requirePhone || false
      console.log('[产品详情] options:', JSON.stringify(product.options))
      if (product.options.length > 0) {
        selectedOption.value = 0
      } else {
        selectedOption.value = -1
      }
    }
  } catch (error) {
    console.error('获取产品详情失败:', error)
    showToast('获取产品详情失败')
  }
}

onMounted(() => {
  isShareMode.value = route.query.share === 'true'
  fetchProductDetail()
})

// 检查是否已登录
const isLoggedIn = () => !!localStorage.getItem('user_token')

// 需要登录的操作（支持访客模式）
const requireLogin = async (action: string): Promise<boolean> => {
  if (isLoggedIn()) {
    return true
  }
  if (isShareMode.value) {
    return true
  }
  try {
    await showDialog({
      title: '提示',
      message: `${action}建议先登录，是否前往登录？`,
      showCancelButton: true,
      confirmButtonText: '去登录',
      cancelButtonText: '访客继续',
    })
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return false
  } catch {
    return true
  }
}

// 转发分享
const handleShare = async () => {
  shareVisible.value = true
  shareQrCode.value = ''
  
  const sharerId = (() => {
    try { return JSON.parse(localStorage.getItem('user_info') || '{}').id || '' } catch { return '' }
  })()
  
  let shareUrl = `${window.location.origin}/user/product/${productId}?share=true`
  if (sharerId) {
    shareUrl += `&sharerId=${sharerId}`
  }
  
  try {
    shareQrCode.value = await QRCode.toDataURL(shareUrl, {
      width: 200,
      margin: 2
    })
  } catch (error) {
    console.error('生成分享二维码失败:', error)
    showToast('生成分享二维码失败')
  }
}

// 去做单
const handleGoOrder = async () => {
  if (!(await requireLogin('去做单'))) return

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

  // 检查是否需要收集用户信息
  if (product.requireName || product.requirePhone) {
    infoForm.name = ''
    infoForm.phone = ''
    infoFormVisible.value = true
    return
  }

  // 直接做单（不需要收集信息）
  submitGoOrder({})
}

// 提交信息表单
const submitInfoForm = () => {
  const userName = product.requireName ? infoForm.name : undefined
  const userPhone = product.requirePhone ? infoForm.phone : undefined
  infoFormVisible.value = false
  submitGoOrder({ userName, userPhone })
}

// 执行做单
const submitGoOrder = (userInfo: any) => {
  // 获取选中的选项
  const chosenOption = product.options.length > 0 ? product.options[selectedOption.value] : null

  console.log('[做单] 选中的选项:', JSON.stringify(chosenOption))

  // 调用做单接口
  const userId = (() => {
    try { return JSON.parse(localStorage.getItem('user_info') || '{}').id || '' } catch { return '' }
  })()

  // 检查是否是员工账户
  const isEmployee = localStorage.getItem('login_type') === 'employee'
  const employeeId = isEmployee ? (() => {
    try { return JSON.parse(localStorage.getItem('employee_info') || '{}').id || '' } catch { return '' }
  })() : undefined

  const payload: any = { productId: product.id, userId, ...userInfo }
  if (isEmployee && employeeId) {
    payload.employeeId = employeeId
  }

  const sharerId = route.query.sharerId as string
  if (sharerId) {
    payload.sharerId = sharerId
  }

  let cleanUrlForJump = ''
  if (chosenOption) {
    payload.optionLabel = chosenOption.label
    // 清理 redirectUrl 中的反引号和首尾空格/换行
    payload.redirectUrl = (chosenOption.redirectUrl || '').replace(/`/g, '').trim()
    cleanUrlForJump = payload.redirectUrl
    console.log('[做单] 原始redirectUrl:', chosenOption.redirectUrl)
    console.log('[做单] 清理后redirectUrl:', payload.redirectUrl)
  }

  console.log('[做单] 开始提交, payload:', JSON.stringify(payload))
  
  // 获取跳转链接
  let jumpUrl = ''
  if (chosenOption?.redirectUrl) {
    jumpUrl = cleanUrlForJump.trim()
    if (jumpUrl && !jumpUrl.startsWith('http://') && !jumpUrl.startsWith('https://')) {
      jumpUrl = 'https://' + jumpUrl
    }
    console.log('[做单] 跳转链接:', jumpUrl)
  }
  
  // 先提交订单，成功后再跳转
  post('/orders', payload).then((res: any) => {
    console.log('[做单] 成功, 响应:', JSON.stringify(res))
    
    // 订单提交成功后执行跳转
    if (jumpUrl) {
      console.log('[做单] 订单提交成功，准备跳转:', jumpUrl)
      try {
        if (navigator.userAgent.includes('MicroMessenger')) {
          console.log('[做单] 微信环境检测')
          window.location.href = jumpUrl
        } else {
          try {
            const newWindow = window.open(jumpUrl, '_blank')
            if (!newWindow || newWindow.closed === false) {
              throw new Error('window.open 可能被拦截')
            }
          } catch (err) {
            console.log('[做单] window.open 失败，使用 location.href', err)
            window.location.href = jumpUrl
          }
        }
      } catch (err) {
        console.error('[做单] 跳转失败:', err)
        window.location.href = jumpUrl
      }
    } else {
      // 没有跳转链接时刷新详情
      fetchProductDetail()
      showToast('做单成功')
    }
  }).catch((error: any) => {
    console.error('[做单] 失败:', error)
    showToast(error.message || '做单失败')
  })
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

// 信息填写弹窗
.info-form-container {
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding-bottom: 24px;

  .info-form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;

    .info-form-title {
      font-size: 16px;
      font-weight: 600;
      color: #323233;
    }
  }

  .info-form-footer {
    padding: 16px 20px 0;
  }
}

// 分享弹窗
.share-container {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  text-align: center;

  .share-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    .share-title {
      font-size: 16px;
      font-weight: 600;
      color: #323233;
    }
  }

  .share-qrcode {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;

    .qrcode-image {
      width: 200px;
      height: 200px;
    }

    .qrcode-loading {
      width: 200px;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .share-tip {
    font-size: 14px;
    color: #969799;
  }
}
</style>
