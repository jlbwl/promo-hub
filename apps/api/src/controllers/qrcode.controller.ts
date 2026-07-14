import { Request, Response } from 'express'
import { readQrCodes, insertQrCode, updateQrCode, deleteQrCode, setDefaultQrCode, readDefaultQrCode } from '../data.js'
import { sendSuccess, sendError } from '../utils/response.js'

export const getQrCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const qrCodes = await readQrCodes()
    sendSuccess(res, qrCodes, '获取成功')
  } catch (error: any) {
    sendError(res, error.message || '获取失败', 500)
  }
}

export const getDefaultQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const qrCode = await readDefaultQrCode()
    sendSuccess(res, qrCode || {}, '获取成功')
  } catch (error: any) {
    sendError(res, error.message || '获取失败', 500)
  }
}

export const createQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, dataUrl, centerText, topText, isDefault } = req.body

    if (!url || !dataUrl) {
      return sendError(res, '缺少必要参数', 400)
    }

    const id = `qrcode_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    if (isDefault) {
      await setDefaultQrCode(id)
    }

    await insertQrCode({
      id,
      url,
      dataUrl,
      centerText,
      topText,
      isDefault: isDefault || false
    })

    sendSuccess(res, { id }, '创建成功')
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      sendError(res, '该网址的二维码已存在', 409)
    } else {
      sendError(res, error.message || '创建失败', 500)
    }
  }
}

export const updateQrCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { url, dataUrl, centerText, topText, isDefault } = req.body

    if (isDefault) {
      await setDefaultQrCode(id)
    }

    await updateQrCode(id, {
      url,
      dataUrl,
      centerText,
      topText,
      isDefault: isDefault || false
    })

    sendSuccess(res, null, '更新成功')
  } catch (error: any) {
    sendError(res, error.message || '更新失败', 500)
  }
}

export const deleteQrCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)

    await deleteQrCode(id)

    sendSuccess(res, null, '删除成功')
  } catch (error: any) {
    sendError(res, error.message || '删除失败', 500)
  }
}

export const applyQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)

    await setDefaultQrCode(id)

    sendSuccess(res, null, '应用成功')
  } catch (error: any) {
    sendError(res, error.message || '应用失败', 500)
  }
}