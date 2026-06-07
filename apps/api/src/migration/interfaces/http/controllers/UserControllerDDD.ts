import { Request, Response } from 'express'
import { injectable } from 'tsyringe'
import { resolve } from '../../../../container.js'
import { CreateUserCommandHandler } from '../../../application/command-handlers/CreateUserCommandHandler.js'
import { UserQueryHandler } from '../../../application/query-handlers/UserQueryHandler.js'
import { UserPresenter } from '../../presenters/UserPresenter.js'
import { DomainError, NotFoundError } from '../../../domain/shared/errors/DomainError.js'

/**
 * 用户控制器（DDD 架构版本）
 * 职责：仅负责接收 HTTP 请求、参数基础校验、调用应用层服务以及返回响应格式
 * 严禁在此层编写任何业务判断逻辑
 */
@injectable()
export class UserControllerDDD {
  private commandHandler: CreateUserCommandHandler
  private queryHandler: UserQueryHandler

  constructor() {
    this.commandHandler = resolve(CreateUserCommandHandler)
    this.queryHandler = resolve(UserQueryHandler)
  }

  /**
   * 创建用户 - 使用 CQRS Command
   */
  async create(req: Request, res: Response) {
    try {
      const command = {
        name: req.body.name,
        phone: req.body.phone,
        password: req.body.password,
        role: req.body.role,
        teamName: req.body.teamName,
        managerId: req.body.managerId,
      }

      // 调用命令处理器
      const user = await this.commandHandler.handle(command)

      // 使用 Presenter 转换为视图模型
      const view = UserPresenter.toPublicView(user)

      res.status(201).json({
        success: true,
        data: view,
      })
    } catch (error) {
      this.handleError(res, error)
    }
  }

  /**
   * 获取用户详情 - 使用 CQRS Query
   */
  async getById(req: Request, res: Response) {
    try {
      const userId = req.params.id as string
      const query = { userId }

      // 调用查询处理器（绕过领域层，直接查询优化性能）
      const userDTO = await this.queryHandler.handleGetById(query)

      if (!userDTO) {
        throw new NotFoundError('User', userId)
      }

      res.json({
        success: true,
        data: userDTO,
      })
    } catch (error) {
      this.handleError(res, error)
    }
  }

  /**
   * 获取用户列表 - 使用 CQRS Query
   */
  async list(req: Request, res: Response) {
    try {
      const query = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
        role: req.query.role as string,
        status: req.query.status as string,
        managerId: req.query.managerId as string,
      }

      const result = await this.queryHandler.handleList(query)

      res.json({
        success: true,
        data: {
          list: result.list,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      })
    } catch (error) {
      this.handleError(res, error)
    }
  }

  /**
   * 统一错误处理
   */
  private handleError(res: Response, error: any) {
    if (error instanceof DomainError) {
      const statusCode = this.getStatusCode(error.constructor.name)
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.constructor.name,
          message: error.message,
        },
      })
    } else {
      console.error('[Controller] Unexpected error:', error)
      res.status(500).json({
        success: false,
        error: {
          code: 'InternalServerError',
          message: '服务器内部错误',
        },
      })
    }
  }

  private getStatusCode(errorName: string): number {
    const statusMap: Record<string, number> = {
      NotFoundError: 404,
      ValidationError: 400,
      ConflictError: 409,
      BusinessRuleError: 422,
    }
    return statusMap[errorName] || 400
  }
}
