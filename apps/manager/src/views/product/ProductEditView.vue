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
          <el-input
            v-model="form.description"
            type="textarea"
            placeholder="请输入产品描述"
            :rows="4"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <!-- 产品分类 -->
        <el-form-item label="产品分类" prop="category">
          <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%;">
            <el-option label="综合-立返" value="comprehensive-instant" />
            <el-option label="综合-数据" value="comprehensive-data" />
            <el-option label="个养和加挂" value="personal-insurance" />
            <el-option label="限三-立返" value="limit3-instant" />
            <el-option label="限三-数据" value="limit3-data" />
            <el-option label="不限三-立返" value="no-limit3-instant" />
            <el-option label="不限三-数据" value="no-limit3-data" />
            <el-option label="三方-立返" value="third-party-instant" />
            <el-option label="三方-数据" value="third-party-data" />
            <el-option label="其它" value="other" />
          </el-select>
        </el-form-item>

        <!-- 价格与库存 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="售价" prop="price">
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
              <span style="font-size: 13px; color: #606266;">用户做单时需选择的选项（如套餐、规格等）</span>
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
                          <el-button type="primary" text size="small" :loading="opt._qrLoading" title="上传推广码识别链接">
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

const route = useRoute()
const router = useRouter()

// 表单引用
const formRef = ref<FormInstance>()

// 保存状态
const saving = ref(false)

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
    { required: true, message: '请输入产品描述', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择产品分类', trigger: 'change' }
  ],
  price: [
    { required: true, message: '请输入售价', trigger: 'blur' }
  ]
}

// ====== 单选框组操作 ======
const handleAddOption = () => {
  form.options.push({ label: '', limit: '', redirectUrl: '' })
}

// 上传推广码识别链接
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
      ElMessage.error('未识别到二维码，请确认图片中包含有效的推广码')
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

// 保存产品
const handleSave = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    saving.value = true

    // 获取当前经理 ID
    const managerId = (() => {
      try {
        const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
        return info.id || ''
      } catch { return '' }
    })()

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      price: form.price,
      stock: form.stock || 0,
      coverImage: form.cover,
      options: form.options.filter(o => o.label.trim()).map(({ label, limit, redirectUrl }) => ({ label, limit, redirectUrl })), // 只保存有名称的选项
      status: 'published',
      managerId,
      publishedBy: localStorage.getItem('manager_token') || 'manager',
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
    router.push('/products')
  } catch (error: any) {
    console.error('保存失败:', error)
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
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
