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
  const loadUserInfo = async () => {
    try {
      const infoStr = localStorage.getItem('user_info')
      if (!infoStr) {
        logger.warn('localStorage 中没有用户信息')
        return
      }

      const info = JSON.parse(infoStr) as StoredUserInfo
      if (!info.id) {
        logger.warn('localStorage 中的用户信息不完整，缺少 id')
        return
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
        } else {
          logger.warn('获取用户信息失败，API 返回错误:', res.message)
        }
      }
    } catch (e) {
      logger.error('获取用户信息失败:', e)
      userInfo.nickname = '用户'
    }
  }

  return { userInfo, loadUserInfo }
}
