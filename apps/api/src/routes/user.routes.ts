import logger from '../utils/logger.js'
import { getErrorMessage } from '@promo/shared'
import { Router } from 'express'
import { smsLimiter, loginLimiter, registerLimiter } from '../middleware/rateLimit.js'
import { requireAdmin, requireAuth, refreshAuthToken } from '../middleware/auth.js'
import { resourcePermission } from '../middleware/resourcePermission.js'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  registerUser,
} from '../controllers/user-register.controller.js'
import {
  userLogin,
  userSmsLogin,
  setUserPassword,
  userLogout,
} from '../controllers/user-login.controller.js'
import { sendUserSmsCode } from '../controllers/user-sms.controller.js'
import {
  getUsers,
  getUserById,
  deleteUser,
  updateUserStatus,
  updateUserRole,
  updateUserTeamName,
} from '../controllers/user-admin.controller.js'

const router: Router = Router()

// 用户注册和登录
router.post('/users/register', registerLimiter, registerUser)
router.post('/users/login', loginLimiter, userLogin)
router.post('/users/sms/send', smsLimiter, sendUserSmsCode)
router.post('/users/sms/login', loginLimiter, userSmsLogin)
router.post('/users/password/set', loginLimiter, setUserPassword)
router.post('/users/logout', requireAuth, userLogout)

// 刷新 Token
router.post('/users/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      sendError(res, 'Refresh Token 不能为空', 400)
      return
    }
    
    const tokens = await refreshAuthToken(refreshToken)
    
    if (!tokens) {
      sendError(res, 'Refresh Token 无效或已过期', 401)
      return
    }
    
    sendSuccess(res, tokens, 'Token 刷新成功')
  } catch (error) {
    logger.error('Token 刷新失败:', { error: getErrorMessage(error) })
    sendError(res, 'Token 刷新失败', 500)
  }
})

// 管理后台用户管理（全量用户列表含手机号，仅管理员可访问）
router.get('/users', requireAdmin, getUsers)

// 获取单个用户 - 使用资源级权限验证
router.get(
  '/users/:id',
  requireAuth,
  resourcePermission({
    resourceType: 'user',
    action: 'read',
    adminOverride: true
  }),
  getUserById
)

// 删除用户 - 仅管理员；经理/用户本人不得物理删除账号及订单佣金（H4/H6）
router.delete(
  '/users/:id',
  requireAdmin,
  deleteUser
)

// 更新用户状态 - 仅管理员
router.put('/users/:id/status', requireAdmin, updateUserStatus)

// 更新用户角色 - 仅管理员
router.put('/users/:id/role', requireAdmin, updateUserRole)

// 更新用户团队名称 - 使用资源级权限验证
router.put(
  '/users/:id/team-name',
  requireAuth,
  resourcePermission({
    resourceType: 'user',
    action: 'update',
    adminOverride: true
  }),
  updateUserTeamName
)

export default router
