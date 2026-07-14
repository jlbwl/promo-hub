import { Router } from 'express'
import { getQrCodes, getDefaultQrCode, createQrCode, updateQrCodeById, deleteQrCodeById, applyQrCode } from '../controllers/qrcode.controller.js'
import { requireAdmin } from '../middleware/auth.js'

const router: Router = Router()

router.get('/admin/qrcodes', requireAdmin, getQrCodes)
router.get('/admin/qrcodes/default', requireAdmin, getDefaultQrCode)
router.post('/admin/qrcodes', requireAdmin, createQrCode)
router.put('/admin/qrcodes/:id', requireAdmin, updateQrCodeById)
router.delete('/admin/qrcodes/:id', requireAdmin, deleteQrCodeById)
router.post('/admin/qrcodes/:id/apply', requireAdmin, applyQrCode)

export default router