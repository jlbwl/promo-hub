import { Router } from 'express'
import { getProductSharePage } from '../controllers/share.controller.js'

const router: Router = Router()

// 分享落地页（公开访问，供微信等 IM 抓取生成链接卡片）
router.get('/share/product/:id', getProductSharePage)

export default router
