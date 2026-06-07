import { User } from '../entities/User.js'

/**
 * 用户仓储接口
 */
export interface IUserRepository {
  save(user: User): Promise<void>
  findById(id: string): Promise<User | null>
  findByPhone(phone: string): Promise<User | null>
  findByManagerId(managerId: string): Promise<User[]>
  findAll(page?: number, pageSize?: number, filters?: any): Promise<{ list: User[], total: number }>
  existsById(id: string): Promise<boolean>
  existsByPhone(phone: string): Promise<boolean>
  existsByTeamName(teamName: string): Promise<boolean>
  delete(id: string): Promise<void>
}
