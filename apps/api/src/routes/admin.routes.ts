import { Router } from 'express'
import { smsLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { smsSendLimiter } from '../middleware/smsSendLimiter.js'
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
import {
  getCustomers,
  createCustomer,
  updateCustomerById,
  deleteCustomerById,
  importCustomers,
  exportCustomers,
} from '../controllers/customer.controller.js'

const router: Router = Router()

// 管理员登录接口
router.post('/admin/login', loginLimiter, adminLogin)
router.post('/admin/sms/send', smsLimiter, smsSendLimiter, sendAdminSmsCode)
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

// 客户档案：全局共享，仅管理端维护
router.get('/admin/customers', requireAdmin, getCustomers)
router.post('/admin/customers', requireAdmin, createCustomer)
// 导入为整表 JSON 提交，限制在 /admin/customers/import 单独放宽（见 index.ts）
router.post('/admin/customers/import', requireAdmin, importCustomers)
router.get('/admin/customers/export', requireAdmin, exportCustomers)
router.put('/admin/customers/:id', requireAdmin, updateCustomerById)
router.delete('/admin/customers/:id', requireAdmin, deleteCustomerById)

export default router
