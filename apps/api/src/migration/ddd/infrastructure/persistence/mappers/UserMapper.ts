import { User } from '../../../../domain/user/entities/User.js'

/**
 * 用户 Mapper - 负责数据库模型与领域模型之间的转换
 * 隔离数据库结构变化对领域模型的影响
 */
export class UserMapper {
  /**
   * 将数据库模型转换为领域模型
   */
  static toDomain(dbUser: any): User {
    return User.fromPersistence(dbUser)
  }

  /**
   * 将领域模型转换为数据库模型
   */
  static toPersistence(domainUser: User): any {
    return domainUser.toLegacyFormat()
  }

  /**
   * 将领域模型转换为安全 DTO（用于 API 响应）
   */
  static toSafeDTO(domainUser: User): any {
    return domainUser.toSafeFormat()
  }
}
