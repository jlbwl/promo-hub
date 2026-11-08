import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { csrfGenerate, csrfVerify, getCsrfToken } from '../csrf-v2.js'

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('CSRF v2 Middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {
      method: 'POST',
      path: '/api/test',
      originalUrl: '/api/test',
      body: {},
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
    }
    res = {
      cookie: vi.fn(),
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      locals: {},
    }
    next = vi.fn()
  })

  describe('csrfGenerate', () => {
    it('should generate token and set cookie', () => {
      csrfGenerate(req as Request, res as Response, next)

      expect(res.cookie).toHaveBeenCalledWith(
        'csrfToken',
        expect.stringMatching(/^[a-f0-9]{64}\.[a-z0-9]+$/),
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'strict',
        })
      )
      expect(res.locals).toHaveProperty('csrfToken')
      expect(next).toHaveBeenCalled()
    })
  })

  describe('csrfVerify', () => {
    it('should bypass GET requests', () => {
      req.method = 'GET'
      csrfVerify(req as Request, res as Response, next)
      expect(next).toHaveBeenCalled()
    })

    it('should bypass HEAD requests', () => {
      req.method = 'HEAD'
      csrfVerify(req as Request, res as Response, next)
      expect(next).toHaveBeenCalled()
    })

    it('should bypass OPTIONS requests', () => {
      req.method = 'OPTIONS'
      csrfVerify(req as Request, res as Response, next)
      expect(next).toHaveBeenCalled()
    })

    it('should bypass login paths', () => {
      const bypassPaths = [
        '/api/admin/login',
        '/api/manager/login',
        '/api/user/login',
        '/api/users/login',
        '/api/employees/login',
        '/api/auth/refresh',
      ]

      bypassPaths.forEach(path => {
        req.path = path
        next.mockClear()
        csrfVerify(req as Request, res as Response, next)
        expect(next).toHaveBeenCalled()
      })
    })

    it('should bypass login paths without /api prefix (nginx strips it)', () => {
      const bypassPaths = [
        '/admin/login',
        '/admin/sms/login',
        '/managers/sms/login',
        '/users/login',
        '/auth/refresh',
      ]

      bypassPaths.forEach(path => {
        req.path = path
        next.mockClear()
        csrfVerify(req as Request, res as Response, next)
        expect(next).toHaveBeenCalled()
      })
    })

    it('should require CSRF token for logout paths', () => {
      const logoutPaths = ['/api/auth/logout', '/api/users/logout', '/auth/logout', '/users/logout']

      logoutPaths.forEach(path => {
        req.path = path
        req.body = {}
        req.headers = {}
        req.cookies = { csrfToken: 'some-token' }
        res.status = vi.fn().mockReturnThis()
        csrfVerify(req as Request, res as Response, next)
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
      })
    })

    it('should return 403 when request token is missing', () => {
      req.body = {}
      req.headers = {}
      req.cookies = { csrfToken: 'some-token' }

      csrfVerify(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: 'CSRF token missing',
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when cookie token is missing', () => {
      req.body = { _csrf: 'some-token' }
      req.cookies = {}

      csrfVerify(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: 'Invalid CSRF token',
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should return 403 when tokens do not match', () => {
      req.body = { _csrf: 'token1' }
      req.cookies = { csrfToken: 'token2' }

      csrfVerify(req as Request, res as Response, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 403,
          message: 'Invalid CSRF token',
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should pass when tokens match (body _csrf)', () => {
      const token = 'valid-token'
      req.body = { _csrf: token }
      req.cookies = { csrfToken: token }

      csrfVerify(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should pass when tokens match (body csrfToken)', () => {
      const token = 'valid-token'
      req.body = { csrfToken: token }
      req.cookies = { csrfToken: token }

      csrfVerify(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should pass when tokens match (header)', () => {
      const token = 'valid-token'
      req.headers = { 'x-csrf-token': token }
      req.cookies = { csrfToken: token }

      csrfVerify(req as Request, res as Response, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('getCsrfToken', () => {
    it('should return new token', () => {
      getCsrfToken(req as Request, res as Response)

      expect(res.cookie).toHaveBeenCalledWith(
        'csrfToken',
        expect.stringMatching(/^[a-f0-9]{64}\.[a-z0-9]+$/),
        expect.any(Object)
      )
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          message: '获取成功',
          data: expect.objectContaining({
            csrfToken: expect.any(String),
          }),
        })
      )
    })
  })
})
