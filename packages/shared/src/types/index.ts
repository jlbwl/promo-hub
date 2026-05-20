/**
 * 通用类型定义 - 与后端实现保持一致
 */

// ============ 用户角色 ============
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}

// ============ 产品相关 ============
export interface Product {
  id: string
  title: string
  description: string
  coverImage: string
  images?: string[]
  price: number
  originalPrice?: number
  category: string
  categoryId?: string
  categoryNameSnapshot?: string
  status: 'draft' | 'published' | 'archived'
  managerId?: string
  stock?: number
  options?: any[]
  publishedBy?: string
  publishedAt?: string
  offlineReason?: string
  offlineAt?: string
  requireName?: boolean
  requirePhone?: boolean
  createdAt: string
  updatedAt?: string
}

export interface ProductCategory {
  id: string
  name: string
  value: string
  sort: number
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

// ============ 用户相关 ============
export interface User {
  id: string
  name: string
  phone: string
  avatar?: string
  role: UserRole
  status: 'active' | 'inactive' | 'banned'
  teamName?: string
  managerId?: string
  password?: string
  createdAt: string
  updatedAt?: string
}

export interface Manager extends User {
  role: UserRole
  username?: string
  totalCommission?: number
  managedUserCount?: number
}

// ============ 员工相关 ============
export interface Employee {
  id: string
  userId: string
  phone: string
  password: string
  nickname?: string
  expiresAt?: string
  status: 'active' | 'inactive' | 'expired'
  createdAt: string
  updatedAt?: string
}

// ============ 订单相关 ============
export interface Order {
  id: string
  productId: string
  userId: string
  managerId: string
  productName: string
  productPrice: number
  optionLabel?: string
  redirectUrl?: string
  userName?: string
  userPhone?: string
  teamName?: string
  fundAccount?: string
  status: 'pending' | 'approved' | 'pending_payment' | 'settled' | 'rejected'
  reviewedAt?: string
  rejectReason?: string
  addedToPaymentAt?: string
  settledAt?: string
  transferredFromManager?: string
  transferredAt?: string
  managedBy?: string
  deleted?: boolean
  deletedAt?: string
  createdAt: string
}

// ============ 购物车相关 ============
export interface CartItem {
  id: string
  userId: string
  managerId?: string
  productId: string
  productName: string
  productPrice: number
  coverImage: string
  optionLabel?: string
  redirectUrl?: string
  addedAt: string
}

// ============ 佣金相关 ============
export enum CommissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
}

export interface Commission {
  id: string
  orderId?: string
  userId: string
  managerId?: string
  productId?: string
  productName?: string
  amount: number
  status: CommissionStatus
  approvedBy?: string
  approvedAt?: string
  paidAt?: string
  userName?: string
  productTitle?: string
  createdAt: string
  updatedAt?: string
}

export interface CommissionSummary {
  total: number
  pending: number
  approved?: number
  paid: number
}

// ============ 通用 ============
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages?: number
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface LoginParams {
  phone: string
  password: string
}

export interface LoginResult {
  token?: string
  refreshToken?: string
  user: User
}

// ============ 订单统计 ============
export interface OrderStats {
  total: number
  pending: number
  approved: number
  pendingPayment: number
  settled: number
  rejected: number
}
