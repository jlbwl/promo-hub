import { describe, it, expect } from 'vitest'
import { User } from '../domain/user/entities/User.js'
import { Phone } from '../domain/user/value-objects/Phone.js'
import { UserRole, UserStatus } from '../domain/user/value-objects/UserRole.js'
import { UserRegistered } from '../domain/user/events/UserRegistered.js'
import { ValidationError, BusinessRuleError } from '../domain/shared/errors/DomainError.js'
import { v4 as uuidv4 } from 'uuid'

describe('User 聚合根', () => {
  describe('用户注册', () => {
    it('应该成功创建并注册新用户', () => {
      const id = uuidv4()
      const name = '张三'
      const phone = '13800138000'
      const password = 'password123'

      const user = User.register(id, name, phone, password)

      expect(user).toBeInstanceOf(User)
      expect(user.id).toBe(id)
      expect(user.name).toBe(name)
      expect(user.phone.value).toBe(phone)
      expect(user.role).toBe(UserRole.USER)
      expect(user.status).toBe(UserStatus.ACTIVE)
    })

    it('应该发布 UserRegistered 领域事件', () => {
    const id = uuidv4()
    const user = User.register(id, '李四', '13912345678', 'password456')

    const events = user.domainEvents
    expect(events.length).toBe(1)
    expect(events[0]).toBeInstanceOf(UserRegistered)

    const event = events[0] as UserRegistered
    expect(event.userId).toBe(id)
    expect(event.phone).toBe('13912345678')
  })

    it('应该允许指定角色进行注册', () => {
      const id = uuidv4()
      const user = User.register(id, '管理员', '13912345678', 'adminpass', UserRole.ADMIN)

      expect(user.role).toBe(UserRole.ADMIN)
    })

    it('应该允许设置团队和经理信息', () => {
      const id = uuidv4()
      const managerId = uuidv4()
      const teamName = '销售团队'

      const user = User.register(id, '王五', '13912345678', 'password789', UserRole.USER, teamName, managerId)

      expect(user.teamName).toBe(teamName)
      expect(user.managerId).toBe(managerId)
    })
  })

  describe('从持久化数据重建用户', () => {
    it('应该正确从数据库数据重建用户对象', () => {
      const id = uuidv4()
      const hashedPassword = 'some-hashed-password'
      const createdAt = new Date()

      const user = User.fromPersistence(
        id,
        '赵六',
        '13800138000',
        hashedPassword,
        UserRole.USER,
        UserStatus.ACTIVE,
        'avatar-url',
        '我的团队',
        'manager-id',
        createdAt
      )

      expect(user.id).toBe(id)
      expect(user.name).toBe('赵六')
      expect(user.avatar).toBe('avatar-url')
      expect(user.teamName).toBe('我的团队')
      expect(user.managerId).toBe('manager-id')
      expect(user.createdAt).toEqual(createdAt)
    })

    it('不应该发布领域事件（重建不触发业务事件）', () => {
      const user = User.fromPersistence(
        uuidv4(),
        '钱七',
        '13912345678',
        'hashed-pwd',
        UserRole.USER,
        UserStatus.ACTIVE
      )

      expect(user.domainEvents).toEqual([])
    })
  })

  describe('业务方法 - 更新用户名称', () => {
    it('应该成功更新用户名称', () => {
      const user = User.register(uuidv4(), '原名字', '13800138000', 'password123')
      const originalUpdatedAt = new Date(user.updatedAt)

      // 稍微等待一下确保时间戳有变化
      user.updateName('新名字')

      expect(user.name).toBe('新名字')
    })

    it('应该对空名称抛出 ValidationError', () => {
      const user = User.register(uuidv4(), '原名字', '13800138000', 'password123')

      expect(() => user.updateName('')).toThrow(ValidationError)
      expect(() => user.updateName('   ')).toThrow(ValidationError)
    })

    it('应该自动修剪名称的两端空格', () => {
      const user = User.register(uuidv4(), '原名字', '13800138000', 'password123')
      user.updateName('  带空格的名字  ')

      expect(user.name).toBe('带空格的名字')
    })
  })

  describe('业务方法 - 密码管理', () => {
    it('应该成功修改密码（验证旧密码）', () => {
      const oldPassword = 'oldpass123'
      const newPassword = 'newpass456'
      const user = User.register(uuidv4(), '用户', '13800138000', oldPassword)

      user.changePassword(oldPassword, newPassword)

      expect(user.password.verify(newPassword)).toBe(true)
      expect(user.password.verify(oldPassword)).toBe(false)
    })

    it('对错误的旧密码应该抛出 BusinessRuleError', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'correctpass')

      expect(() => user.changePassword('wrongpass', 'newpass')).toThrow(BusinessRuleError)
      expect(() => user.changePassword('wrongpass', 'newpass')).toThrow('原密码不正确')
    })

    it('管理员应该可以直接重置密码', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'oldpass')
      const newPassword = 'resetpass123'

      user.resetPassword(newPassword)

      expect(user.password.verify(newPassword)).toBe(true)
    })
  })

  describe('业务方法 - 头像管理', () => {
    it('应该成功更新用户头像', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'password')

      user.updateAvatar('new-avatar-url')

      expect(user.avatar).toBe('new-avatar-url')
    })
  })

  describe('业务方法 - 账户状态管理', () => {
    it('应该能够禁用用户账户', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'password')

      user.ban()

      expect(user.status).toBe(UserStatus.BANNED)
      expect(user.isBanned()).toBe(true)
    })

    it('不能禁用管理员账户', () => {
      const user = User.register(uuidv4(), '管理员', '13800138000', 'password', UserRole.ADMIN)

      expect(() => user.ban()).toThrow(BusinessRuleError)
      expect(() => user.ban()).toThrow('不能禁用管理员账户')
    })

    it('应该能够重新启用被禁用的用户', () => {
      const user = User.fromPersistence(
        uuidv4(),
        '用户',
        '13800138000',
        'hashed-pwd',
        UserRole.USER,
        UserStatus.BANNED
      )

      user.activate()

      expect(user.status).toBe(UserStatus.ACTIVE)
      expect(user.isBanned()).toBe(false)
    })

    it('对已激活的用户调用 activate 不应该有副作用', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'password')
      const originalUpdatedAt = user.updatedAt

      user.activate()

      expect(user.status).toBe(UserStatus.ACTIVE)
      expect(user.updatedAt).toEqual(originalUpdatedAt) // 时间戳不应更新
    })
  })

  describe('业务方法 - 经理分配', () => {
    it('普通用户应该能够被分配经理', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'password')
      const managerId = uuidv4()

      user.assignManager(managerId)

      expect(user.managerId).toBe(managerId)
    })

    it('非普通用户（如经理）不能被分配经理', () => {
      const user = User.register(uuidv4(), '经理用户', '13800138000', 'password', UserRole.MANAGER)

      expect(() => user.assignManager(uuidv4())).toThrow(BusinessRuleError)
      expect(() => user.assignManager(uuidv4())).toThrow('只有普通用户才能分配经理')
    })
  })

  describe('角色和状态检查', () => {
    it('应该正确检查用户角色', () => {
      const adminUser = User.register(uuidv4(), '管理员', '13800138000', 'password', UserRole.ADMIN)
      const managerUser = User.register(uuidv4(), '经理', '13800138001', 'password', UserRole.MANAGER)
      const regularUser = User.register(uuidv4(), '普通用户', '13800138002', 'password', UserRole.USER)

      expect(adminUser.isAdmin()).toBe(true)
      expect(adminUser.isManager()).toBe(false)
      expect(adminUser.isRegularUser()).toBe(false)

      expect(managerUser.isAdmin()).toBe(false)
      expect(managerUser.isManager()).toBe(true)
      expect(managerUser.isRegularUser()).toBe(false)

      expect(regularUser.isAdmin()).toBe(false)
      expect(regularUser.isManager()).toBe(false)
      expect(regularUser.isRegularUser()).toBe(true)
    })
  })

  describe('领域事件管理', () => {
    it('应该能够获取和清除领域事件', () => {
      const user = User.register(uuidv4(), '用户', '13800138000', 'password')

      expect(user.domainEvents.length).toBe(1)

      user.clearDomainEvents()

      expect(user.domainEvents).toEqual([])
    })
  })
})
