/**
 * 用户查询 - CQRS 模式
 * 查询可以直接从基础设施层获取 DTO，无需经过领域层
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
}

/**
 * 用户查询响应 DTO - 用于 CQRS 查询侧
 */
export interface UserDTO {
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

export interface UserListDTO {
  list: UserDTO[]
  total: number
  page: number
  pageSize: number
}
