import type { Request } from 'express'
import { getErrorMessage } from '@promo/shared'
import { insertOperationLog } from '../data/index.js'
import logger from './logger.js'

export interface AdminOperationInfo {
  operationType: 'create' | 'update' | 'delete' | 'offline'
  targetType: 'user' | 'manager' | 'product' | 'order' | 'category' | 'qrcode' | 'admin' | 'customer'
  targetId: string
  targetName: string
  reason?: string
  detail?: string
}

/**
 * 写入管理后台操作日志。
 * 审计写入失败不阻塞主业务，仅记录错误日志便于排查。
 */
export async function logAdminOperation(req: Request, info: AdminOperationInfo): Promise<void> {
  const admin = req.user
  try {
    await insertOperationLog({
      adminId: admin?.id || '',
      adminPhone: admin?.phone || '',
      adminName: admin?.nickname || '未知管理员',
      ...info,
    })
  } catch (error) {
    logger.error('[审计日志] 写入失败', { error: getErrorMessage(error), ...info })
  }
}
