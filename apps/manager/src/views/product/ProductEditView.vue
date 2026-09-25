<template>
  <div class="product-edit-page">
    <el-card shadow="hover">
      <template #header>
        <div class="flex-between">
          <span>{{ isEdit ? '编辑产品' : '新建产品' }}</span>
          <el-button
            text
            @click="$router.back()"
          >
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
        <el-form-item
          label="产品标题"
          prop="title"
        >
          <el-input
            v-model="form.title"
            placeholder="请输入产品标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <!-- 产品描述 -->
        <el-form-item
          label="产品描述"
          prop="description"
        >
          <RichTextEditor
            ref="richTextRef"
            v-model="form.description"
            placeholder="请输入产品描述，支持图文混排"
            :max-length="5000"
          />
        </el-form-item>

        <!-- 产品分类 -->
        <el-form-item
          label="产品分类"
          prop="category"
        >
          <el-select
            v-model="form.category"
            placeholder="请选择分类"
            style="width: 100%;"
            :loading="categoriesLoading"
          >
            <el-option
              v-for="category in categories"
              :key="category.id"
              :label="category.name"
              :value="category.value"
            />
          </el-select>
        </el-form-item>

        <!-- 价格与库存 -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item
              label="推广费"
              prop="price"
            >
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
            <el-form-item
              label="库存"
              prop="stock"
            >
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
          <OptionGroupEditor
            :options="form.options"
            @add="addOption"
            @copy="copyOption"
            @remove="deleteOption"
            @clear="clearOptions"
            @batch-add="pushOptionLabels"
            @update-field="updateOptionField"
            @qr-upload="handleQrUpload"
          />
        </el-form-item>

        <!-- 封面图片 -->
        <el-form-item
          label="封面图片"
          prop="cover"
        >
          <CoverImageUploader
            v-model:cover="form.cover"
            v-model:cover-info="coverImageInfo"
          />
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
          <el-button
            type="primary"
            :loading="saving"
            @click="handleSave"
          >
            {{ saving ? '保存中...' : '保存' }}
          </el-button>
          <el-button @click="$router.back()">
            取消
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import OptionGroupEditor from './components/OptionGroupEditor.vue'
import CoverImageUploader from './components/CoverImageUploader.vue'
import { useProductEdit } from './composables/useProductEdit'

// 富文本编辑器引用
const richTextRef = ref<InstanceType<typeof RichTextEditor>>()

const {
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
} = useProductEdit()
</script>

<style lang="scss" scoped>
.product-edit-page {
  .form-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.4;
    margin-top: 4px;
  }
}
</style>
