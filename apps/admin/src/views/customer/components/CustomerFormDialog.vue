<template>
  <el-dialog
    v-model="visible"
    :title="editingId ? '编辑客户' : '新增客户'"
    width="520px"
    destroy-on-close
    @closed="handleClosed"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="群号简称" prop="groupName">
        <el-input v-model="form.groupName" maxlength="200" placeholder="例如：888" />
      </el-form-item>
      <el-form-item label="对接人" prop="contactName">
        <el-input v-model="form.contactName" maxlength="200" placeholder="请输入对接人" />
      </el-form-item>
      <el-form-item label="收款方式" prop="payMethod">
        <el-select v-model="form.payMethod" style="width: 100%">
          <el-option
            v-for="item in PAY_METHOD_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="卡号/备注" prop="cardNo">
        <el-input
          v-model="form.cardNo"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
          placeholder="可填写卡号或备注"
        />
      </el-form-item>
      <el-form-item label="使用次数" prop="searchCount">
        <el-input-number v-model="form.searchCount" :min="0" :step="1" step-strictly />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio
            v-for="item in STATUS_OPTIONS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="visible = false">
        取消
      </el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { PAY_METHOD_OPTIONS, STATUS_OPTIONS, type CustomerItem } from '../utils'
import type { CustomerFormPayload } from '../composables/useCustomerAdmin'

const props = defineProps<{
  save: (payload: CustomerFormPayload, id?: string) => Promise<void>
}>()

const emit = defineEmits<{ success: [] }>()

const visible = ref(false)
const saving = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

const createEmptyForm = (): CustomerFormPayload => ({
  groupName: '',
  contactName: '',
  payMethod: 'alipay',
  cardNo: '',
  searchCount: 0,
  status: 'active',
})

const form = reactive<CustomerFormPayload>(createEmptyForm())

const rules: FormRules = {
  groupName: [{ required: true, message: '请输入群号简称', trigger: 'blur' }],
  contactName: [{ required: true, message: '请输入对接人', trigger: 'blur' }],
  payMethod: [{ required: true, message: '请选择收款方式', trigger: 'change' }],
  searchCount: [
    {
      validator: (_rule, value, callback) => {
        if (!Number.isInteger(value) || value < 0) {
          callback(new Error('使用次数必须是非负整数'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
}

const open = (row?: CustomerItem) => {
  editingId.value = row?.id || ''
  Object.assign(form, createEmptyForm(), row
    ? {
        groupName: row.groupName,
        contactName: row.contactName,
        payMethod: row.payMethod,
        cardNo: row.cardNo,
        searchCount: row.searchCount,
        status: row.status,
      }
    : {})
  visible.value = true
}

const handleClosed = () => {
  editingId.value = ''
  Object.assign(form, createEmptyForm())
  formRef.value?.clearValidate()
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    await props.save({ ...form }, editingId.value || undefined)
    ElMessage.success(editingId.value ? '更新成功' : '新增成功')
    visible.value = false
    emit('success')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>
