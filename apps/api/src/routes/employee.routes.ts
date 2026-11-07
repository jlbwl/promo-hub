import { Router } from 'express'
import { loginLimiter } from '../middleware/rateLimit.js'
import { requireUser, requireAuth } from '../middleware/auth.js'
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  deleteEmployeeById,
  updateEmployeeById,
  employeeLogin,
  validateEmployee,
} from '../controllers/employee.controller.js'

const router: Router = Router()

// 员工子账户管理：仅主账户（user）或管理员可操作
router.post('/employees', requireUser, createEmployee)
router.get('/employees', requireUser, getEmployees)
router.get('/employees/:id', requireUser, getEmployeeById)
router.put('/employees/:id', requireUser, updateEmployeeById)
router.delete('/employees/:id', requireUser, deleteEmployeeById)

// 员工登录验证
router.post('/employees/login', loginLimiter, employeeLogin)
router.post('/employees/validate', requireAuth, validateEmployee)

export default router
