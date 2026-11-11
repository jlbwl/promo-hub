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
    <div class="detail-mast">
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
    </div>

    <div class="detail-body">
      <!-- 产品描述 -->
      <div class="product-desc">
        <h3 class="section-title">
          产品描述
        </h3>
        <div
          ref="descContentRef"
          class="desc-content"
          @click="handleDescContentClick"
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
    </div>

    <!-- 底部操作栏 -->
    <van-action-bar>
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
      round
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
        <van-button
          class="save-poster-btn"
          size="small"
          round
          block
          :loading="posterLoading"
          @click="handleSavePoster"
        >
          保存海报
        </van-button>
      </div>
    </van-popup>

    <!-- 海报预览弹窗 -->
    <van-popup
      v-model:show="posterVisible"
      position="center"
      round
      :style="{ width: '300px' }"
    >
      <div class="poster-container">
        <div class="poster-header">
          <span class="poster-title">推广海报</span>
          <van-icon
            name="cross"
            @click="posterVisible = false"
          />
        </div>
        <img
          v-if="posterImage"
          :src="posterImage"
          alt="推广海报"
          class="poster-image"
        >
        <div class="poster-tip">
          长按图片保存到相册
        </div>
      </div>
    </van-popup>

    <!-- 用户信息填写弹窗 -->
    <van-popup
      v-model:show="infoFormVisible"
      position="bottom"
      round
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
              :loading="submitting"
              :disabled="submitting"
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
import { reactive, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showDialog, showImagePreview } from 'vant'
import { post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import {
  beginShareVisit,
  buildOrderPayload,
  endShareVisit,
  jumpToUrl,
  resolveSharerId,
} from '@/composables/useProductOrder'
import { useProductDetail } from '@/composables/useProductDetail'

// 路由实例
const router = useRouter()
const route = useRoute()

// 分享归因跟随本次产品页访问：同一次访问内连续做单保持归因，
// 离开页面、切换产品或从非分享入口进入时失效
const syncShareVisit = () => beginShareVisit(route, String(route.params.id))
syncShareVisit()
watch(() => route.params.id, syncShareVisit)
watch(
  () => route.query.sharerId,
  (sharerId) => {
    // 下单成功后我们会移除 URL 参数，此时保持内存中的本次访问归因
    if (typeof sharerId === 'string' && sharerId) syncShareVisit()
  }
)
onBeforeUnmount(endShareVisit)

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

// 描述图片：容器内自适应展示，点击后全屏预览（多图左右切换）
const descContentRef = ref<HTMLDivElement>()
const handleDescContentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target || target.tagName !== 'IMG') return

  const images = Array.from(descContentRef.value?.querySelectorAll('img') || [])
  const srcList = images
    .map((image) => (image as HTMLImageElement).src)
    .filter((src) => !!src)
  if (!srcList.length) return

  showImagePreview({
    images: srcList,
    startPosition: Math.max(0, images.indexOf(target as HTMLImageElement)),
    closeable: true
  })
}

// 信息填写弹窗（做单流程）
const infoFormVisible = ref(false)
// O2：做单请求进行中禁用提交，避免双击产生重复订单
const submitting = ref(false)
const infoForm = reactive({
  name: '',
  phone: ''
})

onMounted(async () => {
  await initDetail()
  // 收藏页「直接做单」：详情加载完成后自动打开做单表单
  if (route.query.order === '1' && !isShareMode.value) {
    handleGoOrder()
  }
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

  // 库存校验由后端乐观锁保证（stock > 0 为有限库存，否则无限库存），
  // 前端不再做恒假的本地判断，避免误拦

  // 做单必须填写客户姓名和手机号（与后端校验规则一致）
  infoForm.name = ''
  infoForm.phone = ''
  infoFormVisible.value = true
}

// 提交信息表单
const submitInfoForm = () => {
  if (submitting.value) return
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
    sharerId: resolveSharerId(product.id),
  })

  // 与后端归属规则一致：未登录且无分享归因（sharerId）时不允许下单
  if (!isLoggedIn() && !payload.sharerId) {
    showToast('请先登录后再下单')
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }

  submitting.value = true
  // 先提交订单，成功后再跳转
  post('/orders', payload).then((res) => {
    logger.debug('[做单] 成功, 响应:', JSON.stringify(res))

    // 归因只对本次分享访问有效：移除地址栏参数，刷新后不再复用；
    // 内存中的访问归因保留，同页继续做单仍归到该分享人
    if (route.query.sharerId) {
      const restQuery = { ...route.query }
      delete restQuery.sharerId
      router.replace({ query: restQuery })
    }

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
  }).finally(() => {
    submitting.value = false
  })
}

// ============ 保存海报 ============
const posterVisible = ref(false)
const posterImage = ref('')
const posterLoading = ref(false)

const POSTER_FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

/**
 * 圆角矩形路径（不依赖较新的 CanvasRenderingContext2D.roundRect）
 */
const traceRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * 按宽度换行，超出最大行数时截断并补省略号
 */
const wrapPosterText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] => {
  const chars = Array.from(text)
  const lines: string[] = []
  let current = ''
  let index = 0

  while (index < chars.length) {
    if (current && ctx.measureText(current + chars[index]).width > maxWidth) {
      lines.push(current)
      current = ''
      if (lines.length === maxLines - 1) {
        let rest = chars.slice(index).join('')
        while (rest && ctx.measureText(`${rest}…`).width > maxWidth) {
          rest = rest.slice(0, -1)
        }
        lines.push(rest ? `${rest}…` : '…')
        return lines
      }
    } else {
      current += chars[index]
      index += 1
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines
}

/**
 * 用 Canvas 绘制墨金风格推广海报（750×1100），返回 PNG dataURL
 */
const buildPosterImage = async (): Promise<string> => {
  const W = 750
  const H = 1100
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前环境不支持海报绘制')

  // 背景渐变与页面主视觉保持一致
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#241a12')
  bg.addColorStop(0.55, '#3b2918')
  bg.addColorStop(1, '#4e3520')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 斜向细纹
  ctx.strokeStyle = 'rgba(255, 235, 205, 0.05)'
  ctx.lineWidth = 2
  for (let x = -160; x < W; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 140, H)
    ctx.stroke()
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // 顶部标签与短线
  ctx.fillStyle = 'rgba(247, 235, 216, 0.62)'
  ctx.font = `500 24px ${POSTER_FONT}`
  ctx.fillText('好物推荐', 60, 76)
  ctx.fillStyle = '#c89a58'
  ctx.fillRect(60, 116, 76, 4)

  // 标题（最多 3 行）
  ctx.fillStyle = '#f7ebd8'
  ctx.font = `650 50px ${POSTER_FONT}`
  const titleLines = wrapPosterText(ctx, product.title || '优选产品', W - 120, 3)
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, 60, 164 + idx * 68)
  })

  // 价格
  const priceY = 164 + titleLines.length * 68 + 34
  ctx.fillStyle = '#e9c58c'
  ctx.font = `600 30px ${POSTER_FONT}`
  ctx.fillText('¥', 60, priceY + 14)
  ctx.font = `750 68px ${POSTER_FONT}`
  ctx.fillText(String(product.price || '0'), 92, priceY)

  // 二维码卡片
  const cardY = H - 520
  traceRoundedRect(ctx, (W - 340) / 2, cardY, 340, 340, 24)
  ctx.fillStyle = '#fffcf5'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(216, 176, 122, 0.6)'
  traceRoundedRect(ctx, (W - 340) / 2, cardY, 340, 340, 24)
  ctx.stroke()

  const qrImage = new Image()
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve()
    qrImage.onerror = () => reject(new Error('海报二维码加载失败'))
    qrImage.src = shareQrCode.value
  })
  ctx.drawImage(qrImage, (W - 300) / 2, cardY + 20, 300, 300)

  // 底部提示
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(247, 235, 216, 0.72)'
  ctx.font = `400 24px ${POSTER_FONT}`
  ctx.fillText('微信扫码 · 立即做单', W / 2, H - 128)

  return canvas.toDataURL('image/png')
}

/**
 * 生成并预览海报（由分享弹窗进入，海报弹窗支持长按保存）
 */
const handleSavePoster = async () => {
  if (!shareQrCode.value) {
    showToast('二维码生成中，请稍候')
    return
  }
  if (posterLoading.value) return
  posterLoading.value = true
  try {
    posterImage.value = await buildPosterImage()
    shareVisible.value = false
    posterVisible.value = true
  } catch (error) {
    logger.error('[海报] 生成失败:', error)
    showToast('海报生成失败，请稍后重试')
  } finally {
    posterLoading.value = false
  }
}
</script>

<style scoped lang="scss" src="./ProductDetailView.scss"></style>
