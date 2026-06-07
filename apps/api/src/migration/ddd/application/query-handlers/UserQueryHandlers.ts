import { injectable, inject } from 'tsyringe'
import { IUserRepository } from '../../domain/user/repositories/UserRepository.js'
import { UserMapper } from '../../infrastructure/persistence/mappers/UserMapper.js'
import {
  GetUserByIdQuery,
  GetUserByPhoneQuery,
  ListUsersQuery,
  UserQueryResult,
  UserListQueryResult
} from '../queries/UserQueries.js'
import * as data from '../../../../data.js'

/**
 * 用户查询处理器
 * CQRS 查询侧 - 可以直接查询数据，不需要经过领域模型，优化性能
 */
@injectable()
export class UserQueryHandlers {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  /**
   * 根据 ID 查询用户（绕过领域模型优化）
   */
  async handleGetById(query: GetUserByIdQuery): Promise<UserQueryResult | null> {
    const users = await data.readUsers()
    const user = users.find((u: any) => u.id === query.userId)
    
    if (!user) {
      return null
    }
    
    return this.toQueryResult(user)
  }

  /**
   * 根据手机号查询用户
   */
  async handleGetByPhone(query: GetUserByPhoneQuery): Promise<UserQueryResult | null> {
    const users = await data.readUsers()
    const user = users.find((u: any) => u.phone === query.phone)
    
    if (!user) {
      return null
    }
    
    return this.toQueryResult(user)
  }

  /**
   * 查询用户列表
   */
  async handleList(query: ListUsersQuery): Promise<UserListQueryResult> {
    const users = await data.readUsers()
    
    // 过滤
    let filteredUsers = users
    if (query.role) {
      filteredUsers = filteredUsers.filter((u: any) => u.role === query.role)
    }
    if (query.status) {
      filteredUsers = filteredUsers.filter((u: any) => u.status === query.status)
    }
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase()
      filteredUsers = filteredUsers.filter((u: any) => 
        (u.nickname || u.name || '').toLowerCase().includes(keyword) ||
        (u.phone || '').includes(keyword) ||
        (u.teamName || '').toLowerCase().includes(keyword)
      )
    }
    if (query.teamName) {
      filteredUsers = filteredUsers.filter((u: any) => u.teamName === query.teamName)
    }
    if (query.managerId) {
      filteredUsers = filteredUsers.filter((u: any) => u.managerId === query.managerId)
    }

    // 排序
    filteredUsers.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // 分页
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const total = filteredUsers.length
    const start = (page - 1) * pageSize
    const pagedUsers = filteredUsers.slice(start, start + pageSize)
    
    return {
      list: pagedUsers.map((u: any) => this.toQueryResult(u)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 转换为查询结果 DTO
   */
  private toQueryResult(dbUser: any): UserQueryResult {
    const maskPhone = (phone: string) => {
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    }
    
    return {
      id: dbUser.id,
      name: dbUser.nickname || dbUser.name,
      phone: maskPhone(dbUser.phone),
      role: dbUser.role,
      status: dbUser.status,
      avatar: dbUser.avatar,
      teamName: dbUser.teamName,
      managerId: dbUser.managerId,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    }
  }
}
