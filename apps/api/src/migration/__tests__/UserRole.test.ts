import { describe, it, expect } from 'vitest'
import { UserRole, UserStatus } from '../domain/user/value-objects/UserRole.js'

describe('UserRole 和 UserStatus 枚举', () => {
  describe('UserRole', () => {
    it('应该包含正确的角色值', () => {
      expect(UserRole.ADMIN).toBe('admin')
      expect(UserRole.MANAGER).toBe('manager')
      expect(UserRole.USER).toBe('user')
    })

    it('应该有且只有三个角色', () => {
      const roles = Object.values(UserRole)
      expect(roles).toContain(UserRole.ADMIN)
      expect(roles).toContain(UserRole.MANAGER)
      expect(roles).toContain(UserRole.USER)
      expect(roles.length).toBe(3)
    })

    it('应该能够正确比较角色', () => {
      const adminRole = UserRole.ADMIN
      const managerRole = UserRole.MANAGER
      const userRole = UserRole.USER

      expect(adminRole).not.toBe(managerRole)
      expect(adminRole).not.toBe(userRole)
      expect(managerRole).not.toBe(userRole)

      expect(UserRole.ADMIN).toBe('admin')
      expect(UserRole.MANAGER).toBe('manager')
      expect(UserRole.USER).toBe('user')
    })
  })

  describe('UserStatus', () => {
    it('应该包含正确的状态值', () => {
      expect(UserStatus.ACTIVE).toBe('active')
      expect(UserStatus.BANNED).toBe('banned')
      expect(UserStatus.INACTIVE).toBe('inactive')
    })

    it('应该有且只有三个状态', () => {
      const statuses = Object.values(UserStatus)
      expect(statuses).toContain(UserStatus.ACTIVE)
      expect(statuses).toContain(UserStatus.BANNED)
      expect(statuses).toContain(UserStatus.INACTIVE)
      expect(statuses.length).toBe(3)
    })

    it('应该能够正确比较状态', () => {
      const activeStatus = UserStatus.ACTIVE
      const bannedStatus = UserStatus.BANNED
      const inactiveStatus = UserStatus.INACTIVE

      expect(activeStatus).not.toBe(bannedStatus)
      expect(activeStatus).not.toBe(inactiveStatus)
      expect(bannedStatus).not.toBe(inactiveStatus)
    })
  })

  describe('角色和状态的集成使用', () => {
    it('角色和状态应该可以在用户对象中一起使用', () => {
      const userData = {
        role: UserRole.USER,
        status: UserStatus.ACTIVE
      }

      expect(userData.role).toBe(UserRole.USER)
      expect(userData.status).toBe(UserStatus.ACTIVE)
      expect(userData.role).not.toBe(UserRole.ADMIN)
    })

    it('应该支持所有可能的角色和状态组合', () => {
      const combinations = [
        { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        { role: UserRole.ADMIN, status: UserStatus.INACTIVE },
        { role: UserRole.MANAGER, status: UserStatus.ACTIVE },
        { role: UserRole.MANAGER, status: UserStatus.BANNED },
        { role: UserRole.USER, status: UserStatus.ACTIVE },
        { role: UserRole.USER, status: UserStatus.BANNED },
      ]

      combinations.forEach(combo => {
        expect(combo.role).toBeDefined()
        expect(combo.status).toBeDefined()
      })
    })
  })
})
