import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { AppError, ErrorCode, HttpStatus } from '@promo/shared'
import { classifyUploadError } from '../uploadError.js'
import { errorHandler } from '../response.js'

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response & typeof res
}

const makeReq = () => ({ method: 'POST', originalUrl: '/upload', ip: '10.0.0.1' }) as unknown as Request

describe('上传错误分类', () => {
  it('体积超限（Multer LIMIT_FILE_SIZE）→ 413 + FILE_TOO_LARGE', () => {
    const result = classifyUploadError(Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' }))
    expect(result.status).toBe(413)
    expect(result.code).toBe(413)
    expect(result.reason).toBe('FILE_TOO_LARGE')
    expect(result.message).toContain('大小')
  })

  it('文件类型不支持 → 400 + UNSUPPORTED_TYPE，保留明确业务文案', () => {
    const result = classifyUploadError(
      new AppError('只支持 JPEG/PNG/WebP 格式', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    )
    expect(result.status).toBe(400)
    expect(result.reason).toBe('UNSUPPORTED_TYPE')
    expect(result.message).toBe('只支持 JPEG/PNG/WebP 格式')
  })

  it('上传字段名错误（LIMIT_UNEXPECTED_FILE）→ 400 + INVALID_REQUEST', () => {
    const result = classifyUploadError(Object.assign(new Error('Unexpected field'), { code: 'LIMIT_UNEXPECTED_FILE' }))
    expect(result.status).toBe(400)
    expect(result.reason).toBe('INVALID_REQUEST')
  })

  it('处理/存储失败 → 500 + STORAGE_FAILED，且不回显底层异常内容', () => {
    const result = classifyUploadError(new Error('Input buffer contains unsupported image format'))
    expect(result.status).toBe(500)
    expect(result.code).toBe(500)
    expect(result.reason).toBe('STORAGE_FAILED')
    expect(result.message).not.toContain('Input buffer')
    expect(result.message).not.toContain('unsupported')
  })

  it('存储目录不存在（ENOENT）→ STORAGE_FAILED，提示可定位且不带服务器路径', () => {
    const error = Object.assign(
      new Error("ENOENT: no such file or directory, open '/www/wwwroot/promo-hub/api/data/uploads/qrcodes/qr_1.png'"),
      { code: 'ENOENT' }
    )
    const result = classifyUploadError(error)
    expect(result.status).toBe(500)
    expect(result.reason).toBe('STORAGE_FAILED')
    expect(result.message).toContain('存储目录')
    expect(result.message).not.toContain('/www/wwwroot')
  })

  it('无写权限 / 磁盘已满 → STORAGE_FAILED', () => {
    for (const code of ['EACCES', 'ENOSPC', 'EROFS']) {
      const result = classifyUploadError(Object.assign(new Error('write failed'), { code }))
      expect(result.reason).toBe('STORAGE_FAILED')
      expect(result.message).toContain('存储目录')
    }
  })
})

describe('全局错误处理中间件对上传错误的映射', () => {
  it('LIMIT_FILE_SIZE 映射为 HTTP 413（而非 400/500）', () => {
    const res = makeRes()
    errorHandler(
      Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' }),
      makeReq(),
      res,
      vi.fn()
    )
    expect(res.status).toHaveBeenCalledWith(413)
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 413, data: { reason: 'FILE_TOO_LARGE' } })
  })

  it('LIMIT_UNEXPECTED_FILE 映射为 HTTP 400', () => {
    const res = makeRes()
    errorHandler(
      Object.assign(new Error('Unexpected field'), { code: 'LIMIT_UNEXPECTED_FILE' }),
      makeReq(),
      res,
      vi.fn()
    )
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
