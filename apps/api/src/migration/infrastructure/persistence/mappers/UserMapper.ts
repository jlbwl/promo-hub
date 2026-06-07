import { User } from '../../../domain/user/entities/User'
import { UserRole, UserStatus } from '../../../domain/user/value-objects/UserRole'

/**
 * 用户 Mapper - 负责数据库模型与领域模型之间的转换
 * 防止数据库表结构变更污染领域模型
 */
export class UserMapper {
  /**
   * 将数据库模型转换为领域模型
   */
  static toDomain(dbModel: any): User {
    return User.fromPersistence(
      dbModel.id,
      dbModel.name,
      dbModel.phone,
      dbModel.password,
      dbModel.role as UserRole,
      dbModel.status as UserStatus,
      dbModel.avatar,
      dbModel.teamName,
      dbModel.managerId,
      dbModel.createdAt ? new Date(dbModel.createdAt) : undefined,
      dbModel.updatedAt ? new Date(dbModel.updatedAt) : undefined,
    )
  }

  /**
   * 将领域模型转换为数据库模型
   */
  static toPersistence(domainModel: User): any {
    return {
      id: domainModel.id,
      name: domainModel.name,
      phone: domainModel.phone.value,
      password: domainModel.password.hashedValue,
      role: domainModel.role,
      status: domainModel.status,
      avatar: domainModel.avatar,
      teamName: domainModel.teamName,
      managerId: domainModel.managerId,
      createdAt: domainModel.createdAt.toISOString(),
      updatedAt: domainModel.updatedAt?.toISOString(),
    }
  }

  /**
   * 将领域模型转换为简单的 DTO（用于 API 响应）
   */
  static toDTO(domainModel: User): any {
    return {
      id: domainModel.id,
      name: domainModel.name,
      phone: domainModel.phone.mask(),
      role: domainModel.role,
      status: domainModel.status,
      avatar: domainModel.avatar,
      teamName: domainModel.teamName,
      managerId: domainModel.managerId,
      createdAt: domainModel.createdAt.toISOString(),
      updatedAt: domainModel.updatedAt?.toISOString(),
    }
  }
}
