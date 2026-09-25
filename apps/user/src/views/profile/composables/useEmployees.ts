import { logger } from '@promo/shared/utils/logger'
import { ref, watch } from 'vue'
import { showToast } from 'vant'
import { get } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Employee } from '@promo/shared/types'

/**
 * 个人中心：员工子账户列表状态与加载逻辑
 * @param getUserId 当前用户 ID 读取函数（优先取响应式 userInfo.id）
 */
export function useEmployees(getUserId: () => string) {
  // 员工列表弹窗
  const showEmployeeList = ref(false)

  // 员工列表
  const employees = ref<Employee[]>([])
  const loadingEmployees = ref(false)
  const employeesFinished = ref(false)
  const employeeCount = ref(0)

  // 加载员工列表
  const loadEmployees = async () => {
    logger.debug('[员工列表] loadEmployees 被调用，当前 loading 状态:', loadingEmployees.value)

    if (loadingEmployees.value) {
      logger.debug('[员工列表] 正在加载中，跳过本次请求')
      return
    }

    loadingEmployees.value = true
    employeesFinished.value = false

    try {
      // 直接从 localStorage 获取用户ID，不依赖 userInfo 状态
      let userId = getUserId()
      if (!userId) {
        const infoStr = localStorage.getItem('user_info')
        if (infoStr) {
          try {
            const info = JSON.parse(infoStr) as { id: string }
            userId = info.id
            logger.debug('[员工列表] 从 localStorage 获取到 userId:', userId)
          } catch (e) {
            logger.error('[员工列表] 解析 localStorage 中的用户信息失败:', e)
          }
        }
      }

      logger.debug('[员工列表] 最终使用的 userId:', userId)

      if (!userId) {
        logger.warn('[员工列表] 用户ID为空，无法加载员工列表')
        showToast('请先登录')
        employees.value = []
        employeeCount.value = 0
        return
      }

      logger.debug('[员工列表] 开始请求 API，userId:', userId)
      const res = await get<Employee[]>('/employees', { userId })
      logger.debug('[员工列表] API 返回结果:', res)

      if (res.code === 0) {
        employees.value = Array.isArray(res.data) ? res.data : []
        employeeCount.value = employees.value.length
        logger.debug('[员工列表] 加载成功，共', employeeCount.value, '条记录')
      } else {
        logger.error('[员工列表] API 返回错误:', res.message)
        showToast(res.message || '获取员工列表失败')
        employees.value = []
        employeeCount.value = 0
      }
    } catch (e) {
      logger.error('[员工列表] 加载失败:', e)
      showToast(getErrorMessage(e, '获取员工列表失败'))
      employees.value = []
      employeeCount.value = 0
    } finally {
      loadingEmployees.value = false
      employeesFinished.value = true
      logger.debug('[员工列表] 加载完成，loading 状态已重置')
    }
  }

  // 监听员工列表弹窗打开
  watch(showEmployeeList, (val) => {
    if (val) {
      logger.debug('[员工列表] 弹窗打开，开始加载数据')
      // 弹窗打开时重置状态并加载数据
      employeesFinished.value = false
      employees.value = []
      // 直接加载，不延迟
      loadEmployees()
    }
  })

  return {
    showEmployeeList,
    employees,
    loadingEmployees,
    employeesFinished,
    employeeCount,
    loadEmployees
  }
}
