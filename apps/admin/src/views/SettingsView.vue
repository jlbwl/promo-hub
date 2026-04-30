<template>
  <div class="settings-view">
    <el-card shadow="never">
      <template #header>
        <span>基本设置</span>
      </template>

      <el-form
        ref="settingsFormRef"
        :model="settingsForm"
        :rules="settingsRules"
        label-width="140px"
        style="max-width: 600px;"
      >
        <!-- 系统名称 -->
        <el-form-item label="系统名称" prop="systemName">
          <el-input
            v-model="settingsForm.systemName"
            placeholder="请输入系统名称"
            clearable
          />
        </el-form-item>

        <!-- 默认佣金比例 -->
        <el-form-item label="默认佣金比例" prop="defaultCommissionRate">
          <el-input-number
            v-model="settingsForm.defaultCommissionRate"
            :min="0"
            :max="100"
            :precision="1"
            :step="0.5"
          />
          <span style="margin-left: 8px; color: #909399;">%</span>
        </el-form-item>

        <!-- 最低提现金额 -->
        <el-form-item label="最低提现金额" prop="minWithdrawAmount">
          <el-input-number
            v-model="settingsForm.minWithdrawAmount"
            :min="0"
            :precision="2"
            :step="100"
          />
          <span style="margin-left: 8px; color: #909399;">元</span>
        </el-form-item>

        <!-- 每页显示条数 -->
        <el-form-item label="每页显示条数" prop="pageSize">
          <el-select v-model="settingsForm.pageSize" placeholder="请选择">
            <el-option label="10 条/页" :value="10" />
            <el-option label="20 条/页" :value="20" />
            <el-option label="50 条/页" :value="50" />
            <el-option label="100 条/页" :value="100" />
          </el-select>
        </el-form-item>

        <!-- 系统公告 -->
        <el-form-item label="系统公告" prop="announcement">
          <el-input
            v-model="settingsForm.announcement"
            type="textarea"
            :rows="4"
            placeholder="请输入系统公告内容"
          />
        </el-form-item>

        <!-- 操作按钮 -->
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存设置
          </el-button>
          <el-button @click="handleReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

const settingsFormRef = ref<FormInstance>()
const saving = ref(false)

// 设置表单数据
const settingsForm = reactive({
  systemName: '',
  defaultCommissionRate: 10,
  minWithdrawAmount: 100,
  pageSize: 20,
  announcement: ''
})

// 表单校验规则
const settingsRules: FormRules = {
  systemName: [
    { required: true, message: '请输入系统名称', trigger: 'blur' },
    { min: 2, max: 50, message: '系统名称长度为 2 到 50 个字符', trigger: 'blur' }
  ],
  defaultCommissionRate: [
    { required: true, message: '请设置默认佣金比例', trigger: 'change' }
  ],
  minWithdrawAmount: [
    { required: true, message: '请设置最低提现金额', trigger: 'change' }
  ]
}

// 保存设置
const handleSave = async () => {
  if (!settingsFormRef.value) return

  await settingsFormRef.value.validate(async (valid) => {
    if (!valid) return

    saving.value = true
    try {
      // 模拟保存请求（实际项目中替换为 API 调用）
      // await saveSettingsApi(settingsForm)
      localStorage.setItem('admin_settings', JSON.stringify(settingsForm))
      ElMessage.success('设置保存成功')
    } catch (error: any) {
      ElMessage.error(error.message || '保存失败，请重试')
    } finally {
      saving.value = false
    }
  })
}

// 重置表单
const handleReset = () => {
  if (!settingsFormRef.value) return
  settingsFormRef.value.resetFields()
  ElMessage.info('已重置为默认值')
}

// 页面加载时读取设置
onMounted(() => {
  const saved = localStorage.getItem('admin_settings')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      Object.assign(settingsForm, data)
    } catch {
      // 解析失败，使用默认值
    }
  } else {
    // 设置默认值
    settingsForm.systemName = '推广管理系统'
    settingsForm.defaultCommissionRate = 10
    settingsForm.minWithdrawAmount = 100
    settingsForm.pageSize = 20
    settingsForm.announcement = '欢迎使用推广管理系统！'
  }
})
</script>

<style lang="scss" scoped>
.settings-view {
  max-width: 800px;
}
</style>
