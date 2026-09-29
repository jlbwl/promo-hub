import type { OrderStats, User } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'
import type { OrderRow } from './types.js'

// ============ Orders ============

export async function readOrders(): Promise<OrderRow[]> {
  const orders = await readFileData<OrderRow>('orders')
  return orders.filter((o) => !o.deleted)
}

export async function writeOrders(orders: OrderRow[]): Promise<void> {
  writeFileData('orders', orders)
}

export async function readOrder(id: string): Promise<OrderRow | null> {
  const orders = await readFileData<OrderRow>('orders')
  return orders.find((o) => o.id === id && !o.deleted) || null
}

// 优化的订单统计
export async function getOrderStats(managerId?: string): Promise<OrderStats> {
  const orders = await readOrders()
  let filtered = orders
  if (managerId) {
    filtered = orders.filter((o) => o.managerId === managerId)
  }
  return {
    total: filtered.length,
    pending: filtered.filter((o) => o.status === 'pending').length,
    approved: filtered.filter((o) => o.status === 'approved').length,
    pendingPayment: filtered.filter((o) => o.status === 'pending_payment').length,
    settled: filtered.filter((o) => o.status === 'settled').length,
    rejected: filtered.filter((o) => o.status === 'rejected').length,
  }
}

export async function readDeletedOrders(userId?: string): Promise<OrderRow[]> {
  const orders = await readFileData<OrderRow>('orders')
  let filtered = orders.filter((o) => o.deleted)
  if (userId) {
    filtered = filtered.filter((o) => o.userId === userId)
  }
  return filtered.sort((a, b) => new Date(b.deletedAt as string).getTime() - new Date(a.deletedAt as string).getTime())
}

export async function insertOrder(o: OrderRow): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  orders.push(o)
  await writeOrders(orders)
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  const updated = orders.map((o) => {
    if (o.id === id) {
      return { ...o, deleted: 1, deletedAt: new Date().toISOString() }
    }
    return o
  })
  await writeOrders(updated)
}

export async function restoreOrder(id: string): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  const updated = orders.map((o) => {
    if (o.id === id) {
      return { ...o, deleted: 0, deletedAt: null }
    }
    return o
  })
  await writeOrders(updated)
}

export async function updateOrder(id: string, fields: Record<string, unknown>): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  const updated = orders.map((o) => {
    if (o.id === id) {
      return { ...o, ...fields }
    }
    return o
  })
  await writeOrders(updated)
}

// ============ 优化的订单查询方法 ============

export async function getOrdersPaginated(params: {
  userId?: string
  managerId?: string
  employeeId?: string
  status?: string
  managedBy?: string
  userPhone?: string
  teamName?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<{ list: OrderRow[]; total: number }> {
  let orders = await readOrders()

  if (params.userId) {
    orders = orders.filter((o) => o.userId === params.userId)
  }
  if (params.userPhone) {
    orders = orders.filter((o) => o.userPhone === params.userPhone)
  }
  if (params.teamName) {
    orders = orders.filter((o) => o.teamName === params.teamName)
  }
  if (params.managerId) {
    orders = orders.filter((o) => o.managerId === params.managerId)
  }
  if (params.employeeId) {
    orders = orders.filter((o) => o.employeeId === params.employeeId)
  }
  if (params.status) {
    orders = orders.filter((o) => o.status === params.status)
  }
  if (params.managedBy) {
    orders = orders.filter((o) => o.managedBy === params.managedBy)
  }
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase()
    orders = orders.filter((o) =>
      (o.productName?.toLowerCase()?.includes(keyword)) ||
      (o.userName?.toLowerCase()?.includes(keyword)) ||
      (o.userPhone?.includes(keyword))
    )
  }

  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = orders.length
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
  const start = (page - 1) * pageSize
  const list = orders.slice(start, start + pageSize)

  const userIds = Array.from(new Set(list.map((o) => o.userId).filter(Boolean)))
  const usersMap = new Map<string, string | undefined>()
  if (userIds.length > 0) {
    const users = await readFileData<User>('users')
    users.forEach((user) => {
      usersMap.set(user.id, user.teamName)
    })
  }

  return {
    list: list.map((order) => ({
      ...order,
      productPrice: Number(order.productPrice) || 0,
      teamName: order.teamName || usersMap.get(order.userId) || '',
    })),
    total,
  }
}
