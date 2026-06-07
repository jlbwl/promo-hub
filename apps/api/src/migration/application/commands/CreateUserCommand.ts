/**
 * 创建用户命令 - CQRS 模式
 */
export interface CreateUserCommand {
  name: string
  phone: string
  password: string
  role?: string
  teamName?: string
  managerId?: string
}

export interface UpdateUserCommand {
  userId: string
  name?: string
  avatar?: string
  teamName?: string
  managerId?: string
}

export interface ChangePasswordCommand {
  userId: string
  oldPassword: string
  newPassword: string
}

export interface BanUserCommand {
  userId: string
  reason?: string
}
