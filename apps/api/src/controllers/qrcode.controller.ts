import { Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { getErrorMessage } from '@promo/shared'
import { readQrCodes, readQrCodeById, insertQrCode, updateQrCode, deleteQrCode, setDefaultQrCode, readDefaultQrCode } from '../data/index.js'
import { sendSuccess, sendError } from '../utils/response.js'
import { logAdminOperation } from '../utils/auditLog.js'
import { buildAuditDetail, type AuditChangeInput } from '../utils/auditDetail.js'

/** 二维码在日志中的可读名称：优先中心文字，其次链接 */
const qrCodeName = (qr?: { centerText?: string; url?: string; id?: string } | null): string =>
  (qr?.centerText || qr?.url || qr?.id || '-')

/** 记录二维码日志；dataUrl（base64 图片）体积大，不写入日志 */
async function logQrCodeOperation(
  req: Request,
  info: {
    operationType: 'create' | 'update' | 'delete'
    targetId: string
    targetName: string
    summary: string
    meta: Record<string, string | number | null | undefined>
    changes?: AuditChangeInput[]
  }
): Promise<void> {
  await logAdminOperation(req, {
    operationType: info.operationType,
    targetType: 'qrcode',
    targetId: info.targetId,
    targetName: info.targetName,
    detail: buildAuditDetail({
      summary: info.summary,
      meta: info.meta,
      changes: info.changes,
    }),
  })
}

export const getQrCodes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const qrCodes = await readQrCodes()
    sendSuccess(res, qrCodes, '获取成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}

export const getDefaultQrCode = async (_req: Request, res: Response): Promise<void> => {
  try {
    const qrCode = await readDefaultQrCode()
    sendSuccess(res, qrCode || {}, '获取成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}

export const createQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, dataUrl, centerText, topText, isDefault } = req.body

    if (!url || !dataUrl) {
      return sendError(res, '缺少必要参数', 400)
    }

    // O13：随机段改用 crypto.randomUUID，降低碰撞与可预测性
    const id = `qrcode_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`

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

    await logQrCodeOperation(req, {
      operationType: 'create',
      targetId: id,
      targetName: qrCodeName({ centerText, url, id }),
      summary: `创建二维码「${qrCodeName({ centerText, url, id })}」`,
      meta: {
        二维码ID: id,
        链接: url,
        中心文字: centerText || '-',
        顶部文字: topText || '-',
        是否默认: isDefault ? '是' : '否',
      },
    })

    sendSuccess(res, { id }, '创建成功')
  } catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      sendError(res, '该网址的二维码已存在', 409)
    } else {
      sendError(res, getErrorMessage(error, '创建失败'), 500)
    }
  }
}

export const updateQrCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { url, dataUrl, centerText, topText, isDefault } = req.body

    // 更新前快照用于记录旧值；读取失败时旧值以 '-' 呈现
    let before: { id?: string; url?: string; centerText?: string; topText?: string; isDefault?: boolean } | null = null
    try {
      before = await readQrCodeById(id)
    } catch {
      // 旧值读取失败不影响更新流程
    }

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

    const changes: AuditChangeInput[] = []
    if (url !== undefined && before?.url !== url) {
      changes.push({ field: 'url', label: '链接', from: before?.url, to: url })
    }
    if (centerText !== undefined && before?.centerText !== centerText) {
      changes.push({ field: 'centerText', label: '中心文字', from: before?.centerText, to: centerText })
    }
    if (topText !== undefined && before?.topText !== topText) {
      changes.push({ field: 'topText', label: '顶部文字', from: before?.topText, to: topText })
    }
    if (isDefault !== undefined && Boolean(before?.isDefault) !== Boolean(isDefault)) {
      changes.push({
        field: 'isDefault',
        label: '是否默认',
        from: before?.isDefault ? '是' : '否',
        to: isDefault ? '是' : '否',
      })
    }

    const name = qrCodeName({ centerText: centerText || before?.centerText, url: url || before?.url, id })
    await logQrCodeOperation(req, {
      operationType: 'update',
      targetId: id,
      targetName: name,
      summary: `更新二维码「${name}」${changes.length ? `（${changes.length} 项变更）` : ''}`,
      meta: {
        二维码ID: id,
        链接: url || before?.url || '-',
        中心文字: centerText || before?.centerText || '-',
        顶部文字: topText || before?.topText || '-',
        是否默认: isDefault ? '是' : '否',
      },
      changes,
    })

    sendSuccess(res, null, '更新成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '更新失败'), 500)
  }
}

export const deleteQrCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)

    let before: { id?: string; url?: string; centerText?: string; topText?: string; isDefault?: boolean } | null = null
    try {
      before = await readQrCodeById(id)
    } catch {
      // 读取失败仍允许删除，日志以 ID 作为兜底名称
    }

    await deleteQrCode(id)

    await logQrCodeOperation(req, {
      operationType: 'delete',
      targetId: id,
      targetName: qrCodeName(before) || id,
      summary: `删除二维码「${qrCodeName(before) || id}」`,
      meta: {
        二维码ID: id,
        链接: before?.url || '-',
        中心文字: before?.centerText || '-',
        顶部文字: before?.topText || '-',
        是否默认: before?.isDefault ? '是' : '否',
      },
    })

    sendSuccess(res, null, '删除成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '删除失败'), 500)
  }
}

export const applyQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id)

    let before: { id?: string; url?: string; centerText?: string; isDefault?: boolean } | null = null
    try {
      before = await readQrCodeById(id)
    } catch {
      // 旧值读取失败不影响设置默认
    }

    await setDefaultQrCode(id)

    await logQrCodeOperation(req, {
      operationType: 'update',
      targetId: id,
      targetName: qrCodeName(before) || id,
      summary: `设为默认二维码「${qrCodeName(before) || id}」`,
      meta: {
        二维码ID: id,
        链接: before?.url || '-',
        中心文字: before?.centerText || '-',
        是否默认: '是',
      },
      changes: before && !before.isDefault
        ? [{ field: 'isDefault', label: '是否默认', from: '否', to: '是' }]
        : [],
    })

    sendSuccess(res, null, '应用成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '应用失败'), 500)
  }
}