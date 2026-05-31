import { Router } from 'express'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById
} from '../controllers/product.controller.js'
import { requireManager, requireAuth } from '../middleware/auth.js'
import { resourcePermission } from '../middleware/resourcePermission.js'

const router: Router = Router()

// 获取产品列表 - 允许所有已认证用户访问
router.get('/products', requireAuth, getProducts)

// 获取单个产品详情 - 使用资源级权限验证
router.get(
  '/products/:id',
  requireAuth,
  resourcePermission({
    resourceType: 'product',
    action: 'read',
    adminOverride: true
  }),
  getProductById
)

// 创建产品 - 只有经理可以创建
router.post(
  '/products',
  requireManager,
  createProduct
)

// 更新产品 - 使用资源级权限验证
router.put(
  '/products/:id',
  requireAuth,
  resourcePermission({
    resourceType: 'product',
    action: 'update',
    adminOverride: true
  }),
  updateProductById
)

// 删除产品 - 使用资源级权限验证
router.delete(
  '/products/:id',
  requireAuth,
  resourcePermission({
    resourceType: 'product',
    action: 'delete',
    adminOverride: true
  }),
  deleteProductById
)

export default router
