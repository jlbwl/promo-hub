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
  })

  describe('maskPhone', () => {
    it('should mask middle 4 digits of phone number', () => {
      expect(maskPhone('13800138000')).toBe('138****8000')
      expect(maskPhone('15012345678')).toBe('150****5678')
    })

    it('should return original if format does not match', () => {
      expect(maskPhone('123')).toBe('123')
      expect(maskPhone('')).toBe('')
    })
  })

  describe('copyToClipboard', () => {
    beforeEach(() => {
      // Mock navigator.clipboard
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
    })
  })
})
