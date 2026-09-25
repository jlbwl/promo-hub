import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { get, post, put } from '@promo/shared/utils/request'
import { optimizeRichText, readManagerInfo } from '../utils'
import type { Product, ProductCategory } from '@promo/shared/types'

// 选项行数据（_qrLoading 为二维码识别中的临时状态，不参与保存）
export interface ProductOptionItem {
  label: string
  limit: string
  redirectUrl: string
  _qrLoading?: boolean
}

/**
 * 产品编辑页：表单数据与校验、分类/详情加载、选项行操作、封面信息与保存逻辑
 */
export function useProductEdit() {
  const route = useRoute()
  const router = useRouter()

  // 表单引用
  const formRef = ref<FormInstance>()

  // 保存状态
  const saving = ref(false)

  // 封面图片信息
  const coverImageInfo = ref<{
    width: number
    height: number
    size: number
  } | null>(null)

  // 分类数据
  const categories = ref<ProductCategory[]>([])
  const categoriesLoading = ref(false)

  // 是否为编辑模式
  const isEdit = computed(() => !!route.params.id)

  // 表单数据
  const form = reactive({
    title: '',
    description: '',
    category: '',
    price: 0,
    stock: 0,
    cover: '',
    options: [] as ProductOptionItem[],
    requireName: false,
    requirePhone: false
  })

  // 表单校验规则
  const formRules: FormRules = {
    title: [
      { required: true, message: '请输入产品标题', trigger: 'blur' },
      { min: 2, max: 100, message: '标题长度在 2 到 100 个字符', trigger: 'blur' }
    ],
    description: [
      { required: true, message: '请输入产品描述', trigger: 'blur' },
      { validator: (_rule, value, callback) => {
        // 移除HTML标签后检查长度
        const text = value.replace(/<[^>]*>/g, '')
        if (text.length < 2) {
          callback(new Error('描述至少需要2个字符'))
        } else if (text.length > 5000) {
          callback(new Error('描述不能超过5000个字符'))
        } else {
          callback()
        }
      }, trigger: 'blur' }
    ],
    category: [
      { required: true, message: '请选择产品分类', trigger: 'change' }
    ],
    price: [
      { required: true, message: '请输入推广费', trigger: 'blur' }
    ]
  }

  // ====== 单选框组操作 ======
  const addOption = () => {
    form.options.push({ label: '', limit: '', redirectUrl: '' })
  }

  // 更新选项单元格
  const updateOptionField = (idx: number, field: 'label' | 'limit' | 'redirectUrl', value: string) => {
    form.options[idx][field] = value
  }

  // 上传二维码识别链接
  const handleQrUpload = async (uploadFile: UploadFile, idx: number) => {
    // raw 为 element-plus 包装的原始 File；兜底分支为直接传入 File 的历史调用
    const file = (uploadFile.raw || uploadFile) as unknown as File
    if (!file) return

    form.options[idx]._qrLoading = true
    try {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.src = url

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('图片加载失败'))
      })

      // 使用 Canvas 获取图片数据
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 不支持')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)

      // 使用 jsqr 解析二维码
      const jsqr = (await import('jsqr')).default
      const code = jsqr(imageData.data, imageData.width, imageData.height)

      if (code && code.data) {
        const url = code.data.trim()
        // 验证是否为有效链接
        if (url.startsWith('http://') || url.startsWith('https://')) {
          form.options[idx].redirectUrl = url
          ElMessage.success('识别成功，链接已填入')
        } else {
          form.options[idx].redirectUrl = url
          ElMessage.warning(`已识别内容：${url.slice(0, 50)}${url.length > 50 ? '...' : ''}，请确认是否为有效链接`)
        }
      } else {
        ElMessage.error('未识别到二维码，请确认图片中包含有效的二维码')
      }
    } catch (error) {
      logger.error('二维码识别失败:', error)
      ElMessage.error('识别失败：' + getErrorMessage(error, '请重试'))
    } finally {
      form.options[idx]._qrLoading = false
    }
  }

  const copyOption = (idx: number) => {
    const copy = { ...form.options[idx] }
    form.options.splice(idx + 1, 0, copy)
  }

  const deleteOption = (idx: number) => {
    form.options.splice(idx, 1)
  }

  const clearOptions = () => {
    form.options = []
  }

  // 批量添加选项
  const pushOptionLabels = (labels: string[]) => {
    labels.forEach(label => {
      form.options.push({ label, limit: '', redirectUrl: '' })
    })
  }

  // 保存产品
  const handleSave = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()

      saving.value = true

      // 获取当前经理 ID，增加验证和错误提示
      const managerInfo = readManagerInfo()

      // 优化富文本内容
      const optimizedDescription = optimizeRichText(form.description)

      const payload = {
        title: form.title,
        description: optimizedDescription,
        category: form.category,
        price: form.price,
        stock: form.stock || 0,
        coverImage: form.cover,
        options: form.options.filter(o => o.label.trim()).map(({ label, limit, redirectUrl }) => ({
          label,
          limit,
          redirectUrl: (redirectUrl || '').replace(/`/g, '') // 清理反引号
        })), // 只保存有名称的选项
        status: 'published',
        managerId: managerInfo.id,
        publishedBy: managerInfo.id || localStorage.getItem('manager_token') || 'manager',
        requireName: form.requireName,
        requirePhone: form.requirePhone
      }

      if (isEdit.value) {
        await put(`/products/${route.params.id}`, payload)
        ElMessage.success('产品更新成功')
      } else {
        await post('/products', payload)
        ElMessage.success('产品创建成功')
      }

      logger.debug('[ProductEditView] 保存成功，准备跳转')

      // 路由跳转 - 使用 replace 而不是 push，确保正确刷新
      await router.replace({
        path: '/products',
        query: { refresh: Date.now().toString() } // 添加唯一查询参数
      })

      logger.debug('[ProductEditView] 路由跳转完成')
    } catch (error) {
      logger.error('保存失败:', error)
      // 如果是登录信息问题，跳转到登录页
      const errorMessage = getErrorMessage(error, '保存失败')
      if (errorMessage.includes('登录信息已过期') || errorMessage.includes('未找到经理登录信息')) {
        localStorage.removeItem('manager_token')
        localStorage.removeItem('manager_info')
        ElMessage.warning(errorMessage || '请重新登录')
        await router.push('/login')
      } else {
        ElMessage.error(errorMessage)
      }
    } finally {
      saving.value = false
    }
  }

  // 获取分类列表
  const fetchCategories = async () => {
    categoriesLoading.value = true
    try {
      const res = await get<{ list: ProductCategory[] }>('/categories')
      if (res.data?.list) {
        categories.value = res.data.list
      }
    } catch (error) {
      logger.error('获取分类失败:', error)
    } finally {
      categoriesLoading.value = false
    }
  }

  // 获取产品详情（编辑模式）
  const fetchProductDetail = async () => {
    if (!isEdit.value) return

    try {
      const res = await get<Product>(`/products/${route.params.id}`)
      if (res.data) {
        const p = res.data
        Object.assign(form, {
          title: p.title || '',
          description: p.description || '',
          category: p.category || '',
          price: p.price || 0,
          stock: p.stock || 0,
          cover: p.coverImage || '',
          options: p.options || [],
          requireName: p.requireName || false,
          requirePhone: p.requirePhone || false
        })
        // 如果有封面图片，设置默认信息
        if (p.coverImage) {
          coverImageInfo.value = {
            width: 800,
            height: 800,
            size: 0
          }
        }
      }
    } catch (error) {
      logger.error('获取产品详情失败:', error)
      ElMessage.error(getErrorMessage(error, '获取产品详情失败'))
    }
  }

  onMounted(() => {
    fetchCategories()
    fetchProductDetail()
  })

  return {
    formRef,
    form,
    formRules,
    categories,
    categoriesLoading,
    isEdit,
    saving,
    coverImageInfo,
    addOption,
    updateOptionField,
    handleQrUpload,
    copyOption,
    deleteOption,
    clearOptions,
    pushOptionLabels,
    handleSave,
  }
}
