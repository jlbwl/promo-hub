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
      <div
        v-if="!isShareMode"
        class="price-row"
      >
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
          >
          <div
            v-else
            class="qrcode-loading"
          >
            <van-loading type="spinner" />
          </div>
        </div>
        <div class="share-tip">
          扫码即可做单
        </div>
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
              v-model="infoForm.name"
              name="name"
              label="姓名"
              placeholder="请输入姓名"
              :rules="[{ required: true, message: '请填写姓名' }]"
            />
            <van-field
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
import { logger } from '@promo/shared/utils/logger'
import { reactive, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showDialog } from 'vant'
import { post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import {
  buildOrderPayload,
  jumpToUrl,
  resolveSharerId,
} from '@/composables/useProductOrder'
import { useProductDetail } from '@/composables/useProductDetail'

// 路由实例
const router = useRouter()
const route = useRoute()

// 产品详情（加载/选项选择/分享）
const {
  product,
  selectedOption,
  isShareMode,
  shareVisible,
  shareQrCode,
  getUserId,
  fetchProductDetail,
  initDetail,
  handleShare,
} = useProductDetail(route)

// 信息填写弹窗（做单流程）
const infoFormVisible = ref(false)
const infoForm = reactive({
  name: '',
  phone: ''
})

onMounted(() => {
  initDetail()
})

// 检查是否已登录（支持员工账户）
const isLoggedIn = () => !!localStorage.getItem('user_token') || !!localStorage.getItem('employee_token')

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

  // 做单必须填写客户姓名和手机号（与后端校验规则一致）
  infoForm.name = ''
  infoForm.phone = ''
  infoFormVisible.value = true
}

// 提交信息表单
const submitInfoForm = () => {
  const userName = infoForm.name
  const userPhone = infoForm.phone
  infoFormVisible.value = false
  submitGoOrder(userName, userPhone)
}

// 执行做单
const submitGoOrder = (userName: string, userPhone: string) => {
  const { payload, jumpUrl } = buildOrderPayload({
    productId: product.id,
    options: product.options,
    selectedOption: selectedOption.value,
    userName,
    userPhone,
    userId: getUserId(),
    sharerId: resolveSharerId(route),
  })

  // 与后端归属规则一致：未登录且无分享归因（sharerId）时不允许下单
  if (!isLoggedIn() && !payload.sharerId) {
    showToast('请先登录后再下单')
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }

  // 先提交订单，成功后再跳转
  post('/orders', payload).then((res) => {
    logger.debug('[做单] 成功, 响应:', JSON.stringify(res))

    // 订单提交成功后执行跳转
    if (jumpUrl) {
      logger.debug('[做单] 订单提交成功，准备跳转:', jumpUrl)
      jumpToUrl(jumpUrl)
    } else {
      // 没有跳转链接时刷新详情
      fetchProductDetail()
      showToast('做单成功')
    }
  }).catch((error: unknown) => {
    logger.error('[做单] 失败:', error)
    showToast(getErrorMessage(error, '做单失败'))
  })
}
</script>

<style scoped lang="scss" src="./ProductDetailView.scss"></style>
