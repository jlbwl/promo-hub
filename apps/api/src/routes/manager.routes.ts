import { Router } from 'express'
import { smsLimiter, loginLimiter } from '../middleware/rateLimit.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { resourcePermission } from '../middleware/resourcePermission.js'
import {
  getManagers,
  getManagerById,
  createManager,
  deleteManagerWithCascade,
  updateManagerById,
  updateManagerTeamName,
  managerLogin,
  sendManagerSmsCode,
  managerSmsLogin,
  verifyManagerById,
  setManagerPassword,
} from '../controllers/manager.controller.js'

const router: Router = Router()

// 经理信息管理
router.get('/managers', getManagers)
router.get('/managers/:id', getManagerById)
router.post('/managers', requireAdmin, createManager)
router.delete('/managers/:id', requireAdmin, deleteManagerWithCascade)
router.put('/managers/:id', updateManagerById)

// 更新经理团队名称
router.put(
  '/managers/:id/team-name',
  requireAuth,
  resourcePermission({
    resourceType: 'manager',
    action: 'update',
    adminOverride: true
  }),
  updateManagerTeamName
)

// 经理登录相关
router.post('/managers/login', loginLimiter, managerLogin)
router.post('/managers/sms/send', smsLimiter, sendManagerSmsCode)
router.post('/managers/sms/login', managerSmsLogin)

// 经理验证
router.get('/managers/:id/verify', verifyManagerById)

// 经理密码设置
router.post('/managers/password/set', setManagerPassword)

export default router
