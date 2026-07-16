import { injectable } from 'tsyringe'
import { User } from '../../../../domain/user/entities/User.js'
import { IUserRepository } from '../../../../domain/user/repositories/UserRepository.js'
import { UserMapper } from '../mappers/UserMapper.js'
import * as data from '../../../../../data/index.js'
import logger from '../../../../../utils/logger.js'

/**
 * 用户仓储实现 - 适配现有数据访问层
 * 使用现有的 readUsers/writeUsers 等函数，保持完全兼容性
 */
@injectable()
export class UserRepositoryImpl implements IUserRepository {
  async save(user: User): Promise<void> {
    const users = await data.readUsers()
    const userData = UserMapper.toPersistence(user)
    
    const index = users.findIndex((u: any) => u.id === user.id)
    if (index > -1) {
      users[index] = userData
    } else {
      users.push(userData)
    }
    
    await data.writeUsers(users)
    logger.debug(`User saved: ${user.id}`)

    // 处理领域事件（简化处理）
    for (const event of user.domainEvents) {
      logger.info(`Domain event: ${event.eventName}`, { event })
    }
    user.clearDomainEvents()
  }

  async findById(id: string): Promise<User | null> {
    const users = await data.readUsers()
    const userData = users.find((u: any) => u.id === id)
    return userData ? UserMapper.toDomain(userData) : null
  }

  async findByPhone(phone: string): Promise<User | null> {
    const users = await data.readUsers()
    const userData = users.find((u: any) => u.phone === phone)
    return userData ? UserMapper.toDomain(userData) : null
  }

  async findByManagerId(managerId: string): Promise<User[]> {
    const users = await data.readUsers()
    return users
      .filter((u: any) => u.managerId === managerId)
      .map((u: any) => UserMapper.toDomain(u))
  }

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    filters: any = {}
  ): Promise<{ list: User[], total: number }> {
    const users = await data.readUsers()
    
    let filteredUsers = users
    
    // 应用过滤条件
    if (filters.role) {
      filteredUsers = filteredUsers.filter((u: any) => u.role === filters.role)
    }
    if (filters.status) {
      filteredUsers = filteredUsers.filter((u: any) => u.status === filters.status)
    }
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      filteredUsers = filteredUsers.filter((u: any) => 
        (u.nickname || u.name || '').toLowerCase().includes(keyword) ||
        (u.phone || '').includes(keyword) ||
        (u.teamName || '').toLowerCase().includes(keyword)
      )
    }
    if (filters.teamName) {
      filteredUsers = filteredUsers.filter((u: any) => u.teamName === filters.teamName)
    }

    // 分页
    const total = filteredUsers.length
    const start = (page - 1) * pageSize
    const pagedUsers = filteredUsers.slice(start, start + pageSize)
    
    return {
      list: pagedUsers.map((u: any) => UserMapper.toDomain(u)),
      total,
    }
  }

  async existsById(id: string): Promise<boolean> {
    const users = await data.readUsers()
    return users.some((u: any) => u.id === id)
  }

  async existsByPhone(phone: string): Promise<boolean> {
    const users = await data.readUsers()
    return users.some((u: any) => u.phone === phone)
  }

  async existsByTeamName(teamName: string): Promise<boolean> {
    if (!teamName) return false
    const users = await data.readUsers()
    return users.some((u: any) => u.teamName === teamName)
  }

  async delete(id: string): Promise<void> {
    const users = await data.readUsers()
    const filtered = users.filter((u: any) => u.id !== id)
    await data.writeUsers(filtered)
    logger.debug(`User deleted: ${id}`)
  }
}
