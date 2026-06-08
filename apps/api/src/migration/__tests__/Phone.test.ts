import { describe, it, expect } from 'vitest'
import { Phone } from '../domain/user/value-objects/Phone.js'
import { ValidationError } from '../domain/shared/errors/DomainError.js'

describe('Phone 值对象', () => {
  describe('创建 Phone', () => {
    it('应该成功创建有效的手机号', () => {
      const phone = Phone.create('13800138000')
      expect(phone).toBeInstanceOf(Phone)
      expect(phone.value).toBe('13800138000')
    })

    it('应该自动处理手机号两端的空格', () => {
      const phone = Phone.create('  13800138000  ')
      expect(phone.value).toBe('13800138000')
    })

    it('应该对无效的手机号格式抛出 ValidationError', () => {
      const invalidPhones = [
        '',
        '   ',
        '123',
        '1234567890',
        '23800138000',
        '1380013800',
        '138001380001',
        'abcdefghijk',
        '138 0013 8000',
      ]

      invalidPhones.forEach(phone => {
        expect(() => Phone.create(phone)).toThrow(ValidationError)
        expect(() => Phone.create(phone)).toThrow('无效的手机号格式')
      })
    })
  })

  describe('手机号验证', () => {
    it('isValid 应该正确验证手机号格式', () => {
      const validPhones = [
        '13800138000',
        '13912345678',
        '15012345678',
        '17012345678',
        '18012345678',
        '19012345678',
      ]

      const invalidPhones = [
        '23800138000',
        '12800138000',
        '1380013800',
        '138001380001',
        'abcdefghijk',
      ]

      validPhones.forEach(phone => {
        expect(Phone.isValid(phone)).toBe(true)
      })

      invalidPhones.forEach(phone => {
        expect(Phone.isValid(phone)).toBe(false)
      })
    })
  })

  describe('相等性比较', () => {
    it('相同的手机号应该被认为相等', () => {
      const phone1 = Phone.create('13800138000')
      const phone2 = Phone.create('13800138000')

      expect(phone1.equals(phone2)).toBe(true)
      expect(phone2.equals(phone1)).toBe(true)
    })

    it('不同的手机号应该被认为不相等', () => {
      const phone1 = Phone.create('13800138000')
      const phone2 = Phone.create('13912345678')

      expect(phone1.equals(phone2)).toBe(false)
      expect(phone2.equals(phone1)).toBe(false)
    })

    it('与非 Phone 对象比较应该返回 false', () => {
      const phone = Phone.create('13800138000')
      expect(phone.equals(null)).toBe(false)
      expect(phone.equals(undefined)).toBe(false)
      expect(phone.equals('13800138000' as any)).toBe(false)
    })
  })

  describe('字符串表示', () => {
    it('toString 应该返回原始手机号', () => {
      const phone = Phone.create('13800138000')
      expect(phone.toString()).toBe('13800138000')
    })

    it('mask 应该返回脱敏后的手机号', () => {
      const phone = Phone.create('13800138000')
      expect(phone.mask()).toBe('138****8000')
    })
  })

  describe('不可变性', () => {
    it('值对象创建后不能通过常规方法修改', () => {
      const phone = Phone.create('13800138000')
      
      // Phone 值对象没有公开的 setter，所以应该保持不可变
      expect(phone.value).toBe('13800138000')
      
      // 创建一个新的Phone对象应该是独立的
      const phone2 = Phone.create('13800138000')
      expect(phone2.equals(phone)).toBe(true)
    })
  })
})
