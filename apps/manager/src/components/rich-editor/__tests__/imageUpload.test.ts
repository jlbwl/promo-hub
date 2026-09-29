/**
 * imageUpload 单元测试：压缩失败路径与服务器上传
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { compressImage, uploadToServer } from '../imageUpload'

vi.mock('@promo/shared/utils/request', () => ({
  post: vi.fn().mockResolvedValue({ data: { url: 'https://cdn.example.com/a.jpg' } }),
}))

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('compressImage', () => {
  it('图片加载失败时 reject「图片加载失败」', async () => {
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        queueMicrotask(() => this.onerror?.())
      }
    })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await expect(compressImage(file)).rejects.toThrow('图片加载失败')
  })

  it('Canvas 上下文不可用时 reject「Canvas 不支持」', async () => {
    vi.stubGlobal('Image', class {
      width = 100
      height = 100
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        queueMicrotask(() => this.onload?.())
      }
    })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => null,
      }),
    })

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await expect(compressImage(file)).rejects.toThrow('Canvas 不支持')
  })
})

describe('uploadToServer', () => {
  it('上传后返回服务器 URL', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const url = await uploadToServer(file)
    expect(url).toBe('https://cdn.example.com/a.jpg')
  })
})
