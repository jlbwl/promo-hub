import { Router } from 'express'
import { smsLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { resourcePermission } from '../middleware/resourcePermission.js'
import {
  registerUser,
  userLogin,
  sendUserSmsCode,
  userSmsLogin,
  setUserPassword,
  getUsers,
  getUserById,
  deleteUser,
  updateUserStatus,
  updateUserRole,
  updateUserTeamName,
  userLogout,
} from '../controllers/user.controller.js'

const router: Router = Router()

// 用户注册和登录
router.post('/users/register', registerUser)
router.post('/users/login', loginLimiter, userLogin)
router.post('/users/sms/send', smsLimiter, sendUserSmsCode)
router.post('/users/sms/login', userSmsLogin)
router.post('/users/password/set', setUserPassword)
router.post('/users/logout', requireAuth, userLogout)

// 刷新 Token
router.post('/users/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      res.status(400).json({ code: 400, message: 'Refresh Token 不能为空', data: null })
      return
    }
    
    const tokens = refreshAuthToken(refreshToken)
    
    if (!tokens) {
      res.status(401).json({ code: 401, message: 'Refresh Token 无效或已过期', data: null })
      return
    }
    
    res.json({ code: 0, message: 'Token 刷新成功', data: tokens })
  } catch (error: any) {
    console.error('Token 刷新失败:', error)
    res.status(500).json({ code: 500, message: 'Token 刷新失败', data: null })
  }
})

// 管理后台用户管理
router.get('/users', requireAuth, getUsers)

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

// 删除用户 - 使用资源级权限验证
router.delete(
  '/users/:id',
  requireAuth,
  resourcePermission({
    resourceType: 'user',
    action: 'delete',
    adminOverride: true
  }),
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
