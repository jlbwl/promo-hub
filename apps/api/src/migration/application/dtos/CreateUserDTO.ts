/**
 * 创建用户 DTO
 */
export interface CreateUserDTO {
  name: string
  phone: string
  password: string
  role?: string
  teamName?: string
  managerId?: string
}

export interface UpdateUserDTO {
  name?: string
  avatar?: string
  teamName?: string
  managerId?: string
}

export interface ChangePasswordDTO {
  oldPassword: string
  newPassword: string
}
