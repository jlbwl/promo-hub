/**
 * 收款码目录：部署替换 api 目录时目录会瞬时消失，上传前必须能自愈重建。
 */
import { describe, expect, it, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ensureQrcodeDir, QRCODE_DIR } from '../qrcodeStorage.js'

afterEach(() => {
  // 用例删除过目录，恢复现场，避免影响其它用例
  mkdirSync(QRCODE_DIR, { recursive: true })
})

describe('ensureQrcodeDir', () => {
  it('目录存在时直接返回路径', () => {
    mkdirSync(QRCODE_DIR, { recursive: true })
    expect(ensureQrcodeDir()).toBe(QRCODE_DIR)
    expect(existsSync(QRCODE_DIR)).toBe(true)
  })

  it('目录被删除（部署替换 api 目录）后能递归重建并写入', () => {
    rmSync(QRCODE_DIR, { recursive: true, force: true })
    expect(existsSync(QRCODE_DIR)).toBe(false)

    expect(ensureQrcodeDir()).toBe(QRCODE_DIR)
    expect(existsSync(QRCODE_DIR)).toBe(true)

    const probe = join(QRCODE_DIR, 'probe.png')
    writeFileSync(probe, 'ok')
    expect(existsSync(probe)).toBe(true)
    rmSync(probe, { force: true })
  })
})
