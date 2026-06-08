import { describe, it, expect } from 'vitest'
import { UserRegistered } from '../domain/user/events/UserRegistered.js'
import { UserRole } from '../domain/user/value-objects/UserRole.js'
import { DomainEvent } from '../domain/shared/DomainEvent.js'

describe('UserRegistered 领域事件', () => {
  it('应该成功创建 UserRegistered 事件', () => {
    const userId = 'user-123'
    const phone = '13800138000'
    const role = UserRole.USER
    const name = '张三'

    const event = new UserRegistered(userId, phone, role, name)

    expect(event).toBeInstanceOf(UserRegistered)
    expect(event).toBeInstanceOf(DomainEvent)
  })

  it('应该正确设置事件属性', () => {
    const userId = 'user-123'
    const phone = '13800138000'
    const role = UserRole.USER
    const name = '张三'

    const event = new UserRegistered(userId, phone, role, name)

    expect(event.userId).toBe(userId)
    expect(event.phone).toBe(phone)
    expect(event.role).toBe(role)
    expect(event.name).toBe(name)
  })

  it('应该有正确的事件名称', () => {
    const event = new UserRegistered(
      'user-123',
      '13800138000',
      UserRole.USER,
      '用户'
    )

    expect(event.eventName).toBe('UserRegistered')
  })

  it('应该支持不同的用户角色', () => {
    const adminEvent = new UserRegistered(
      'admin-123',
      '13912345678',
      UserRole.ADMIN,
      '管理员'
    )

    const managerEvent = new UserRegistered(
      'manager-123',
      '13912345679',
      UserRole.MANAGER,
      '经理'
    )

    expect(adminEvent.role).toBe(UserRole.ADMIN)
    expect(managerEvent.role).toBe(UserRole.MANAGER)
  })

  it('应该正确生成事件ID和时间戳', () => {
    const event1 = new UserRegistered(
      'user-1',
      '13800138000',
      UserRole.USER,
      '用户1'
    )
    const event2 = new UserRegistered(
      'user-2',
      '13912345678',
      UserRole.USER,
      '用户2'
    )

    // 每个事件应该有唯一的 ID
    expect(event1.eventId).toBeDefined()
    expect(event2.eventId).toBeDefined()
    expect(event1.eventId).not.toBe(event2.eventId)

    // 每个事件应该有创建时间戳
    expect(event1.occurredAt).toBeInstanceOf(Date)
    expect(event2.occurredAt).toBeInstanceOf(Date)
  })
})

describe('DomainEvent 基类', () => {
  it('所有领域事件都应该继承自 DomainEvent', () => {
    const event = new UserRegistered(
      'user-123',
      '13800138000',
      UserRole.USER,
      '用户'
    )

    expect(event).toBeInstanceOf(DomainEvent)
  })

  it('DomainEvent 应该提供基本属性', () => {
    const event = new UserRegistered(
      'user-123',
      '13800138000',
      UserRole.USER,
      '用户'
    )

    expect(event.eventId).toBeDefined()
    expect(event.occurredAt).toBeDefined()
    expect(typeof event.eventId).toBe('string')
  })
})
