<template>
  <!-- 添加/编辑弹窗 -->
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑分类' : '添加分类'"
    width="450px"
    @close="resetForm"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="100px"
    >
      <el-form-item
        label="分类名称"
        prop="name"
      >
        <el-input
          v-model="form.name"
          placeholder="请输入分类名称"
        />
      </el-form-item>
      <el-form-item
        label="分类标识"
        prop="value"
      >
        <el-input
          v-model="form.value"
          placeholder="请输入分类标识"
          :disabled="isEdit"
        />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          标识用于兼容旧数据，创建后不可修改
        </div>
      </el-form-item>
      <el-form-item
        label="排序"
        prop="sort"
      >
        <el-input-number
          v-model="form.sort"
          :min="0"
          :step="1"
          style="width: 100%;"
        />
      </el-form-item>
      <el-form-item
        label="状态"
        prop="status"
      >
        <el-radio-group v-model="form.status">
          <el-radio value="active">
            启用
          </el-radio>
          <el-radio value="archived">
            已归档
          </el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="saveLoading"
        @click="handleSave"
      >
        {{ isEdit ? '保存' : '添加' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { post, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { ProductCategory } from '@promo/shared/types'

const emit = defineEmits<{
  success: []
}>()

const dialogVisible = ref(false)
const isEdit = ref(false)
const saveLoading = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<Partial<ProductCategory>>({
  name: '',
  value: '',
  sort: 0,
  status: 'active'
})
const editRow = ref<ProductCategory | null>(null)

// 表单验证规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 2, max: 50, message: '分类名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  value: [
    { required: true, message: '请输入分类标识', trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: '分类标识只能包含小写字母、数字和连字符', trigger: 'blur' }
  ],
  sort: [
    { required: true, message: '请输入排序', trigger: 'blur' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
}

// 打开弹窗（传入行数据为编辑，否则为添加）
const open = (row?: ProductCategory) => {
  if (row) {
    isEdit.value = true
    editRow.value = row
    Object.assign(form, {
      name: row.name,
      value: row.value,
      sort: row.sort,
      status: row.status
    })
  } else {
    isEdit.value = false
  }
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  form.name = ''
  form.value = ''
  form.sort = 0
  form.status = 'active'
  editRow.value = null
  formRef.value?.resetFields()
}

// 保存
const handleSave = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    saveLoading.value = true
    if (isEdit.value && editRow.value) {
      await put(`/categories/${editRow.value.id}`, {
        name: form.name,
        sort: form.sort,
        status: form.status
      })
      ElMessage.success('更新成功')
    } else {
      await post('/categories', {
        name: form.name,
        value: form.value,
        sort: form.sort
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    emit('success')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存失败'))
  } finally {
    saveLoading.value = false
  }
}

defineExpose({ open })
</script>
