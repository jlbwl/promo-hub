import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { userService } from '../UserService.js'

// Mock data module
vi.mock('../../data.js', () => ({
  readUsers: vi.fn(),
  writeUsers: vi.fn()
}))

import { readUsers, writeUsers } from '../../data.js'

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerUser', () => {
    it('should register user successfully', async () => {
      const userData = {
        phone: '13800138000',
        password: 'password123',
        nickname: '测试用户',
        teamName: '测试团队'
      }

      vi.mocked(readUsers).mockResolvedValue([])

      const result = await userService.registerUser(userData)

      expect(result).toEqual(expect.objectContaining({
        phone: '13800138000',
        nickname: '测试用户',
        teamName: '测试团队',
        role: 'user',
        status: 'active'
      }))
      expect(writeUsers).toHaveBeenCalled()
    })

    it('should throw error when phone format is invalid', async () => {
      await expect(userService.registerUser({
        phone: '123',
        password: 'password'
      })).rejects.toThrow('手机号格式不正确')
    })

    it('should throw error when password too short', async () => {
      await expect(userService.registerUser({
        phone: '13800138000',
        password: '123'
      })).rejects.toThrow('密码长度不能少于6位')
    })
  })
})
