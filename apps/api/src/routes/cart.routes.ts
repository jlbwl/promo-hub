import { Router } from 'express'
import {
  getCartItems,
  getManagerCart,
  addItemToCart,
  removeItemFromCart,
  checkProductInCart,
} from '../controllers/cart.controller.js'

const router: Router = Router()

router.get('/cart', getCartItems)
router.get('/manager/cart', getManagerCart)
router.post('/cart', addItemToCart)
router.delete('/cart/:id', removeItemFromCart)
router.get('/cart/check', checkProductInCart)

export default router
