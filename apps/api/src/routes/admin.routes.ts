import { Router, RequestHandler } from 'express'
import { smsLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { requireAdmin } from '../middleware/auth.js'
import {
  adminLogin,
  adminSmsLogin,
  adminChangePassword,
} from '../controllers/admin.controller.js'

const router: Router = Router()

// 管理员登录接口
router.post('/admin/login', loginLimiter, adminLogin)
router.post('/admin/sms-login', smsLimiter, adminSmsLogin)
router.post('/admin/change-password', requireAdmin, adminChangePassword)

export default router
