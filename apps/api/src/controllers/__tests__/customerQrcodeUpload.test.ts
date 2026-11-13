/**
 * 收款码上传控制器：成功分支与各类失败分支（无文件 / 格式不支持 / 超过 5MB）。
 * 文件落盘后的校验失败必须清理半成品文件。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync } from 'fs'
import type { Request, Response } from 'express'
import { uploadCustomerQrcode } from '../customer.controller.js'

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response & ReturnType<typeof makeRes>
}

const makeReq = (file?: Record<string, unknown>): Request =>
  ({ file, body: {}, query: {}, params: {}, headers: {}, user: { id: 'admin_1', role: 'admin' } }) as unknown as Request

const tempFiles: string[] = []

const makeTempFile = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'qrcode-upload-'))
  const filePath = join(dir, 'qr_test.png')
  writeFileSync(filePath, 'fake-image')
  tempFiles.push(dir)
  return filePath
}

afterEach(() => {
  tempFiles.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }))
})

describe('uploadCustomerQrcode', () => {
  it('合法图片返回可回写的 /uploads 地址', async () => {
    const res = makeRes()
    const filePath = makeTempFile()
    const next = vi.fn()
    await uploadCustomerQrcode(
      makeReq({ mimetype: 'image/png', size: 2048, filename: 'qr_1.png', originalname: '10302032云帆科技.png', path: filePath }),
      res,
      next
    )
    if (next.mock.calls.length) {
      throw next.mock.calls[0][0]
    }

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        message: '上传成功',
        data: { url: '/uploads/qrcodes/qr_1.png' },
      })
    )
    // 校验通过不应删除文件
    expect(existsSync(filePath)).toBe(true)
  })

  it('没有文件时返回 NO_FILE，而不是 500', async () => {
    const res = makeRes()
    await uploadCustomerQrcode(makeReq(undefined), res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 400, message: '请选择收款码图片', data: { reason: 'NO_FILE' } })
    )
  })

  it('格式不支持时返回明确提示并删除已落盘文件', async () => {
    const res = makeRes()
    const filePath = makeTempFile()
    await uploadCustomerQrcode(
      makeReq({ mimetype: 'image/gif', size: 2048, filename: 'qr_1.gif', originalname: 'qr.gif', path: filePath }),
      res,
      vi.fn()
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '只支持 JPEG/PNG/WebP 格式',
        data: { reason: 'UNSUPPORTED_TYPE' },
      })
    )
    expect(existsSync(filePath)).toBe(false)
  })

  it('超过 5MB 时返回 FILE_TOO_LARGE 并删除已落盘文件', async () => {
    const res = makeRes()
    const filePath = makeTempFile()
    await uploadCustomerQrcode(
      makeReq({ mimetype: 'image/png', size: 6 * 1024 * 1024, filename: 'qr_big.png', originalname: 'qr_big.png', path: filePath }),
      res,
      vi.fn()
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('5MB'),
        data: { reason: 'FILE_TOO_LARGE' },
      })
    )
    expect(existsSync(filePath)).toBe(false)
  })
})
