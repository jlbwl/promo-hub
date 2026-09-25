import { Router } from 'express'
import {
  getCartItems,
  getManagerCart,
  addItemToCart,
  removeItemFromCart,
  checkProductInCart,
} from '../controllers/cart.controller.js'
import { requireAuth } from '../middleware/auth.js'

const router: Router = Router()

router.get('/cart', requireAuth, getCartItems)
router.get('/manager/cart', requireAuth, getManagerCart)
router.post('/cart', requireAuth, addItemToCart)
router.delete('/cart/:id', requireAuth, removeItemFromCart)
router.get('/cart/check', requireAuth, checkProductInCart)

export default router
