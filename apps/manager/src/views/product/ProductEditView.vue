<template>
  <div class="product-edit-page">
    <el-card shadow="hover">
      <template #header>
        <div class="flex-between">
          <span>{{ isEdit ? '编辑产品' : '新建产品' }}</span>
          <el-button text @click="$router.back()">
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="120px"
        style="max-width: 700px;"
      >
        <!-- 产品标题 -->
        <el-form-item label="产品标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入产品标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <!-- 产品描述 -->
        <el-form-item label="产品描述" prop="description">
          <RichTextEditor
            v-model="form.description"
            placeholder="请输入产品描述，支持图文混排"
            :maxLength="5000"
            ref="richTextRef"
          />
        </el-form-item>

        <!-- 产品分类 -->
        <el-form-item label="产品分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%;" :loading="categoriesLoading">
            <el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.value" />
          </el-select>
        </el-form-item>

        <!-- 价格与库存 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="积分值" prop="price">
              <el-input-number
                v-model="form.price"
                :min="0"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存" prop="stock">
              <el-input-number
                v-model="form.stock"
                :min="0"
                :step="1"
                controls-position="right"
                style="width: 100%;"
                placeholder="不限则留空"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 单选框组 -->
        <el-form-item label="单选框组">
          <div class="option-group-config">
            <div class="option-group-header">
              <span style="font-size: 13px; color: #606266;">用户使用时需选择的选项（如套餐、规格等）</span>
              <div>
                <el-button type="primary" size="small" @click="handleBatchAddOptions">批量添加</el-button>
                <el-button size="small" @click="handleClearOptions">清空</el-button>
              </div>
            </div>

            <!-- 选项表格 -->
            <div v-if="form.options.length > 0" class="option-table-wrapper">
              <table class="option-table">
                <thead>
                  <tr>
                    <th style="width: 160px;">选项</th>
                    <th style="width: 120px;">限制做单量</th>
                    <th style="min-width: 200px;">提交后跳转</th>
                    <th style="width: 100px;">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(opt, idx) in form.options" :key="idx">
                    <td>
                      <el-input v-model="opt.label" placeholder="请输入" size="small" />
                    </td>
                    <td>
                      <el-input v-model="opt.limit" placeholder="请输入" size="small" />
                    </td>
                    <td>
                      <div class="redirect-input-wrap">
                        <el-input v-model="opt.redirectUrl" placeholder="输入跳转链接（不填则不跳转）" size="small" />
                        <el-upload
                          :show-file-list="false"
                          :auto-upload="false"
                          accept="image/*"
                          @change="(file: any) => handleQrUpload(file, idx)"
                        >
                          <el-button type="primary" text size="small" :loading="opt._qrLoading" title="上传二维码识别链接">
                            <el-icon><PictureFilled /></el-icon>
                          </el-button>
                        </el-upload>
                      </div>
                    </td>
                    <td>
                      <div class="option-actions">
                        <el-button type="primary" text size="small" @click="handleCopyOption(idx)">复制</el-button>
                        <el-button type="danger" text size="small" @click="handleDeleteOption(idx)">删除</el-button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 添加一行 -->
            <div class="add-option-area" @click="handleAddOption">
              <el-icon><Plus /></el-icon>
              <span>添加一行数据</span>
            </div>
          </div>
        </el-form-item>

        <!-- 封面图片 -->
        <el-form-item label="封面图片" prop="cover">
          <div class="upload-area">
            <el-image
              v-if="form.cover"
              :src="form.cover"
              fit="cover"
              style="width: 200px; height: 200px; border-radius: 8px;"
            />
            <div v-else class="upload-placeholder" @click="handleUpload">
              <el-icon class="upload-icon"><Plus /></el-icon>
              <span>点击上传图片</span>
              <span class="upload-tip">建议尺寸 800x800，支持 JPG/PNG</span>
            </div>
            <el-button
              v-if="form.cover"
              type="danger"
              text
              size="small"
              style="margin-top: 8px;"
              @click="form.cover = ''"
            >
              删除图片
            </el-button>
          </div>
        </el-form-item>

        <!-- 用户信息收集 -->
        <el-form-item label="用户信息">
          <div style="width: 100%;">
            <div style="display: flex; gap: 24px; align-items: center;">
              <el-checkbox v-model="form.requireName">
                <span>需要用户填写姓名</span>
                <span style="color: #f56c6c; margin-left: 4px;">*</span>
              </el-checkbox>
              <el-checkbox v-model="form.requirePhone">
                <span>需要用户填写手机号</span>
                <span style="color: #f56c6c; margin-left: 4px;">*</span>
              </el-checkbox>
            </div>
            <div style="font-size: 12px; color: #909399; margin-top: 8px;">
              用户端去做单前会显示信息填写表单
            </div>
          </div>
        </el-form-item>

        <!-- 操作按钮 -->
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">
            {{ saving ? '保存中...' : '保存' }}
          </el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft, Plus, PictureFilled } from '@element-plus/icons-vue'
import { get, post, put } from '@promo/shared/utils/request'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { ProductCategory } from '@promo/shared/types'

const route = useRoute()
const router = useRouter()

// 表单引用
const formRef = ref<FormInstance>()

// 富文本编辑器引用
const richTextRef = ref<InstanceType<typeof RichTextEditor>>()

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
  options: [] as { label: string; limit: string; redirectUrl: string; _qrLoading?: boolean }[],
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
    { required: true, message: '请输入积分值', trigger: 'blur' }
  ]
}

// ====== 单选框组操作 ======
const handleAddOption = () => {
  form.options.push({ label: '', limit: '', redirectUrl: '' })
}

// 上传二维码识别链接
const handleQrUpload = async (uploadFile: any, idx: number) => {
  const file = uploadFile.raw || uploadFile
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
  } catch (error: any) {
    console.error('二维码识别失败:', error)
    ElMessage.error('识别失败：' + (error.message || '请重试'))
  } finally {
    form.options[idx]._qrLoading = false
  }
}

const handleCopyOption = (idx: number) => {
  const copy = { ...form.options[idx] }
  form.options.splice(idx + 1, 0, copy)
}

const handleDeleteOption = (idx: number) => {
  form.options.splice(idx, 1)
}

const handleClearOptions = () => {
  if (form.options.length === 0) return
  ElMessageBox.confirm('确定清空所有选项？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    .then(() => { form.options = [] })
    .catch(() => {})
}

const handleBatchAddOptions = () => {
  ElMessageBox.prompt('每行一个选项名称，例如：\n套餐A\n套餐B\n套餐C', '批量添加选项', {
    confirmButtonText: '添加',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '每行一个选项',
    inputValidator: (val: string) => {
      if (!val || !val.trim()) return '请输入至少一个选项'
      return true
    }
  }).then(({ value }) => {
    const lines = value.split('\n').map(l => l.trim()).filter(l => l)
    lines.forEach(label => {
      form.options.push({ label, limit: '', redirectUrl: '' })
    })
    ElMessage.success(`已添加 ${lines.length} 个选项`)
  }).catch(() => {})
}

// 模拟图片上传
const handleUpload = () => {
  // 模拟上传，实际项目中使用 el-upload 组件
  form.cover = 'https://via.placeholder.com/800x800'
  ElMessage.success('图片上传成功（模拟）')
}

// 优化富文本内容，移除不必要的标签并压缩
const optimizeRichText = (html: string): string => {
  if (!html) return ''
  
  // 检测并警告 base64 图片
  const base64ImgRegex = /<img[^>]+src=["']data:image[^>]+>/gi
  const base64Imgs = html.match(base64ImgRegex)
  if (base64Imgs && base64Imgs.length > 0) {
    console.warn(`[富文本] 检测到 ${base64Imgs.length} 张 base64 图片，请使用编辑器上传功能`)
    // 可以在这里添加自动上传逻辑，但暂时只是警告
  }
  
  // 优化 HTML：移除多余空格，压缩标签
  let optimized = html
    .replace(/\s+/g, ' ') // 多个空格合并为一个
    .replace(/>\s+</g, '><') // 标签间空格移除
    .replace(/<!--[\s\S]*?-->/g, '') // 移除注释
    .replace(/class="[^"]*"/g, '') // 移除 class 属性
    .replace(/style="[^"]*"/g, '') // 移除 style 属性（保留必要样式）
  
  return optimized
}

// 保存产品
const handleSave = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    saving.value = true

    // 获取当前经理 ID，增加验证和错误提示
    const managerInfo = (() => {
      try {
        const infoStr = localStorage.getItem('manager_info')
        if (!infoStr) {
          throw new Error('未找到经理登录信息')
        }
        const info = JSON.parse(infoStr)
        if (!info.id) {
          throw new Error('经理信息中缺少 ID')
        }
        return info
      } catch (e) {
        console.error('获取经理信息失败:', e)
        throw new Error('登录信息已过期，请重新登录')
      }
    })()

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
    
    console.log('[ProductEditView] 保存成功，准备跳转')
    
    // 路由跳转 - 添加时间戳来确保路由变化被正确检测到
    await router.push({
      path: '/products',
      query: { t: Date.now() } // 添加时间戳，强制触发路由变化
    })
    
    console.log('[ProductEditView] 路由跳转完成')
  } catch (error: any) {
    console.error('保存失败:', error)
    // 如果是登录信息问题，跳转到登录页
    if (error.message?.includes('登录信息已过期') || error.message?.includes('未找到经理登录信息')) {
      localStorage.removeItem('manager_token')
      localStorage.removeItem('manager_info')
      ElMessage.warning(error.message || '请重新登录')
      await router.push('/login')
    } else {
      ElMessage.error(error.message || '保存失败')
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
    console.error('获取分类失败:', error)
  } finally {
    categoriesLoading.value = false
  }
}

// 获取产品详情（编辑模式）
const fetchProductDetail = async () => {
  if (!isEdit.value) return

  try {
    const res = await get<any>(`/products/${route.params.id}`)
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
  } catch (error: any) {
    console.error('获取产品详情失败:', error)
    ElMessage.error(error.message || '获取产品详情失败')
  }
}

onMounted(() => {
  fetchCategories()
  fetchProductDetail()
})
</script>

<style lang="scss" scoped>
.product-edit-page {
  .form-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.4;
    margin-top: 4px;
  }
  
  .upload-area {
    .upload-placeholder {
      width: 200px;
      height: 200px;
      border: 1px dashed #dcdfe6;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.3s;
      color: #909399;

      &:hover {
        border-color: #409eff;
        color: #409eff;
      }

      .upload-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .upload-tip {
        font-size: 12px;
        margin-top: 4px;
        color: #c0c4cc;
      }
    }
  }
  
  // 单选框组配置
  .option-group-config {
    width: 100%;

    .option-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .option-table-wrapper {
      border: 1px solid #ebeef5;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .option-table {
      width: 100%;
      border-collapse: collapse;

      th {
        background: #f5f7fa;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 500;
        color: #606266;
        text-align: left;
        border-bottom: 1px solid #ebeef5;
      }

      td {
        padding: 6px 12px;
        border-bottom: 1px solid #f0f2f5;

        .option-actions {
          display: flex;
          gap: 4px;
        }
      }

      tbody tr:last-child td {
        border-bottom: none;
      }
    }

    .add-option-area {
      border: 1px dashed #dcdfe6;
      border-radius: 4px;
      padding: 10px;
      text-align: center;
      color: #909399;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;

      &:hover {
        border-color: #409eff;
        color: #409eff;
      }
    }

    .redirect-input-wrap {
      display: flex;
      align-items: center;
      gap: 4px;

      .el-input {
        flex: 1;
      }
    }
  }
}
</style>
