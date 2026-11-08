import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { resourcePermission, ResourcePermissionChecker } from '../resourcePermission.js'
import { queryOne } from '../../data/index.js'
import type { AuthUser } from '../auth.js'

vi.mock('../../data/index.js', () => ({
  queryOne: vi.fn(),
}))

// 构造最小可用的鉴权用户，避免测试中散落 any
const authUser = (
  id: string,
  role: AuthUser['role'],
  extra: Partial<Omit<AuthUser, 'id' | 'role'>> = {}
): AuthUser => ({ id, role, phone: '', ...extra })

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('resourcePermission middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {
      user: undefined,
      params: {},
      query: {},
    }
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    next = vi.fn()
    vi.clearAllMocks()
  })

  describe('authentication checks', () => {
    it('should return 401 when user is not logged in', async () => {
      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        code: 401,
        message: '未登录或会话已过期',
        data: null,
      })
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('admin override', () => {
    it('should skip permission check for admin when adminOverride is true', async () => {
      req.user = authUser('admin1', 'admin')
      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
        adminOverride: true,
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should still check permissions for admin when adminOverride is false', async () => {
      req.user = authUser('admin1', 'admin')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ id: 'product1', managerId: 'manager1', status: 'draft' })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
        adminOverride: false,
      })

      await middleware(req as Request, res as Response, next)

      // Admin always has permission in checkResourcePermission
      expect(next).toHaveBeenCalled()
    })
  })

  describe('list action', () => {
    it('should skip permission check for list action', async () => {
      req.user = authUser('user1', 'user')
      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'list',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('missing resource ID', () => {
    it('should return 400 when resource ID is missing for non-list action', async () => {
      req.user = authUser('user1', 'user')
      req.params = {}
      
      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        code: 400,
        message: '缺少资源ID参数',
        data: null,
      })
      expect(next).not.toHaveBeenCalled()
    })

    it('should use custom resourceIdParam when specified', async () => {
      req.user = authUser('user1', 'user')
      req.params = { productId: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ id: 'product1', managerId: 'user1', status: 'published' })

      const middleware = resourcePermission({
        resourceType: 'product',
        resourceIdParam: 'productId',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('product permissions', () => {
    it('should allow manager to read own product', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ 
        id: 'product1', 
        managerId: 'manager1', 
        status: 'draft' 
      })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(req.resourceOwnerId).toBe('manager1')
    })

    it('should deny manager to read other manager product', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ 
        id: 'product1', 
        managerId: 'manager2', 
        status: 'draft' 
      })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })

    it('should allow user to read published product', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ 
        id: 'product1', 
        managerId: 'manager1', 
        status: 'published' 
      })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should deny user to read draft product', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ 
        id: 'product1', 
        managerId: 'manager1', 
        status: 'draft' 
      })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('should allow employee to read published product', async () => {
      req.user = authUser('emp1', 'employee')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ 
        id: 'product1', 
        managerId: 'manager1', 
        status: 'published' 
      })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should allow manager to write own product', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue({ 
        id: 'product1', 
        managerId: 'manager1', 
        status: 'draft' 
      })

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'update',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should return 404 for non-existent product', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'product1' }
      
      vi.mocked(queryOne).mockResolvedValue(null)

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '产品不存在',
        })
      )
    })
  })

  describe('manager permissions', () => {
    it('should allow manager to access own resource', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'manager1' }

      const middleware = resourcePermission({
        resourceType: 'manager',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(req.resourceOwnerId).toBe('manager1')
    })

    it('should deny manager to access other manager resource', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'manager2' }

      const middleware = resourcePermission({
        resourceType: 'manager',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })
  })

  describe('user permissions', () => {
    it('should allow user to access own resource', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'user1' }

      const middleware = resourcePermission({
        resourceType: 'user',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(req.resourceOwnerId).toBe('user1')
    })

    it('should deny user to access other user resource', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'user2' }

      const middleware = resourcePermission({
        resourceType: 'user',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('should allow manager to access team user', async () => {
      req.user = authUser('manager1', 'manager', { teamName: 'team1' })
      req.params = { id: 'user1' }

      // M21：JWT 无 teamName，代码会按经理 ID 再查一次 managers.teamName
      vi.mocked(queryOne).mockImplementation(async (sql: unknown) => (
        String(sql).includes('managers')
          ? { teamName: 'team1' }
          : { id: 'user1', teamName: 'team1' }
      ))

      const middleware = resourcePermission({
        resourceType: 'user',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should deny manager to access non-team user', async () => {
      req.user = authUser('manager1', 'manager', { teamName: 'team1' })
      req.params = { id: 'user1' }

      vi.mocked(queryOne).mockImplementation(async (sql: unknown) => (
        String(sql).includes('managers')
          ? { teamName: 'team1' }
          : { id: 'user1', teamName: 'team2' }
      ))

      const middleware = resourcePermission({
        resourceType: 'user',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })
  })

  describe('order permissions', () => {
    it('should allow user to access own order', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'order1' }

      vi.mocked(queryOne).mockResolvedValueOnce({ 
        id: 'order1', 
        userId: 'user1', 
        productId: 'product1' 
      })

      const middleware = resourcePermission({
        resourceType: 'order',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(req.resourceOwnerId).toBe('user1')
    })

    it('should deny user to access other user order', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'order1' }

      vi.mocked(queryOne).mockResolvedValueOnce({ 
        id: 'order1', 
        userId: 'user2', 
        productId: 'product1' 
      })

      const middleware = resourcePermission({
        resourceType: 'order',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('should allow manager to access team order', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'order1' }

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ 
          id: 'order1', 
          userId: 'user1', 
          productId: 'product1' 
        })
        .mockResolvedValueOnce({ 
          managerId: 'manager1' 
        })

      const middleware = resourcePermission({
        resourceType: 'order',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should deny manager to access non-team order', async () => {
      req.user = authUser('manager1', 'manager')
      req.params = { id: 'order1' }

      vi.mocked(queryOne)
        .mockResolvedValueOnce({ 
          id: 'order1', 
          userId: 'user1', 
          productId: 'product1' 
        })
        .mockResolvedValueOnce({ 
          managerId: 'manager2' 
        })

      const middleware = resourcePermission({
        resourceType: 'order',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })
  })

  describe('category permissions', () => {
    it('should allow anyone to read category', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'category1' }

      const middleware = resourcePermission({
        resourceType: 'category',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should allow anyone to list categories', async () => {
      req.user = authUser('user1', 'user')

      const middleware = resourcePermission({
        resourceType: 'category',
        action: 'list',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })

    it('should deny non-admin to create category', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'category1' }

      const middleware = resourcePermission({
        resourceType: 'category',
        action: 'create',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('should allow admin to create category', async () => {
      req.user = authUser('admin1', 'admin')
      req.params = { id: 'category1' }

      const middleware = resourcePermission({
        resourceType: 'category',
        action: 'create',
      })

      await middleware(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 when database error occurs', async () => {
      req.user = authUser('user1', 'user')
      req.params = { id: 'product1' }

      vi.mocked(queryOne).mockRejectedValue(new Error('Database error'))

      const middleware = resourcePermission({
        resourceType: 'product',
        action: 'read',
      })

      await middleware(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        code: 500,
        message: '权限验证时出错',
        data: null,
      })
    })
  })
})

describe('ResourcePermissionChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkProduct', () => {
    it('should allow admin to access any product', async () => {
      const result = await ResourcePermissionChecker.checkProduct(
        'admin1',
        'admin',
        'product1',
        'read'
      )

      expect(result.allowed).toBe(true)
    })

    it('should return false for non-existent product', async () => {
      vi.mocked(queryOne).mockResolvedValue(null)

      const result = await ResourcePermissionChecker.checkProduct(
        'user1',
        'user',
        'product1',
        'read'
      )

      expect(result.allowed).toBe(false)
      expect(result.message).toBe('产品不存在')
    })

    it('should allow manager to read own product', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: 'product1',
        managerId: 'manager1',
        status: 'draft',
      })

      const result = await ResourcePermissionChecker.checkProduct(
        'manager1',
        'manager',
        'product1',
        'read'
      )

      expect(result.allowed).toBe(true)
      expect(result.product).toBeDefined()
    })

    it('should allow user to read published product', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: 'product1',
        managerId: 'manager1',
        status: 'published',
      })

      const result = await ResourcePermissionChecker.checkProduct(
        'user1',
        'user',
        'product1',
        'read'
      )

      expect(result.allowed).toBe(true)
    })

    it('should deny user to read draft product', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: 'product1',
        managerId: 'manager1',
        status: 'draft',
      })

      const result = await ResourcePermissionChecker.checkProduct(
        'user1',
        'user',
        'product1',
        'read'
      )

      expect(result.allowed).toBe(false)
    })

    it('should allow manager to write own product', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: 'product1',
        managerId: 'manager1',
        status: 'draft',
      })

      const result = await ResourcePermissionChecker.checkProduct(
        'manager1',
        'manager',
        'product1',
        'update'
      )

      expect(result.allowed).toBe(true)
    })

    it('should deny manager to write other product', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: 'product1',
        managerId: 'manager2',
        status: 'draft',
      })

      const result = await ResourcePermissionChecker.checkProduct(
        'manager1',
        'manager',
        'product1',
        'update'
      )

      expect(result.allowed).toBe(false)
    })
  })

  describe('checkUser', () => {
    it('should allow admin to access any user', async () => {
      const result = await ResourcePermissionChecker.checkUser(
        'admin1',
        'admin',
        'user1',
        'read'
      )

      expect(result.allowed).toBe(true)
    })

    it('should allow user to access self', async () => {
      vi.mocked(queryOne).mockResolvedValue({
        id: 'user1',
        teamName: 'team1',
      })

      const result = await ResourcePermissionChecker.checkUser(
        'user1',
        'user',
        'user1',
        'read'
      )

      expect(result.allowed).toBe(true)
      expect(result.user).toBeDefined()
    })

    it('should deny user to access other user', async () => {
      const result = await ResourcePermissionChecker.checkUser(
        'user1',
        'user',
        'user2',
        'read'
      )

      expect(result.allowed).toBe(false)
    })

    it('should allow manager to access team user', async () => {
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: 'user1',
          teamName: 'team1',
        })
        .mockResolvedValueOnce({
          teamName: 'team1',
        })

      const result = await ResourcePermissionChecker.checkUser(
        'manager1',
        'manager',
        'user1',
        'read'
      )

      expect(result.allowed).toBe(true)
    })

    it('should deny manager to access non-team user', async () => {
      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: 'user1',
          teamName: 'team2',
        })
        .mockResolvedValueOnce({
          teamName: 'team1',
        })

      const result = await ResourcePermissionChecker.checkUser(
        'manager1',
        'manager',
        'user1',
        'read'
      )

      expect(result.allowed).toBe(false)
    })

    it('should return false for non-existent user', async () => {
      vi.mocked(queryOne).mockResolvedValue(null)

      const result = await ResourcePermissionChecker.checkUser(
        'manager1',
        'manager',
        'user1',
        'read'
      )

      expect(result.allowed).toBe(false)
      expect(result.message).toBe('用户不存在')
    })
  })
})
