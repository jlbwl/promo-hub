<template>
  <!-- 删除确认弹窗 -->
  <el-dialog
    v-model="visible"
    title="删除确认"
    width="480px"
    :close-on-click-modal="false"
    @close="close"
  >
    <div class="delete-dialog-content">
      <div class="warning-icon">
        <el-icon
          size="48"
          color="#f56c6c"
        >
          <Warning />
        </el-icon>
      </div>
      <div class="warning-text">
        <p>确定要删除订单「<strong>{{ row?.productName }}</strong>」吗？</p>
        <p class="hint">
          删除后将同时从经理端和用户端移除该条数据，请谨慎操作。
        </p>
      </div>
      <div class="reason-section">
        <el-form-item
          label="删除原因"
          required
        >
          <el-textarea
            v-model="reason"
            placeholder="请输入删除原因（选填）"
            :rows="3"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </div>
    </div>
    <template #footer>
      <el-button @click="close">
        取消
      </el-button>
      <el-button
        type="danger"
        @click="confirmDelete"
      >
        确定删除
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Order } from '@promo/shared/types'

const emit = defineEmits<{
  success: []
}>()

const visible = ref(false)
const row = ref<Order | null>(null)
const reason = ref('')

// 打开删除确认弹窗
const open = (r: Order) => {
  row.value = r
  reason.value = ''
  visible.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!row.value) return

  // 获取管理员信息
  const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}')

  try {
    const res = await del(`/orders/${row.value.id}`, {
      reason: reason.value.trim(),
      adminId: adminInfo.id || '',
      adminPhone: adminInfo.phone || '',
      adminName: adminInfo.name || ''
    })

    if (res.code === 0) {
      ElMessage.success('删除成功')
      visible.value = false
      row.value = null
      reason.value = ''
      emit('success')
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '删除失败'))
  }
}

// 关闭删除弹窗
const close = () => {
  visible.value = false
  row.value = null
  reason.value = ''
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.delete-dialog-content {
  text-align: center;
  padding: 20px 0;
  .warning-icon { margin-bottom: 16px; }
  .warning-text {
    margin-bottom: 20px;
    p { margin: 8px 0; font-size: 14px; color: #606266;
      &.hint { font-size: 13px; color: #909399; }
    }
  }
  .reason-section {
    text-align: left;
    .el-textarea { width: 100%; }
  }
}

@media (max-width: 768px) {
  .delete-dialog-content {
    padding: 16px 0;

    .warning-text {
      p {
        font-size: 13px;
      }
    }
  }
}
</style>
