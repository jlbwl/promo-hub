<template>
  <!-- ====== 编辑团队名称模态框 ====== -->
  <el-dialog
    v-model="visible"
    title="编辑团队名称"
    width="420px"
    :close-on-click-modal="false"
  >
    <div class="edit-team-name-content">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
      >
        <el-form-item label="产品名称">
          <el-input
            :value="row?.productName"
            disabled
          />
        </el-form-item>
        <el-form-item label="用户姓名">
          <el-input
            :value="maskName(row?.userName)"
            disabled
          />
        </el-form-item>
        <el-form-item
          label="团队名称"
          prop="teamName"
        >
          <el-input
            v-model="form.teamName"
            placeholder="请输入团队名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="loading"
        @click="confirm"
      >
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { maskName } from '../utils'

const emit = defineEmits<{
  success: []
}>()

const visible = ref(false)
const row = ref<any>(null)
const loading = ref(false)
const formRef = ref<FormInstance>()
const form = reactive({ teamName: '' })
const rules: FormRules = {
  teamName: [{ required: true, message: '请输入团队名称', trigger: 'blur' }]
}

// 打开编辑团队名称弹窗
const open = (r: any) => {
  row.value = r
  form.teamName = r.teamName || ''
  visible.value = true
}

// 确认编辑团队名称
const confirm = async () => {
  await formRef.value?.validate()
  if (!row.value) return

  loading.value = true
  try {
    const res = await put(`/orders/${row.value.id}/team-name`, {
      teamName: form.teamName.trim()
    })

    if (res.code === 0) {
      ElMessage.success('团队名称更新成功')
      visible.value = false
      row.value = null
      form.teamName = ''
      emit('success')
    } else {
      ElMessage.error(res.message || '更新失败')
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '更新失败'))
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>
