import { injectable, inject } from 'tsyringe'
import { User } from '../../domain/user/entities/User.js'
import { IUserRepository } from '../../domain/user/repositories/UserRepository.js'
import { UserRole } from '../../domain/user/value-objects/UserRole.js'
import {
  ConflictError,
  NotFoundError,
  BusinessRuleError
} from '../../domain/shared/errors/DomainError.js'
import {
  RegisterUserCommand,
  LoginUserCommand,
  UpdateUserCommand,
  ChangePasswordCommand,
  BanUserCommand,
  UpdateUserRoleCommand,
  UpdateUserTeamNameCommand
} from '../commands/UserCommands.js'
import logger from '../../../utils/logger.js'

/**
 * 用户命令处理器
 * 一个用例一个处理器，明确事务边界
 */
@injectable()
export class UserCommandHandlers {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  /**
   * 处理用户注册
   */
  async handleRegisterUser(command: RegisterUserCommand): Promise<User> {
    // 检查手机号是否已存在
    const existsPhone = await this.userRepository.existsByPhone(command.phone)
    if (existsPhone) {
      throw new ConflictError('该手机号已注册')
    }

    // 检查团队名称
    if (command.teamName) {
      const existsTeam = await this.userRepository.existsByTeamName(command.teamName)
      if (existsTeam) {
        throw new ConflictError('该团队名称已存在')
      }
    }

    // 生成用户 ID
    const userId = this.generateId()

    // 创建用户聚合根
    const role = command.role ? (command.role as UserRole) : UserRole.USER
    const nickname = command.nickname || `用户${command.phone.slice(-4)}`
    const user = User.register(
      userId,
      nickname,
      command.phone,
      command.password,
      role,
      command.teamName,
    )

    // 保存
    await this.userRepository.save(user)

    logger.info(`User registered: ${userId}`, { phone: command.phone })
    return user
  }

  /**
   * 处理用户登录
   */
  async handleLoginUser(command: LoginUserCommand): Promise<User | null> {
    // 查找用户
    const user = await this.userRepository.findByPhone(command.phone)
    if (!user) {
      return null
    }

    // 验证密码
    const isValid = await user.login(command.password, command.loginMethod || 'password')
    if (!isValid) {
      return null
    }

    // 检查用户状态
    if (user.isBanned()) {
      throw new BusinessRuleError('账号已被禁用')
    }

    // 保存更新（登录方式等）
    await this.userRepository.save(user)

    logger.info(`User logged in: ${user.id}`, { phone: command.phone })
    return user
  }

  /**
   * 处理用户信息更新
   */
  async handleUpdateUser(command: UpdateUserCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId)
    if (!user) {
      throw new NotFoundError('User', command.userId)
    }

    // 应用更新
    if (command.nickname) {
      user.updateNickname(command.nickname)
    }
    if (command.avatar) {
      user.updateAvatar(command.avatar)
    }
    if (command.teamName) {
      user.updateTeamName(command.teamName)
    }
    if (command.managerId) {
      user.assignManager(command.managerId)
    }

    // 保存
    await this.userRepository.save(user)

    logger.info(`User updated: ${user.id}`)
    return user
  }

  /**
   * 处理密码修改
   */
  async handleChangePassword(command: ChangePasswordCommand): Promise<void> {
    const user = await this.userRepository.findById(command.userId)
    if (!user) {
      throw new NotFoundError('User', command.userId)
    }

    await user.changePassword(command.oldPassword, command.newPassword)
    await this.userRepository.save(user)

    logger.info(`User password changed: ${user.id}`)
  }

  /**
   * 处理禁用用户
   */
  async handleBanUser(command: BanUserCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId)
    if (!user) {
      throw new NotFoundError('User', command.userId)
    }

    user.ban(command.reason)
    await this.userRepository.save(user)

    logger.info(`User banned: ${user.id}`, { reason: command.reason })
    return user
  }

  /**
   * 处理用户角色变更
   */
  async handleUpdateUserRole(command: UpdateUserRoleCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId)
    if (!user) {
      throw new NotFoundError('User', command.userId)
    }

    user.changeRole(command.newRole as UserRole)
    await this.userRepository.save(user)

    logger.info(`User role updated: ${user.id}`, { newRole: command.newRole })
    return user
  }

  /**
   * 处理团队名称更新
   */
  async handleUpdateTeamName(command: UpdateUserTeamNameCommand): Promise<User> {
    const user = await this.userRepository.findById(command.userId)
    if (!user) {
      throw new NotFoundError('User', command.userId)
    }

    // 检查团队名称是否重复
    const existsTeam = await this.userRepository.existsByTeamName(command.teamName)
    if (existsTeam) {
      throw new ConflictError('该团队名称已存在')
    }

    user.updateTeamName(command.teamName)
    await this.userRepository.save(user)

    logger.info(`User team name updated: ${user.id}`, { teamName: command.teamName })
    return user
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}
