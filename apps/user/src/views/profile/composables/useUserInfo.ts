import { logger } from '@promo/shared/utils/logger'
import { reactive } from 'vue'
import { get } from '@promo/shared/utils/request'
import type { User } from '@promo/shared/types'
import type { StoredUserInfo } from '../../../composables/useLocalStorage'

/**
 * 个人中心：用户信息加载（localStorage 读取 + 后端最新数据回填）
 */
export function useUserInfo() {
  // 用户信息（从 localStorage 读取真实数据）
  const userInfo = reactive({
    id: '',
    nickname: '加载中...',
    avatar: '',
    phone: '',
    teamName: ''
  })

  // 加载用户信息
  // @returns 请求是否成功（失败时保留已展示的数据）
  const loadUserInfo = async (): Promise<boolean> => {
    try {
      const infoStr = localStorage.getItem('user_info')
      if (!infoStr) {
        logger.warn('localStorage 中没有用户信息')
        return false
      }

      const info = JSON.parse(infoStr) as StoredUserInfo
      if (!info.id) {
        logger.warn('localStorage 中的用户信息不完整，缺少 id')
        return false
      }

      userInfo.id = info.id
      userInfo.nickname = info.nickname || info.phone || '用户'
      userInfo.avatar = info.avatar || ''
      userInfo.phone = info.phone || ''
      userInfo.teamName = info.teamName || ''

      // 从后端获取最新的用户信息
      if (userInfo.id) {
        const res = await get<User>(`/users/${userInfo.id}`)
        if (res.code === 0 && res.data) {
          userInfo.nickname = res.data.name || userInfo.nickname
          userInfo.phone = res.data.phone || userInfo.phone
          userInfo.teamName = res.data.teamName || userInfo.teamName

          // 更新 localStorage
          localStorage.setItem('user_info', JSON.stringify({
            ...info,
            teamName: userInfo.teamName
          }))
          return true
        }
        logger.warn('获取用户信息失败，API 返回错误:', res.message)
        return false
      }
      return false
    } catch (e) {
      logger.error('获取用户信息失败:', e)
      // 仅在首次加载未能展示数据时兜底，避免刷新失败覆盖已展示的信息
      if (userInfo.nickname === '加载中...') {
        userInfo.nickname = '用户'
      }
      return false
    }
  }

  return { userInfo, loadUserInfo }
}
