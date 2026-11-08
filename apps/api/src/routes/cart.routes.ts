import { Router } from 'express'
import {
  getCartItems,
  getManagerCart,
  addItemToCart,
  removeItemFromCart,
  removeItemsFromCart,
  checkProductInCart,
} from '../controllers/cart.controller.js'
import { requireAuth, requireManager } from '../middleware/auth.js'

const router: Router = Router()

router.get('/cart', requireAuth, getCartItems)
// 经理下所有购物车：仅经理/管理员可查看（无前端调用，保留作内部接口）
router.get('/manager/cart', requireManager, getManagerCart)
router.post('/cart', requireAuth, addItemToCart)
router.delete('/cart/batch', requireAuth, removeItemsFromCart)
router.delete('/cart/:id', requireAuth, removeItemFromCart)
router.get('/cart/check', requireAuth, checkProductInCart)

export default router
