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

        <!-- 价格信息 -->
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
            <el-form-item label="原价" prop="originalPrice">
              <el-input-number
                v-model="form.originalPrice"
                :min="0"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 佣金信息 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="佣金金额" prop="commissionAmount">
              <el-input-number
                v-model="form.commissionAmount"
                :min="0"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="佣金比例" prop="commissionRate">
              <el-input-number
                v-model="form.commissionRate"
                :min="0"
                :max="100"
                :precision="1"
                :step="0.1"
                controls-position="right"
                style="width: 100%;"
              />
              <div class="form-tip">百分比，例如 15 表示 15%</div>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 产品标签 -->
        <el-form-item label="产品标签" prop="tags">
          <div class="tags-container">
            <el-tag
              v-for="tag in form.tags"
              :key="tag"
              closable
              type="primary"
              style="margin-right: 8px; margin-bottom: 8px;"
              @close="handleRemoveTag(tag)"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="tagInputVisible"
              ref="tagInputRef"
              v-model="tagInputValue"
              size="small"
              style="width: 120px;"
              placeholder="输入标签"
              @keyup.enter="handleAddTag"
              @blur="handleAddTag"
            />
            <el-button
              v-else
              size="small"
              @click="tagInputVisible = true"
            >
              + 添加标签
            </el-button>
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { get, post, put } from '@promo/shared/utils/request'

const route = useRoute()
const router = useRouter()

// 表单引用
const formRef = ref<FormInstance>()
const tagInputRef = ref()

// 保存状态
const saving = ref(false)

// 是否为编辑模式
const isEdit = computed(() => !!route.params.id)

// 标签输入
const tagInputVisible = ref(false)
const tagInputValue = ref('')

// 表单数据
const form = reactive({
  title: '',
  description: '',
  category: '',
  price: 0,
  originalPrice: 0,
  commissionAmount: 0,
  commissionRate: 0,
  tags: [] as string[],
  cover: ''
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
  ],
  commissionAmount: [
    { required: true, message: '请输入佣金金额', trigger: 'blur' }
  ]
}

// 添加标签
const handleAddTag = () => {
  if (tagInputValue.value && !form.tags.includes(tagInputValue.value)) {
    form.tags.push(tagInputValue.value)
  }
  tagInputVisible.value = false
  tagInputValue.value = ''
}

// 移除标签
const handleRemoveTag = (tag: string) => {
  form.tags = form.tags.filter(t => t !== tag)
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
      originalPrice: form.originalPrice,
      commission: form.commissionAmount,
      commissionRate: form.commissionRate,
      tags: form.tags,
      coverImage: form.cover,
      status: 'published',
      managerId,
      publishedBy: localStorage.getItem('manager_token') || 'manager',
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
        originalPrice: p.originalPrice || 0,
        commissionAmount: p.commission || 0,
        commissionRate: p.commissionRate || 0,
        tags: p.tags || [],
        cover: p.coverImage || '',
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

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
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
}
</style>
