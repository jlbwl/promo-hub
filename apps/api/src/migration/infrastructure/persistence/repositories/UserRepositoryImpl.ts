import { injectable } from 'tsyringe'
import { User } from '../../../domain/user/entities/User'
import { IUserRepository } from '../../../domain/user/repositories/UserRepository'
import { UserMapper } from '../mappers/UserMapper'
import * as data from '../../../data'

/**
 * 用户仓储实现 - 适配现有的数据访问层
 */
@injectable()
export class UserRepositoryImpl implements IUserRepository {
  async save(user: User): Promise<void> {
    const users = await data.readUsers()
    const userData = UserMapper.toPersistence(user)
    
    const index = users.findIndex(u => u.id === user.id)
    if (index > -1) {
      users[index] = userData
    } else {
      users.push(userData)
    }
    
    await data.writeUsers(users)
  }

  async findById(id: string): Promise<User | null> {
    const users = await data.readUsers()
    const userData = users.find(u => u.id === id)
    return userData ? UserMapper.toDomain(userData) : null
  }

  async findByPhone(phone: string): Promise<User | null> {
    const users = await data.readUsers()
    const userData = users.find(u => u.phone === phone)
    return userData ? UserMapper.toDomain(userData) : null
  }

  async findByManagerId(managerId: string): Promise<User[]> {
    const users = await data.readUsers()
    return users
      .filter(u => u.managerId === managerId)
      .map(u => UserMapper.toDomain(u))
  }

  async findAll(page?: number, pageSize?: number): Promise<{ list: User[], total: number }> {
    const users = await data.readUsers()
    let list = users
    
    if (page && pageSize) {
      const start = (page - 1) * pageSize
      list = users.slice(start, start + pageSize)
    }
    
    return {
      list: list.map(u => UserMapper.toDomain(u)),
      total: users.length,
    }
  }

  async delete(id: string): Promise<void> {
    const users = await data.readUsers()
    const filtered = users.filter(u => u.id !== id)
    await data.writeUsers(filtered)
  }

  async exists(id: string): Promise<boolean> {
    const users = await data.readUsers()
    return users.some(u => u.id === id)
  }

  async existsByPhone(phone: string): Promise<boolean> {
    const users = await data.readUsers()
    return users.some(u => u.phone === phone)
  }
}
