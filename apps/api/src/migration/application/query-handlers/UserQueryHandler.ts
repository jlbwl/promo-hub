import { injectable, inject } from 'tsyringe'
import * as data from '../../../data.js'
import {
  GetUserByIdQuery,
  GetUserByPhoneQuery,
  ListUsersQuery,
  UserDTO,
  UserListDTO
} from '../queries/UserQueries.js'

/**
 * 用户查询处理器
 * CQRS 查询侧：直接从基础设施层获取数据，绕过领域层，优化查询性能
 */
@injectable()
export class UserQueryHandler {
  /**
   * 根据 ID 查询用户
   */
  async handleGetById(query: GetUserByIdQuery): Promise<UserDTO | null> {
    const users = await data.readUsers()
    const user = users.find(u => u.id === query.userId)
    
    if (!user) {
      return null
    }
    
    return this.toDTO(user)
  }

  /**
   * 根据手机号查询用户
   */
  async handleGetByPhone(query: GetUserByPhoneQuery): Promise<UserDTO | null> {
    const users = await data.readUsers()
    const user = users.find(u => u.phone === query.phone)
    
    if (!user) {
      return null
    }
    
    return this.toDTO(user)
  }

  /**
   * 查询用户列表
   */
  async handleList(query: ListUsersQuery): Promise<UserListDTO> {
    const users = await data.readUsers()
    
    // 过滤（这里简化处理，实际项目可根据更多条件过滤）
    let filteredUsers = users
    if (query.role) {
      filteredUsers = filteredUsers.filter(u => u.role === query.role)
    }
    if (query.status) {
      filteredUsers = filteredUsers.filter(u => u.status === query.status)
    }
    if (query.managerId) {
      filteredUsers = filteredUsers.filter(u => u.managerId === query.managerId)
    }
    
    // 分页
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const start = (page - 1) * pageSize
    const paginatedUsers = filteredUsers.slice(start, start + pageSize)
    
    return {
      list: paginatedUsers.map(u => this.toDTO(u)),
      total: filteredUsers.length,
      page,
      pageSize,
    }
  }

  /**
   * 转换数据库模型为查询 DTO
   */
  private toDTO(dbModel: any): UserDTO {
    // 手机号脱敏
    const maskPhone = (phone: string) => {
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    }
    
    return {
      id: dbModel.id,
      name: dbModel.name,
      phone: maskPhone(dbModel.phone),
      role: dbModel.role,
      status: dbModel.status,
      avatar: dbModel.avatar,
      teamName: dbModel.teamName,
      managerId: dbModel.managerId,
      createdAt: dbModel.createdAt,
      updatedAt: dbModel.updatedAt,
    }
  }
}
