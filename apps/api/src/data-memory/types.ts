import type { Order } from '@promo/shared'

// ============ 内存行类型（与 DB 版数据层结构保持一致） ============

// 文件存储中订单的 deleted 使用 0/1 标记，deletedAt 可能为 null
// employeeId/sharerId 为订单表实际存在但 shared Order 类型未覆盖的字段
// （导出供 DB 版数据层 data/*.ts 复用，import type 不产生运行时耦合）
export type OrderRow = Omit<Order, 'deleted' | 'deletedAt'> & {
  employeeId?: string
  sharerId?: string
  deleted?: number | boolean
  deletedAt?: string | null
}

export interface AdminRow {
  id: string
  phone: string
  password: string
  name: string
  status: string
  [key: string]: unknown
}

export interface OperationLogRow {
  id: string
  adminId: string
  adminPhone: string
  adminName: string
  operationType: string
  targetType: string
  targetId: string
  targetName: string
  reason?: string
  detail?: string
  createdAt: string
}
