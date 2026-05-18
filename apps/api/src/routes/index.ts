import { Router } from 'express'
import adminRoutes from './admin.routes.js'
import managerRoutes from './manager.routes.js'

const router: Router = Router()

// 挂载各个模块路由
router.use(adminRoutes)
router.use(managerRoutes)

export default router
