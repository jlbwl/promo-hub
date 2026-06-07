import { IRepository } from '../../shared/Repository.js'
import { User } from '../entities/User.js'

/**
 * 用户仓储接口
 */
export interface IUserRepository extends IRepository<User, string> {
  findByPhone(phone: string): Promise<User | null>
  findByManagerId(managerId: string): Promise<User[]>
  findAll(page?: number, pageSize?: number): Promise<{ list: User[], total: number }>
  existsByPhone(phone: string): Promise<boolean>
}
