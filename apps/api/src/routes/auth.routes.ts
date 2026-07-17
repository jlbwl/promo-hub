import { Router } from 'express'
import { refreshAuthToken, revokeRefreshToken } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../utils/response.js'

const router: Router = Router()

router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body
  
  if (!refreshToken) {
    return sendError(res, '缺少刷新令牌', 400)
  }
  
  const newTokens = await refreshAuthToken(refreshToken)
  
  if (newTokens) {
    sendSuccess(res, { token: newTokens.token, refreshToken: newTokens.refreshToken }, 'Token刷新成功')
  } else {
    sendError(res, '刷新令牌无效或已过期', 401)
  }
})

router.post('/auth/logout', (req, res) => {
  const { refreshToken } = req.body
  
  if (refreshToken) {
    revokeRefreshToken(refreshToken)
  }
  
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Auth] 销毁会话失败:', err)
      }
    })
  }
  
  sendSuccess(res, null, '退出登录成功')
})

export default router
