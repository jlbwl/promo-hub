import { injectable, inject } from 'tsyringe'
import { User } from '../../domain/user/entities/User.js'
import { IUserRepository } from '../../domain/user/repositories/UserRepository.js'
import { UserRole } from '../../domain/user/value-objects/UserRole.js'
import { CreateUserDTO, UpdateUserDTO, ChangePasswordDTO } from '../dtos/CreateUserDTO.js'
import { NotFoundError, ConflictError } from '../../domain/shared/errors/DomainError.js'

/**
 * 用户应用服务 - 编排用户相关的用例
 */
@injectable()
export class UserApplicationService {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository,
  ) {}

  /**
   * 注册新用户
   */
  async registerUser(dto: CreateUserDTO): Promise<User> {
    // 检查手机号是否已存在
    const exists = await this.userRepository.existsByPhone(dto.phone)
    if (exists) {
      throw new ConflictError('该手机号已被注册')
    }

    // 生成 ID（实际项目可用 UUID 或其他方式）
    const userId = Date.now().toString(36) + Math.random().toString(36).substring(2)
    
    // 创建用户聚合
    const role = dto.role ? (dto.role as UserRole) : UserRole.USER
    const user = User.register(
      userId,
      dto.name,
      dto.phone,
      dto.password,
      role,
      dto.teamName,
      dto.managerId,
    )

    // 保存到仓储
    await this.userRepository.save(user)

    // 处理领域事件（这里简化处理，实际可发布到消息队列）
    for (const event of user.domainEvents) {
      console.log(`处理领域事件: ${event.eventName}`, event)
    }
    user.clearDomainEvents()

    return user
  }

  /**
   * 获取用户详情
   */
  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('User', userId)
    }
    return user
  }

  /**
   * 根据手机号查找用户
   */
  async getUserByPhone(phone: string): Promise<User | null> {
    return await this.userRepository.findByPhone(phone)
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, dto: UpdateUserDTO): Promise<User> {
    const user = await this.getUserById(userId)

    if (dto.name) {
      user.updateName(dto.name)
    }
    if (dto.avatar) {
      user.updateAvatar(dto.avatar)
    }
    if (dto.managerId) {
      user.assignManager(dto.managerId)
    }

    await this.userRepository.save(user)
    return user
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
    const user = await this.getUserById(userId)
    user.changePassword(dto.oldPassword, dto.newPassword)
    await this.userRepository.save(user)
  }

  /**
   * 禁用用户
   */
  async banUser(userId: string): Promise<User> {
    const user = await this.getUserById(userId)
    user.ban()
    await this.userRepository.save(user)
    return user
  }

  /**
   * 启用用户
   */
  async activateUser(userId: string): Promise<User> {
    const user = await this.getUserById(userId)
    user.activate()
    await this.userRepository.save(user)
    return user
  }

  /**
   * 获取用户列表（分页）
   */
  async getUsers(page?: number, pageSize?: number): Promise<{ list: User[], total: number }> {
    return await this.userRepository.findAll(page, pageSize)
  }
}
