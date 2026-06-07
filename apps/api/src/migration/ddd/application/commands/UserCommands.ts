/**
 * 用户相关命令 - CQRS Command
 */
export interface RegisterUserCommand {
  phone: string
  password: string
  nickname?: string
  teamName?: string
  role?: string
}

export interface LoginUserCommand {
  phone: string
  password: string
  loginMethod?: string
}

export interface UpdateUserCommand {
  userId: string
  nickname?: string
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

export interface UpdateUserRoleCommand {
  userId: string
  newRole: string
}

export interface UpdateUserTeamNameCommand {
  userId: string
  teamName: string
}
