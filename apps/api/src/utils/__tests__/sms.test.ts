import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateSmsCode,
  saveSmsCode,
  verifySmsCode,
  deleteSmsCode,
} from '../sms'

describe('sms utils', () => {
  describe('generateSmsCode', () => {
    it('should generate 6-digit code', () => {
      const code = generateSmsCode()
      expect(code).toHaveLength(6)
      expect(/^\d{6}$/.test(code)).toBe(true)
    })

    it('should generate different codes on each call', () => {
      const codes = new Set()
      for (let i = 0; i < 100; i++) {
        codes.add(generateSmsCode())
      }
      expect(codes.size).toBeGreaterThan(90) // 可能有重复，但概率很低
    })

    it('should generate numeric codes only', () => {
      const code = generateSmsCode()
      expect(Number.isNaN(Number(code))).toBe(false)
    })
  })

  describe('saveSmsCode, verifySmsCode, deleteSmsCode', () => {
    const testPhone = '13800138000'
    const testCode = '123456'

    beforeEach(() => {
      // Clear any existing state
      deleteSmsCode(testPhone)
    })

    it('should verify correct code', () => {
      saveSmsCode(testPhone, testCode)
      expect(verifySmsCode(testPhone, testCode)).toBe(true)
    })

    it('should reject wrong code', () => {
      saveSmsCode(testPhone, testCode)
      expect(verifySmsCode(testPhone, '654321')).toBe(false)
    })

    it('should reject expired code', () => {
      // 使用 vi.useFakeTimers 来控制时间
      const now = Date.now()
      vi.setSystemTime(now)
      saveSmsCode(testPhone, testCode, 0)
      
      // 时间向前推进1秒
      vi.setSystemTime(now + 1000)
      expect(verifySmsCode(testPhone, testCode)).toBe(false)
      
      vi.useRealTimers()
    })

    it('should delete code', () => {
      saveSmsCode(testPhone, testCode)
      deleteSmsCode(testPhone)
      expect(verifySmsCode(testPhone, testCode)).toBe(false)
    })

    it('should handle non-existent phone gracefully', () => {
      expect(verifySmsCode('nonexistent', '123456')).toBe(false)
    })

    it('should handle non-existent phone deletion gracefully', () => {
      expect(() => deleteSmsCode('nonexistent')).not.toThrow()
    })

    it('should use custom expiry time', () => {
      saveSmsCode(testPhone, testCode, 3600)
      expect(verifySmsCode(testPhone, testCode)).toBe(true)
    })
  })
})
