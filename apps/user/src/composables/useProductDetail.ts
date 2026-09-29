/**
 * 产品详情视图状态与逻辑：详情加载、选项选择、分享二维码
 * 做单流程（payload 组装/提交/跳转）见 useProductOrder，由视图装配
 */
import { logger } from '@promo/shared/utils/logger'
import { reactive, ref } from 'vue'
import { showToast } from 'vant'
import { get } from '@promo/shared/utils/request'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { Product, ProductOption } from '@promo/shared/types'
import QRCode from 'qrcode'
import { useUser } from '@/composables/useLocalStorage'

/**
 * 产品详情接口返回数据（在 Product 基础上附加展示字段）
 */
interface ProductDetailData extends Product {
  sales?: number
}

/**
 * 产品详情视图 composable：route 由视图传入（与 useProductOrder 同风格）
 */
export const useProductDetail = (route: RouteLocationNormalizedLoaded) => {
  // 获取产品 ID
  const productId = route.params.id as string

  // 本地身份信息（user_info / login_type）
  const { getUserId } = useUser()

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
    options: [] as ProductOption[],
    requireName: false,
    requirePhone: false
  })

  // 分享弹窗
  const shareVisible = ref(false)
  const shareQrCode = ref('')

  // 是否是分享模式
  const isShareMode = ref(false)

  // 加载产品详情
  const fetchProductDetail = async () => {
    try {
      const res = await get<ProductDetailData>(`/products/${productId}`)
      if (res.data) {
        const p = res.data
        product.id = p.id
        product.title = p.title || ''
        // 微信内菜单转发/收藏生成的卡片标题取 document.title，
        // 路由守卫固定设为「产品详情」，这里改为具体产品标题以区分不同产品
        if (product.title) {
          document.title = product.title
        }
        product.price = String(p.price || 0)
        product.stock = p.stock || 0
        product.sales = String(p.sales || 0)
        product.images = p.images && p.images.length > 0 ? p.images : (p.coverImage ? [p.coverImage] : [])
        product.description = p.description || ''
        product.options = p.options || []
        product.requireName = p.requireName || false
        product.requirePhone = p.requirePhone || false
        logger.debug('[产品详情] options:', JSON.stringify(product.options))
        if (product.options.length > 0) {
          selectedOption.value = 0
        } else {
          selectedOption.value = -1
        }
      }
    } catch (error) {
      logger.error('获取产品详情失败:', error)
      showToast('获取产品详情失败')
    }
  }

  // 初始化：分享模式判定 + 首次加载（视图 onMounted 中调用）
  const initDetail = () => {
    isShareMode.value = route.query.share === 'true'
    fetchProductDetail()
  }

  // 转发分享
  const handleShare = async () => {
    shareVisible.value = true
    shareQrCode.value = ''

    // 分享落地页：按产品输出标题/封面 OG 标签，微信卡片可区分具体产品；
    // 落地页自动跳转到详情页并保留 sharerId 归因参数
    let shareUrl = `${window.location.origin}/api/share/product/${productId}`
    const sharerId = getUserId()
    if (sharerId) {
      shareUrl += `?sharerId=${sharerId}`
    }

    try {
      shareQrCode.value = await QRCode.toDataURL(shareUrl, {
        width: 200,
        margin: 2
      })
    } catch (error) {
      logger.error('生成分享二维码失败:', error)
      showToast('生成分享二维码失败')
    }
  }

  return {
    product,
    selectedOption,
    isShareMode,
    shareVisible,
    shareQrCode,
    getUserId,
    fetchProductDetail,
    initDetail,
    handleShare,
  }
}
