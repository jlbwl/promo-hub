import { injectable, inject } from 'tsyringe'
import { User } from '../../domain/user/entities/User.js'
import { IUserRepository } from '../../domain/user/repositories/UserRepository.js'
import { CreateUserCommand } from '../commands/CreateUserCommand.js'
import { UserRole } from '../../domain/user/value-objects/UserRole.js'
import { ConflictError } from '../../domain/shared/errors/DomainError.js'

/**
 * 创建用户命令处理器
 * 负责触发领域模型的行为和发布领域事件
 */
@injectable()
export class CreateUserCommandHandler {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  /**
   * 处理创建用户命令
   * 一个用例对应一个事务边界
   */
  async handle(command: CreateUserCommand): Promise<User> {
    // 1. 业务校验：检查手机号是否已存在
    const exists = await this.userRepository.existsByPhone(command.phone)
    if (exists) {
      throw new ConflictError('该手机号已被注册')
    }

    // 2. 生成唯一 ID（实际项目可使用 UUID 库）
    const userId = this.generateId()

    // 3. 通过工厂方法创建聚合根
    const role = command.role ? (command.role as UserRole) : UserRole.USER
    const user = User.register(
      userId,
      command.name,
      command.phone,
      command.password,
      role,
      command.teamName,
      command.managerId
    )

    // 4. 保存聚合根
    await this.userRepository.save(user)

    // 5. 处理领域事件（这里简化处理，实际可发布到消息队列）
    for (const event of user.domainEvents) {
      console.log(`[DomainEvent] ${event.eventName}`, event)
    }

    // 6. 清除已处理的领域事件
    user.clearDomainEvents()

    return user
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }
}
