import { Router } from 'express'
import { smsLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { requireAdmin } from '../middleware/auth.js'
import {
  adminLogin,
  adminSmsLogin,
  sendAdminSmsCode,
  adminChangePassword,
  adminPasswordUpdate,
  getAdminStats,
  getOperationLogs,
  getOperationLogAdmins,
  adminOfflineProduct,
} from '../controllers/admin.controller.js'
import { exportOperationLogs } from '../controllers/operationLogExport.controller.js'

const router: Router = Router()

// 管理员登录接口
router.post('/admin/login', loginLimiter, adminLogin)
router.post('/admin/sms/send', smsLimiter, sendAdminSmsCode)
// 短信登录同样需要限流，防止 6 位验证码被暴力尝试
router.post('/admin/sms/login', loginLimiter, adminSmsLogin)
router.post('/admin/change-password', requireAdmin, adminChangePassword)
router.post('/admin/password/update', requireAdmin, adminPasswordUpdate)
router.get('/admin/stats', requireAdmin, getAdminStats)
router.get('/admin/operation-logs', requireAdmin, getOperationLogs)
router.get('/admin/operation-logs/admins', requireAdmin, getOperationLogAdmins)
// 导出必须与列表使用同一套筛选参数；requireAdmin 保证权限一致
router.get('/admin/operation-logs/export', requireAdmin, exportOperationLogs)
router.put('/admin/products/:id/offline', requireAdmin, adminOfflineProduct)

export default router
