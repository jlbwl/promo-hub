import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  MAX_UPLOAD_SIZE,
  ACCEPTED_IMAGE_TYPES,
} from '../constants'

describe('constants', () => {
  describe('pagination constants', () => {
    it('should have correct default page size', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(10)
    })

    it('should have valid page size options', () => {
      expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100])
      expect(PAGE_SIZE_OPTIONS).toContain(DEFAULT_PAGE_SIZE)
      expect(PAGE_SIZE_OPTIONS.length).toBe(4)
    })

    it('should have page size options in ascending order', () => {
      const sorted = [...PAGE_SIZE_OPTIONS].sort((a, b) => a - b)
      expect(PAGE_SIZE_OPTIONS).toEqual(sorted)
    })
  })

  describe('upload constants', () => {
    it('should have correct max upload size', () => {
      expect(MAX_UPLOAD_SIZE).toBe(5)
      expect(typeof MAX_UPLOAD_SIZE).toBe('number')
      expect(MAX_UPLOAD_SIZE).toBeGreaterThan(0)
    })

    it('should have valid accepted image types', () => {
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/jpeg')
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/png')
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/webp')
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/gif')
    })

    it('should only contain valid MIME types', () => {
      ACCEPTED_IMAGE_TYPES.forEach((type) => {
        expect(type).toMatch(/^image\/\w+$/)
      })
    })

    it('should not contain duplicate MIME types', () => {
      const uniqueTypes = new Set(ACCEPTED_IMAGE_TYPES)
      expect(uniqueTypes.size).toBe(ACCEPTED_IMAGE_TYPES.length)
    })
  })

  describe('constant usage scenarios', () => {
    it('should support pagination with default size', () => {
      const totalItems = 95
      const totalPages = Math.ceil(totalItems / DEFAULT_PAGE_SIZE)
      expect(totalPages).toBe(10)
    })

    it('should validate image file type correctly', () => {
      const validFiles = ['image/jpeg', 'image/png', 'image/webp']
      const invalidFiles = ['application/pdf', 'text/plain', 'video/mp4']

      validFiles.forEach((fileType) => {
        expect(ACCEPTED_IMAGE_TYPES.includes(fileType)).toBe(true)
      })

      invalidFiles.forEach((fileType) => {
        expect(ACCEPTED_IMAGE_TYPES.includes(fileType)).toBe(false)
      })
    })

    it('should calculate upload size in bytes correctly', () => {
      const maxSizeInBytes = MAX_UPLOAD_SIZE * 1024 * 1024
      expect(maxSizeInBytes).toBe(5 * 1024 * 1024)
      expect(maxSizeInBytes).toBe(5242880)
    })
  })
})
