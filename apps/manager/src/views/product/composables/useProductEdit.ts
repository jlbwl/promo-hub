import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { get, post, put, clearAuthStorage } from '@promo/shared/utils/request'
import { optimizeRichText, readManagerInfo } from '../utils'
import { generateAutoCover } from '../utils/coverRenderer'
import { coverSignature, getAutoCoverSignature, isAutoCover, markAutoCover } from '../utils/coverTemplate'
import type { Product, ProductCategory } from '@promo/shared/types'

// 选项行数据（_qrLoading 为二维码识别中的临时状态，不参与保存）
export interface ProductOptionItem {
  label: string
  limit: string
  redirectUrl: string
  _qrLoading?: boolean
}

// 批量添加行：海报识别结果（选项名称 + 二维码跳转链接）
export interface BatchOptionRow {
  label: string
  redirectUrl?: string
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

  // 批量添加选项（海报识别结果：每张图片对应一行，填入券商名称与跳转链接）
  const pushOptionLabels = (rows: BatchOptionRow[]) => {
    rows.forEach(row => {
      form.options.push({
        label: row.label || '',
        limit: '',
        redirectUrl: row.redirectUrl || ''
      })
    })
  }

  /**
   * 自动封面：新建无封面时生成，编辑时补齐空封面或重绘「系统生成」的封面
   * - 编辑态封面为空（老产品）时保存会补一张自动封面
   * - 人工上传的封面永不覆盖
   * - 自动封面带 ?gen=<标题+分类签名>，文案变化时才重新生成（避免无意义重复上传）
   */
  const ensureAutoCover = async () => {
    const currentCover = form.cover || ''
    const category = categories.value.find((item) => item.value === form.category)
    const signature = coverSignature((form.title || '').trim(), form.category)

    if (isEdit.value) {
      // 人工上传的封面保持原样
      if (currentCover && !isAutoCover(currentCover)) return
      // 已有自动封面且文案未变时无需重复上传
      if (currentCover && getAutoCoverSignature(currentCover) === signature) return
    } else if (currentCover) {
      // 新建时运营已手动上传封面，保持人工优先
      return
    }

    if (!category) return

    try {
      const result = await generateAutoCover((form.title || '').trim(), category)
      form.cover = markAutoCover(result.url, signature)
    } catch (error) {
      logger.warn('[封面] 自动生成失败:', error)
      ElMessage.warning('封面自动生成失败，请稍后重试')
    }
  }

  // 保存产品
  const handleSave = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()

      saving.value = true

      // 封面自动生成必须先于保存，确保 payload 里是可用的图片地址
      await ensureAutoCover()

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
        clearAuthStorage()
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
