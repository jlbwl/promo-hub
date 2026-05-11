import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatMoney,
  formatDate,
  maskPhone,
  copyToClipboard,
  commissionStatusMap,
  userStatusMap,
} from '../helpers'

describe('helpers', () => {
  describe('formatMoney', () => {
    it('should format number as CNY currency', () => {
      expect(formatMoney(0)).toBe('¥0.00')
      expect(formatMoney(100)).toBe('¥100.00')
      expect(formatMoney(1234.56)).toBe('¥1,234.56')
      expect(formatMoney(999999.99)).toBe('¥999,999.99')
    })

    it('should handle negative numbers', () => {
      expect(formatMoney(-100)).toBe('-¥100.00')
    })

    it('should handle decimal numbers correctly', () => {
      expect(formatMoney(1.5)).toBe('¥1.50')
      expect(formatMoney(99.99)).toBe('¥99.99')
      expect(formatMoney(0.01)).toBe('¥0.01')
    })

    it('should handle large numbers', () => {
      expect(formatMoney(1000000)).toBe('¥1,000,000.00')
      expect(formatMoney(123456789.12)).toContain('¥')
    })

    it('should format zero correctly', () => {
      expect(formatMoney(0)).toBe('¥0.00')
      expect(formatMoney(0.0)).toBe('¥0.00')
    })
  })

  describe('formatDate', () => {
    it('should format date with default format (YYYY-MM-DD HH:mm:ss)', () => {
      const date = '2024-01-01T00:00:00Z' // UTC时间
      const result = formatDate(date)
      expect(result).toMatch(/2024-01-01 \d{2}:\d{2}:\d{2}/)
    })

    it('should format date with custom format', () => {
      const date = '2024-12-25T12:00:00Z'
      const result = formatDate(date, 'YYYY/MM/DD')
      expect(result).toMatch(/2024\/12\/\d{2}/)
    })

    it('should handle Date object input', () => {
      const date = new Date('2024-06-15T08:30:00Z')
      const result = formatDate(date)
      expect(result).toContain('2024')
    })

    it('should handle timezone conversion (UTC+8)', () => {
      // 测试 UTC+8 时区转换
      const date = '2024-01-01T16:00:00Z' // UTC 16:00 = 北京时间 00:00
      const result = formatDate(date)
      expect(result).toMatch(/2024-01-02/)
    })

    it('should handle month boundary crossing', () => {
      // 测试跨月：UTC 2024-01-31T20:00:00Z + 8小时 = 2024-02-01 04:00:00
      const date = '2024-01-31T20:00:00Z'
      const result = formatDate(date, 'YYYY-MM-DD')
      expect(result).toBe('2024-02-01')
    })

    it('should handle year boundary crossing', () => {
      // 测试跨年：UTC 2024-12-31T20:00:00Z + 8小时 = 2025-01-01 04:00:00
      const date = '2024-12-31T20:00:00Z'
      const result = formatDate(date, 'YYYY-MM-DD')
      expect(result).toBe('2025-01-01')
    })

    it('should handle time with hours, minutes and seconds', () => {
      const date = '2024-06-15T12:30:45Z'
      const result = formatDate(date, 'HH:mm:ss')
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('should handle full datetime format', () => {
      const date = '2024-06-15T12:30:45Z'
      const result = formatDate(date, 'YYYY-MM-DD HH:mm:ss')
      expect(result).toMatch(/^2024-06-1\d \d{2}:\d{2}:\d{2}$/)
    })

    it('should pad single digit values with zero', () => {
      const date = '2024-01-05T03:05:07Z'
      const result = formatDate(date, 'MM-DD HH:mm:ss')
      expect(result).toBe('01-05 11:05:07') // 03 + 8 = 11, stays in same day
    })

    it('should handle leap year February correctly', () => {
      // 2024 is a leap year, Feb has 29 days
      const date = '2024-02-29T20:00:00Z' // +8h = 2024-03-01 04:00:00
      const result = formatDate(date, 'YYYY-MM-DD')
      expect(result).toBe('2024-03-01')
    })

    it('should handle edge case of exactly 24 hours added', () => {
      // UTC 2024-06-15T16:00:00Z + 8h = 2024-06-16 00:00:00
      const date = '2024-06-15T16:00:00Z'
      const result = formatDate(date, 'YYYY-MM-DD')
      expect(result).toBe('2024-06-16')
    })
  })

  describe('maskPhone', () => {
    it('should mask middle 4 digits of phone number', () => {
      expect(maskPhone('13800138000')).toBe('138****8000')
      expect(maskPhone('15012345678')).toBe('150****5678')
      expect(maskPhone('13912345678')).toBe('139****5678')
    })

    it('should return original if format does not match', () => {
      expect(maskPhone('123')).toBe('123')
      expect(maskPhone('')).toBe('')
    })

    it('should handle various phone number formats', () => {
      // 13开头
      expect(maskPhone('13800138000')).toMatch(/^\d{3}\*{4}\d{4}$/)
      // 15开头
      expect(maskPhone('15012345678')).toMatch(/^\d{3}\*{4}\d{4}$/)
      // 18开头
      expect(maskPhone('18812345678')).toMatch(/^\d{3}\*{4}\d{4}$/)
    })

    it('should handle 11-digit phone numbers with additional digits', () => {
      // 函数只替换匹配的前11位中的中间4位
      expect(maskPhone('13800138000123')).toMatch(/^\d{3}\*{4}\d{4}\d{3}$/)
    })
  })

  describe('copyToClipboard', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn(),
        },
      })
    })

    it('should return true when copy succeeds', async () => {
      ;(navigator.clipboard.writeText as any).mockResolvedValue(undefined)
      const result = await copyToClipboard('test text')
      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text')
    })

    it('should return false when copy fails', async () => {
      ;(navigator.clipboard.writeText as any).mockRejectedValue(new Error('Failed'))
      const result = await copyToClipboard('test text')
      expect(result).toBe(false)
    })

    it('should handle empty string', async () => {
      ;(navigator.clipboard.writeText as any).mockResolvedValue(undefined)
      const result = await copyToClipboard('')
      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('')
    })

    it('should handle long text', async () => {
      ;(navigator.clipboard.writeText as any).mockResolvedValue(undefined)
      const longText = 'a'.repeat(10000)
      const result = await copyToClipboard(longText)
      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longText)
    })

    it('should handle special characters', async () => {
      ;(navigator.clipboard.writeText as any).mockResolvedValue(undefined)
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/`~'
      const result = await copyToClipboard(specialChars)
      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(specialChars)
    })

    it('should handle unicode characters', async () => {
      ;(navigator.clipboard.writeText as any).mockResolvedValue(undefined)
      const unicode = '你好世界！🎉'
      const result = await copyToClipboard(unicode)
      expect(result).toBe(true)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(unicode)
    })

    it('should catch different types of errors', async () => {
      ;(navigator.clipboard.writeText as any).mockRejectedValue(
        new DOMException('Clipboard access denied', 'NotAllowedError')
      )
      const result = await copyToClipboard('test')
      expect(result).toBe(false)
    })
  })

  describe('status maps', () => {
    describe('commissionStatusMap', () => {
      it('should have correct keys', () => {
        expect(Object.keys(commissionStatusMap)).toEqual([
          'pending',
          'approved',
          'paid',
          'rejected',
        ])
      })

      it('should return correct label and color for each status', () => {
        expect(commissionStatusMap.pending.label).toBe('待审核')
        expect(commissionStatusMap.pending.color).toBe('#f59e0b')
        
        expect(commissionStatusMap.approved.label).toBe('已通过')
        expect(commissionStatusMap.approved.color).toBe('#3b82f6')
        
        expect(commissionStatusMap.paid.label).toBe('已发放')
        expect(commissionStatusMap.paid.color).toBe('#10b981')
        
        expect(commissionStatusMap.rejected.label).toBe('已驳回')
        expect(commissionStatusMap.rejected.color).toBe('#ef4444')
      })

      it('should have valid color format for all statuses', () => {
        Object.values(commissionStatusMap).forEach((status) => {
          expect(status.color).toMatch(/^#[0-9a-f]{6}$/i)
        })
      })

      it('should have non-empty labels', () => {
        Object.values(commissionStatusMap).forEach((status) => {
          expect(status.label.length).toBeGreaterThan(0)
        })
      })

      it('should have all required status properties', () => {
        Object.entries(commissionStatusMap).forEach(([key, status]) => {
          expect(status).toHaveProperty('label')
          expect(status).toHaveProperty('color')
        })
      })
    })

    describe('userStatusMap', () => {
      it('should have correct keys', () => {
        expect(Object.keys(userStatusMap)).toEqual([
          'active',
          'inactive',
          'banned',
        ])
      })

      it('should return correct label and color for each status', () => {
        expect(userStatusMap.active.label).toBe('正常')
        expect(userStatusMap.active.color).toBe('#10b981')
        
        expect(userStatusMap.inactive.label).toBe('未激活')
        expect(userStatusMap.inactive.color).toBe('#9ca3af')
        
        expect(userStatusMap.banned.label).toBe('已封禁')
        expect(userStatusMap.banned.color).toBe('#ef4444')
      })

      it('should have valid color format for all statuses', () => {
        Object.values(userStatusMap).forEach((status) => {
          expect(status.color).toMatch(/^#[0-9a-f]{6}$/i)
        })
      })

      it('should have non-empty labels', () => {
        Object.values(userStatusMap).forEach((status) => {
          expect(status.label.length).toBeGreaterThan(0)
        })
      })

      it('should have all required status properties', () => {
        Object.entries(userStatusMap).forEach(([key, status]) => {
          expect(status).toHaveProperty('label')
          expect(status).toHaveProperty('color')
        })
      })
    })

    describe('status map usage scenarios', () => {
      it('should be used for UI status display', () => {
        const statuses = ['pending', 'approved', 'paid', 'rejected']
        statuses.forEach((status) => {
          const config = commissionStatusMap[status]
          expect(config).toBeDefined()
          expect(typeof config.label).toBe('string')
          expect(typeof config.color).toBe('string')
        })
      })

      it('should provide consistent color scheme', () => {
        const colors = Object.values(commissionStatusMap).map((s) => s.color)
        const uniqueColors = [...new Set(colors)]
        expect(uniqueColors.length).toBe(colors.length)
      })
    })
  })
})
