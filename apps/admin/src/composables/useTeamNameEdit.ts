import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { logger } from '@promo/shared/utils/logger'

interface TeamNameEditable {
  id: string
  teamName?: string
}

interface TeamNameEditOptions {
  /** 名称字段的展示文案（团队名称/渠道名称） */
  nameLabel: string
  /** 构造保存请求路径 */
  savePath: (id: string) => string
  /** 保存成功后的刷新回调 */
  onSaved: () => void
}

/**
 * 团队/渠道名称修改弹窗
 * （用户管理、渠道管理共用：打开弹窗、非空校验、trim 提交、成功提示与刷新）
 */
export function useTeamNameEdit<T extends TeamNameEditable>(options: TeamNameEditOptions) {
  const teamNameDialogVisible = ref(false)
  const teamNameLoading = ref(false)
  const teamNameForm = reactive({ teamName: '' })
  const editRow = ref<T | null>(null)

  const handleEditTeamName = (row: T) => {
    editRow.value = row
    teamNameForm.teamName = row.teamName || ''
    teamNameDialogVisible.value = true
  }

  const handleSaveTeamName = async () => {
    if (!teamNameForm.teamName.trim()) {
      ElMessage.warning(`请输入${options.nameLabel}`)
      return
    }
    if (!editRow.value) return

    teamNameLoading.value = true
    try {
      await put(options.savePath(editRow.value.id), { teamName: teamNameForm.teamName.trim() })
      ElMessage.success('修改成功')
      teamNameDialogVisible.value = false
      options.onSaved()
    } catch (error) {
      logger.error(`保存${options.nameLabel}失败`, error)
      ElMessage.error(getErrorMessage(error, '修改失败'))
    } finally {
      teamNameLoading.value = false
    }
  }

  return {
    teamNameDialogVisible,
    teamNameLoading,
    teamNameForm,
    editRow,
    handleEditTeamName,
    handleSaveTeamName
  }
}
