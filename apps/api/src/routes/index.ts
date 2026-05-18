import { Router } from 'express'
import adminRoutes from './admin.routes.js'
import managerRoutes from './manager.routes.js'
import userRoutes from './user.routes.js'
import employeeRoutes from './employee.routes.js'
import productRoutes from './product.routes.js'
import orderRoutes from './order.routes.js'

const router: Router = Router()

// 挂载各个模块路由
router.use(adminRoutes)
router.use(managerRoutes)
router.use(userRoutes)
router.use(employeeRoutes)
router.use(productRoutes)
router.use(orderRoutes)

export default router
