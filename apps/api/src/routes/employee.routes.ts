import { Router } from 'express'
import { loginLimiter } from '../middleware/rateLimit.js'
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

// 员工子账户管理
router.post('/employees', createEmployee)
router.get('/employees', getEmployees)
router.get('/employees/:id', getEmployeeById)
router.put('/employees/:id', updateEmployeeById)
router.delete('/employees/:id', deleteEmployeeById)

// 员工登录验证
router.post('/employees/login', loginLimiter, employeeLogin)
router.post('/employees/validate', validateEmployee)

export default router
