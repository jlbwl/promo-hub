import { describe, it, expect } from 'vitest'
import { Password } from '../domain/user/value-objects/Password.js'
import { ValidationError } from '../domain/shared/errors/DomainError.js'

describe('Password 值对象', () => {
  describe('创建 Password', () => {
    it('应该成功创建有效的密码', () => {
      const password = Password.create('password123')
      expect(password).toBeInstanceOf(Password)
      expect(password.hashedValue).toBeDefined()
      expect(password.hashedValue.length).toBeGreaterThan(0)
    })

    it('应该对太短的密码抛出 ValidationError', () => {
      const shortPasswords = ['', '123', '12345', '   ']

      shortPasswords.forEach(password => {
        expect(() => Password.create(password)).toThrow(ValidationError)
        expect(() => Password.create(password)).toThrow('密码长度不能少于6位')
      })
    })

    it('应该正确地从哈希值重建密码对象', () => {
      const originalHash = 'hashed-password-value'
      const password = Password.fromHash(originalHash)

      expect(password).toBeInstanceOf(Password)
      expect(password.hashedValue).toBe(originalHash)
    })
  })

  describe('密码验证', () => {
    it('应该正确验证匹配的密码', () => {
      const plainPassword = 'mySecurePassword123'
      const password = Password.create(plainPassword)

      expect(password.verify(plainPassword)).toBe(true)
    })

    it('应该拒绝不匹配的密码', () => {
      const password = Password.create('correctPassword123')

      expect(password.verify('wrongPassword')).toBe(false)
      expect(password.verify('')).toBe(false)
      expect(password.verify('123')).toBe(false)
    })

    it('不同的明文密码应该产生不同的哈希值', () => {
      const password1 = Password.create('passwordA')
      const password2 = Password.create('passwordB')

      expect(password1.hashedValue).not.toBe(password2.hashedValue)
    })

    it('相同的明文密码应该产生相同的哈希值', () => {
      const password1 = Password.create('samePassword123')
      const password2 = Password.create('samePassword123')

      expect(password1.hashedValue).toBe(password2.hashedValue)
    })
  })

  describe('相等性比较', () => {
    it('相同哈希的密码应该被认为相等', () => {
      const hash = 'same-hashed-value'
      const password1 = Password.fromHash(hash)
      const password2 = Password.fromHash(hash)

      expect(password1.equals(password2)).toBe(true)
    })

    it('不同哈希的密码应该被认为不相等', () => {
      const password1 = Password.fromHash('hash-value-1')
      const password2 = Password.fromHash('hash-value-2')

      expect(password1.equals(password2)).toBe(false)
    })

    it('与非 Password 对象比较应该返回 false', () => {
      const password = Password.create('password123')
      expect(password.equals(null)).toBe(false)
      expect(password.equals(undefined)).toBe(false)
      expect(password.equals('password123' as any)).toBe(false)
    })
  })

  describe('安全性', () => {
    it('不应该暴露原始密码', () => {
      const plainPassword = 'secretPassword123'
      const password = Password.create(plainPassword)

      expect(password.hashedValue).not.toContain(plainPassword)
    })

    it('哈希值应该具有固定长度', () => {
      const password = Password.create('anyPassword')
      expect(password.hashedValue.length).toBe(64) // SHA256 哈希是 64 个字符
    })
  })

  describe('不可变性', () => {
    it('密码对象创建后不能通过常规方法修改', () => {
      const password = Password.create('originalPassword')
      
      // Password 值对象没有公开的 setter，所以应该保持不可变
      expect(password.hashedValue).toBeDefined()
      
      // 创建一个新的Password对象应该是独立的
      const password2 = Password.create('originalPassword')
      expect(password2.hashedValue).toBe(password.hashedValue)
    })
  })
})
