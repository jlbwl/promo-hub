import { Router } from 'express'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProductById,
  deleteProductById
} from '../controllers/product.controller.js'

const router: Router = Router()

router.get('/products', getProducts)
router.get('/products/:id', getProductById)
router.post('/products', createProduct)
router.put('/products/:id', updateProductById)
router.delete('/products/:id', deleteProductById)

export default router
