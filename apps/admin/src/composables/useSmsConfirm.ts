import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { post, del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { logger } from '@promo/shared/utils/logger'

/** 删除操作的目标行：只需 id 与用于确认文案的团队名称 */
export interface SmsConfirmTarget {
  id: string
  teamName?: string
}

interface SmsConfirmOptions {
  /** 业务实体名称（用户/渠道），用于确认弹窗与危险操作文案 */
  entityLabel: string
  /** 构造删除请求路径（验证码随请求体发送，不进 URL） */
  deletePath: (id: string) => string
  /** 删除成功后的刷新回调 */
  onDeleted: () => void
}

/**
 * 管理员删除操作 + 短信二次验证
 * （用户管理、渠道管理共用：确认弹窗、验证码发送、60s 倒计时、删除请求）
 */
export function useSmsConfirm(options: SmsConfirmOptions) {
  const deleteRow = ref<SmsConfirmTarget | null>(null)
  const deleteSmsDialogVisible = ref(false)
  const smsCode = ref('')
  const smsLoading = ref(false)
  const smsCooldown = ref(0)

  let cooldownTimer: ReturnType<typeof setInterval> | null = null

  const stopCooldown = () => {
    if (cooldownTimer !== null) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }

  // 组件卸载时清理倒计时定时器，避免页面切换后定时器持续运行
  if (getCurrentScope()) {
    onScopeDispose(stopCooldown)
  }

  const startCooldown = (seconds = 60) => {
    stopCooldown()
    smsCooldown.value = seconds
    cooldownTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0) {
        stopCooldown()
      }
    }, 1000)
  }

  // 删除前确认，通过后进入短信验证弹窗
  const handleDelete = async (row: SmsConfirmTarget) => {
    try {
      await ElMessageBox.confirm(
        `删除后将清空该${options.entityLabel}「${row.teamName}」的所有档案，且数据不可找回，确定要删除吗？`,
        '危险操作',
        {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'error',
          confirmButtonClass: 'el-button--danger'
        }
      )

      deleteRow.value = row
      deleteSmsDialogVisible.value = true
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  // 发送验证码（60s 冷却）
  const sendSmsCode = async () => {
    if (smsCooldown.value > 0) return

    const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}')

    if (!adminInfo.phone) {
      ElMessage.error('未获取到管理员手机号，请重新登录')
      return
    }

    smsLoading.value = true
    try {
      const res = await post('/admin/sms/send', { phone: adminInfo.phone })
      if (res.code === 0) {
        ElMessage.success('验证码已发送')
        startCooldown()
      } else {
        ElMessage.error(res.message || '发送失败')
      }
    } catch (error) {
      logger.error('发送短信验证码失败', error)
      ElMessage.error(getErrorMessage(error, '发送失败'))
    } finally {
      smsLoading.value = false
    }
  }

  // 校验验证码并执行删除
  const confirmDelete = async () => {
    if (!smsCode.value.trim() || !deleteRow.value) {
      ElMessage.warning('请输入验证码')
      return
    }

    smsLoading.value = true
    try {
      const res = await del(options.deletePath(deleteRow.value.id), { smsCode: smsCode.value })
      if (res.code === 0) {
        ElMessage.success('删除成功')
        deleteSmsDialogVisible.value = false
        smsCode.value = ''
        deleteRow.value = null
        stopCooldown()
        smsCooldown.value = 0
        options.onDeleted()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '删除失败'))
    } finally {
      smsLoading.value = false
    }
  }

  return {
    deleteRow,
    deleteSmsDialogVisible,
    smsCode,
    smsLoading,
    smsCooldown,
    handleDelete,
    sendSmsCode,
    confirmDelete
  }
}
