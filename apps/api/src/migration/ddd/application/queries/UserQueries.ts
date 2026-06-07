/**
 * 用户查询 - CQRS Query
 */
export interface GetUserByIdQuery {
  userId: string
}

export interface GetUserByPhoneQuery {
  phone: string
}

export interface ListUsersQuery {
  page?: number
  pageSize?: number
  role?: string
  status?: string
  managerId?: string
  keyword?: string
  teamName?: string
}

/**
 * 用户查询结果 DTO
 */
export interface UserQueryResult {
  id: string
  name: string
  phone: string
  role: string
  status: string
  avatar?: string
  teamName?: string
  managerId?: string
  createdAt: string
  updatedAt?: string
}

export interface UserListQueryResult {
  list: UserQueryResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
