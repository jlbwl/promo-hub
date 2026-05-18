import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import logger, {
  debug,
  info,
  warn,
  error,
  logRequest,
  logError,
  LogLevel,
} from '../logger.js'

// Mock console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

describe('logger', () => {
  beforeEach(() => {
    console.debug = vi.fn()
    console.info = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    vi.clearAllMocks()
  })

  describe('LogLevel', () => {
    it('should have correct log levels', () => {
      expect(LogLevel.DEBUG).toBe('DEBUG')
      expect(LogLevel.INFO).toBe('INFO')
      expect(LogLevel.WARN).toBe('WARN')
      expect(LogLevel.ERROR).toBe('ERROR')
    })
  })

  describe('log methods', () => {
    it('should call debug', () => {
      debug('debug message')
      expect(console.debug).toHaveBeenCalled()
    })

    it('should call info', () => {
      info('info message')
      expect(console.info).toHaveBeenCalled()
    })

    it('should call warn', () => {
      warn('warn message')
      expect(console.warn).toHaveBeenCalled()
    })

    it('should call error', () => {
      error('error message')
      expect(console.error).toHaveBeenCalled()
    })

    it('should include meta in logs', () => {
      info('with meta', { key: 'value' })
      expect(console.info).toHaveBeenCalled()
    })
  })

  describe('logRequest', () => {
    it('should log request info', () => {
      logRequest('GET', '/api/test', '127.0.0.1', 'user1')
      expect(console.info).toHaveBeenCalled()
    })

    it('should log request without optional fields', () => {
      logRequest('POST', '/api/test')
      expect(console.info).toHaveBeenCalled()
    })
  })

  describe('logError', () => {
    it('should log error details', () => {
      const err = new Error('test error')
      logError(err, 'GET', '/api/test')
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('default export', () => {
    it('should export all methods', () => {
      expect(logger.debug).toBeInstanceOf(Function)
      expect(logger.info).toBeInstanceOf(Function)
      expect(logger.warn).toBeInstanceOf(Function)
      expect(logger.error).toBeInstanceOf(Function)
      expect(logger.logRequest).toBeInstanceOf(Function)
      expect(logger.logError).toBeInstanceOf(Function)
    })
  })
})
