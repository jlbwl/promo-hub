import { Router } from 'express'
import { smsLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { requireAdmin } from '../middleware/auth.js'
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
} from '../controllers/user.controller.js'

const router: Router = Router()

// 用户注册和登录
router.post('/users/register', registerUser)
router.post('/users/login', loginLimiter, userLogin)
router.post('/users/sms/send', smsLimiter, sendUserSmsCode)
router.post('/users/sms/login', userSmsLogin)
router.post('/users/password/set', setUserPassword)

// 管理后台用户管理
router.get('/users', getUsers)
router.get('/users/:id', getUserById)
router.delete('/users/:id', requireAdmin, deleteUser)
router.put('/users/:id/status', requireAdmin, updateUserStatus)
router.put('/users/:id/role', requireAdmin, updateUserRole)
router.put('/users/:id/team-name', requireAdmin, updateUserTeamName)

export default router
