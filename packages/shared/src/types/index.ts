/**
 * 通用类型定义
 */

// ============ 用户角色 ============
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}

// ============ 用户相关 ============
export interface User {
  id: string
  name: string
  phone: string
  avatar?: string
  role: UserRole
  status: 'active' | 'inactive' | 'banned'
  createdAt: string
  updatedAt: string
}

export interface Manager extends User {
  role: UserRole.MANAGER
  totalCommission: number
  managedUserCount: number
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
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  publishedBy: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ProductCategory {
  id: string
  name: string
  icon?: string
  sort: number
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
  userId: string
  userName: string
  productId: string
  productTitle: string
  amount: number
  status: CommissionStatus
  approvedBy?: string
  approvedAt?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export interface CommissionSummary {
  total: number
  pending: number
  approved: number
  paid: number
}

// ============ 通用 ============
export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
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
  token: string
  refreshToken: string
  user: User
}
