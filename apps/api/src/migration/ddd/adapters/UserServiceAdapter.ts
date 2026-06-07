import { injectable, inject } from 'tsyringe'
import { ErrorCode, throwBadRequest, throwNotFound, throwConflict, throwUnauthorized } from '@promo/shared'
import { UserCommandHandlers } from '../application/command-handlers/UserCommandHandlers.js'
import { UserQueryHandlers } from '../application/query-handlers/UserQueryHandlers.js'
import { UserMapper } from '../infrastructure/persistence/mappers/UserMapper.js'
import { NotFoundError, ConflictError, BusinessRuleError } from '../domain/shared/errors/DomainError.js'
import logger from '../../../utils/logger.js'

/**
 * 用户服务适配器 - 实现旧的 UserService 接口
 * 将旧接口委托给新的 DDD 架构
 * 保持 100% 向后兼容性
 */
@injectable()
export class UserServiceAdapter {
  constructor(
    @inject(UserCommandHandlers) private commandHandlers: UserCommandHandlers,
    @inject(UserQueryHandlers) private queryHandlers: UserQueryHandlers
  ) {}

  /**
   * 注册用户 - 适配旧接口
   */
  async registerUser(userData: {
    phone: string
    password: string
    nickname?: string
    teamName?: string
  }): Promise<any> {
    try {
      const user = await this.commandHandlers.handleRegisterUser({
        phone: userData.phone,
        password: userData.password,
        nickname: userData.nickname,
        teamName: userData.teamName,
      })

      // 返回旧格式的数据
      return UserMapper.toSafeDTO(user)
    } catch (error: any) {
      // 转换为旧的错误格式
      this.handleError(error)
      throw error
    }
  }

  /**
   * 密码登录 - 适配旧接口
   */
  async login(phone: string, password: string): Promise<any> {
    try {
      const user = await this.commandHandlers.handleLoginUser({
        phone,
        password,
      })

      if (!user) {
        throwUnauthorized('手机号或密码错误，或账号已被禁用', ErrorCode.INVALID_CREDENTIALS)
      }

      // 检查用户状态
      if (user.isBanned()) {
        throwUnauthorized('手机号或密码错误，或账号已被禁用', ErrorCode.INVALID_CREDENTIALS)
      }

      return UserMapper.toSafeDTO(user)
    } catch (error: any) {
      if (error instanceof BusinessRuleError) {
        throwUnauthorized('手机号或密码错误，或账号已被禁用', ErrorCode.INVALID_CREDENTIALS)
      }
      this.handleError(error)
      throw error
    }
  }

  /**
   * 获取用户信息 - 适配旧接口
   */
  async getUserById(userId: string): Promise<any> {
    try {
      const user = await this.queryHandlers.handleGetById({ userId })
      
      if (!user) {
        throwNotFound('用户不存在', ErrorCode.USER_NOT_FOUND)
      }

      // 转换为旧格式
      return {
        id: user.id,
        name: user.name,
        nickname: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        teamName: user.teamName,
        managerId: user.managerId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    } catch (error: any) {
      this.handleError(error)
      throw error
    }
  }

  /**
   * 更新用户信息 - 适配旧接口
   */
  async updateUser(userId: string, updateData: any): Promise<any> {
    try {
      const user = await this.commandHandlers.handleUpdateUser({
        userId,
        nickname: updateData.nickname,
        avatar: updateData.avatar,
        teamName: updateData.teamName,
        managerId: updateData.managerId,
      })

      return UserMapper.toSafeDTO(user)
    } catch (error: any) {
      this.handleError(error)
      throw error
    }
  }

  /**
   * 错误处理 - 将 DDD 错误转换为旧格式
   */
  private handleError(error: any): void {
    if (error instanceof NotFoundError) {
      throwNotFound(error.message, ErrorCode.USER_NOT_FOUND)
    }
    if (error instanceof ConflictError) {
      if (error.message.includes('手机号')) {
        throwConflict(error.message, ErrorCode.USER_ALREADY_EXISTS)
      }
      throwConflict(error.message)
    }
    if (error instanceof BusinessRuleError) {
      throwBadRequest(error.message)
    }
    // 其他错误保持原样
  }
}

/**
 * 单例导出（保持向后兼容）
 * 可以直接替换原来的 userService 导出
 */
export async function createUserServiceAdapter(): Promise<UserServiceAdapter> {
  // 在实际项目中应该从 DI 容器获取
  // 这里简化处理
  throw new Error('Should be created via DI container')
}
