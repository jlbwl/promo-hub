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
            <el-option label="美妆护肤" value="beauty" />
            <el-option label="数码电子" value="digital" />
            <el-option label="食品饮料" value="food" />
            <el-option label="运动户外" value="sports" />
            <el-option label="母婴用品" value="baby" />
            <el-option label="家居生活" value="home" />
            <el-option label="服饰鞋包" value="fashion" />
            <el-option label="其他" value="other" />
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

    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 1000))

    ElMessage.success(isEdit.value ? '产品更新成功' : '产品创建成功')
    router.push('/products')
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

// 获取产品详情（编辑模式）
const fetchProductDetail = async () => {
  if (!isEdit.value) return

  try {
    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 500))

    // 模拟数据
    Object.assign(form, {
      title: '高端护肤品套装 - 补水保湿系列',
      description: '这是一款高端补水保湿护肤品套装，包含洁面乳、爽肤水、精华液、面霜四件套，适合干性及混合性肌肤使用。',
      category: 'beauty',
      price: 299.00,
      originalPrice: 599.00,
      commissionAmount: 45.00,
      commissionRate: 15.0,
      tags: ['热销', '补水', '护肤', '套装'],
      cover: 'https://via.placeholder.com/800x800'
    })
  } catch (error) {
    console.error('获取产品详情失败:', error)
    ElMessage.error('获取产品详情失败')
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
