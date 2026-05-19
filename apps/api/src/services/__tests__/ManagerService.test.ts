import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { managerService } from '../ManagerService.js'

// Mock data module
vi.mock('../../data.js', () => ({
  readManagers: vi.fn(),
  readProducts: vi.fn(),
  readOrders: vi.fn(),
  insertManager: vi.fn(),
  updateManager: vi.fn(),
  deleteManager: vi.fn()
}))

import {
  readManagers,
  readProducts,
  readOrders,
  insertManager,
  updateManager,
  deleteManager
} from '../../data.js'

describe('ManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getManagers', () => {
    it('should get all managers', async () => {
      const mockManagers = [
        { id: 'm1', teamName: '团队1', password: 'hashed', status: 'active' },
        { id: 'm2', teamName: '团队2', password: 'hashed', status: 'active' }
      ]
      vi.mocked(readManagers).mockResolvedValue(mockManagers)

      const result = await managerService.getManagers()

      expect(result.length).toBe(2)
    })
  })

  describe('getManagerById', () => {
    it('should get manager by id', async () => {
      const mockManager = { id: 'm1', teamName: '团队1', password: 'hashed' }
      vi.mocked(readManagers).mockResolvedValue([mockManager])

      const result = await managerService.getManagerById('m1')

      expect(result).toEqual(expect.objectContaining({
        id: 'm1',
        teamName: '团队1'
      }))
    })

    it('should throw error when manager not found', async () => {
      vi.mocked(readManagers).mockResolvedValue([])

      await expect(managerService.getManagerById('m999')).rejects.toThrow('经理不存在')
    })
  })

  describe('createManager', () => {
    it('should create manager successfully', async () => {
      const managerData = {
        teamName: '新团队',
        password: 'password123',
        phone: '13800138000',
        name: '经理姓名'
      }

      vi.mocked(readManagers).mockResolvedValue([])
      vi.mocked(insertManager).mockResolvedValue(undefined)

      const result = await managerService.createManager(managerData)

      expect(result).toEqual(expect.objectContaining({
        teamName: '新团队',
        status: 'active'
      }))
      expect(insertManager).toHaveBeenCalled()
    })
  })
})
