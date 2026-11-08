import { Router } from 'express'
import { refreshAuthToken, revokeRefreshToken, blacklistAccessToken } from '../middleware/auth.js'
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

router.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body

  if (refreshToken) {
    await revokeRefreshToken(refreshToken)
  }

  // Plan C: 将当前 Access Token 加入黑名单，使其立即失效
  const authHeader = req.headers?.authorization
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearerToken) {
    await blacklistAccessToken(bearerToken)
  }

  sendSuccess(res, null, '退出登录成功')
})

export default router
