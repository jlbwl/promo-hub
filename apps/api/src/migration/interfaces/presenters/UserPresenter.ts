import { User } from '../../domain/user/entities/User'

/**
 * 用户展示器 - 将领域模型转换为前端视图模型（VO）
 * 实现后端模型与前端展示的彻底解耦
 */
export class UserPresenter {
  /**
   * 转换单个用户为公开视图（不包含敏感信息）
   */
  static toPublicView(user: User): PublicUserVO {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone.mask(),
      role: user.role,
      status: user.status,
      avatar: user.avatar,
      teamName: user.teamName,
      managerId: user.managerId,
      createdAt: user.createdAt.toISOString(),
    }
  }

  /**
   * 转换用户为管理员视图（包含更多信息）
   */
  static toAdminView(user: User): AdminUserVO {
    return {
      ...this.toPublicView(user),
      phoneRaw: user.phone.value,
      updatedAt: user.updatedAt?.toISOString(),
    }
  }

  /**
   * 转换用户列表
   */
  static toListView(users: User[]): PublicUserVO[] {
    return users.map(user => this.toPublicView(user))
  }

  /**
   * 转换分页用户列表
   */
  static toPaginatedView(
    users: User[],
    total: number,
    page: number,
    pageSize: number
  ): PaginatedUserVO {
    return {
      list: this.toListView(users),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }
}

// ========== 视图模型（VO）类型定义 ==========

/**
 * 公开用户视图 - 返回给前端的标准用户信息
 */
export interface PublicUserVO {
  id: string
  name: string
  phone: string
  role: string
  status: string
  avatar?: string
  teamName?: string
  managerId?: string
  createdAt: string
}

/**
 * 管理员用户视图 - 包含更多信息
 */
export interface AdminUserVO extends PublicUserVO {
  phoneRaw: string
  updatedAt?: string
}

/**
 * 分页用户视图
 */
export interface PaginatedUserVO {
  list: PublicUserVO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
