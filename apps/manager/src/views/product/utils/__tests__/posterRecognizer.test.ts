/**
 * posterRecognizer 单元测试：券商名称提取纯函数 + recognizePosterFile 编排逻辑
 * （jsQR / tesseract.js / Canvas / Image 均使用 mock，验证策略与容错路径）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@promo/shared/utils/logger'

const { createWorkerMock, jsQRMocket } = vi.hoisted(() => ({
  createWorkerMock: vi.fn(),
  jsQRMocket: vi.fn(),
}))

vi.mock('tesseract.js', () => ({ createWorker: createWorkerMock }))
vi.mock('jsqr', () => ({ default: jsQRMocket }))
vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { Worker } from 'tesseract.js'
import type { PosterProgressReporter } from '../posterRecognizer'

/** 每个用例重新加载模块，隔离模块级的 OCR Worker 缓存 */
const loadModule = async () => await import('../posterRecognizer')

// ===== 测试基建 =====

/** 可控加载结果的 FakeImage（模拟本地文件解码成功/失败） */
class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 750
  naturalHeight = 1200
  ok = true
  private _src = ''
  set src(v: string) {
    this._src = v
    queueMicrotask(() => (this.ok ? this.onload?.() : this.onerror?.()))
  }
  get src() {
    return this._src
  }
}

/** 伪造 2D 上下文：绘制调用记录化，像素数据统一为白色 */
const makeCtx = () => ({
  fillStyle: '',
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4).fill(255),
    width: w,
    height: h,
  })),
  createImageData: vi.fn((w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  })),
  putImageData: vi.fn(),
})

/** 配置 OCR Worker mock：按顺序吐出识别文本，可选触发进度回调 */
const setOcrResults = (texts: string[], fireProgress = false) => {
  createWorkerMock.mockImplementation(
    (_lang: string, _oem: number, opts: { logger?: (m: { status: string; progress: number }) => void }) => {
      const recognize = vi.fn(async () => {
        if (fireProgress) opts.logger?.({ status: 'recognizing text', progress: 0.5 })
        const text = texts.shift() ?? ''
        return { data: { text } }
      })
      return Promise.resolve({ recognize, terminate: vi.fn(), setParameters: vi.fn() }) as unknown as Promise<Worker>
    }
  )
}

const makeFile = (name = 'p.png') => new File(['x'], name, { type: 'image/png' })

/** 仅替换 URL 的 objectURL 静态方法，保留 URL 构造器（模块动态加载依赖 new URL） */
let urlMocks = { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() }
const stubUrlObjectUrls = () => {
  urlMocks = {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  }
  Object.defineProperty(URL, 'createObjectURL', { value: urlMocks.createObjectURL, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: urlMocks.revokeObjectURL, configurable: true, writable: true })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.stubGlobal('Image', FakeImage)
  stubUrlObjectUrls()
  // happy-dom 无 canvas 实现，统一 mock 2D 上下文
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>
  if (typeof proto.getContext !== 'function') proto.getContext = () => null
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => makeCtx() as unknown as CanvasRenderingContext2D)
  jsQRMocket.mockReturnValue(null)
})

// ===== extractBrokerName 纯函数 =====

describe('extractBrokerName', () => {
  it.each([
    ['首 创 证 券', '首创证券'],
    ['国新证券股份有限公司', '国新证券'],
    ['SCZQ\n首创证券\n热销', '首创证券'],
    ['国泰君安证券欢迎您', '国泰君安证券'],
    ['信达期货开户', '信达期货'],
    // 银行联合海报：剔除「建设银行」等无关前缀，仅保留券商名
    ['中国建设银行 中国银河证券', '中国银河证券'],
    ['中国建设银行 China Construction Bank 中国银河证券 CHINA GALAXY SECURITIES', '中国银河证券'],
    ['免责条款中国银河证券实际开通情况为准', '中国银河证券'],
  ])('从 OCR 文本「%s」中提取「%s」', (input, expected) => {
    return loadModule().then(({ extractBrokerName }) => {
      expect(extractBrokerName(input)).toBe(expected)
    })
  })

  it('不含「证券/期货」后缀时返回空字符串（不再兜底任意中文片段，避免乱码选项）', async () => {
    const { extractBrokerName } = await loadModule()
    expect(extractBrokerName('东方财富热销中 abc')).toBe('')
    expect(extractBrokerName('一键开户 智选银河')).toBe('')
    expect(extractBrokerName('丐下扒手得利天级')).toBe('')
    expect(extractBrokerName('全牌照综合性券商')).toBe('')
  })

  it('空文本或无中文时返回空字符串', async () => {
    const { extractBrokerName } = await loadModule()
    expect(extractBrokerName('')).toBe('')
    expect(extractBrokerName('ABC 123')).toBe('')
  })
})

// ===== recognizePosterFile 编排逻辑 =====

describe('recognizePosterFile', () => {
  it('二维码与券商名称均识别成功，进度以「完成」收尾', async () => {
    const { recognizePosterFile } = await loadModule()
    jsQRMocket.mockReturnValueOnce({ data: 'https://example.com/open?ch=sc01' })
    setOcrResults(['国新证券'])

    const progress: Array<[number, string]> = []
    const result = await recognizePosterFile(makeFile(), ((p: number, s: string) => {
      progress.push([p, s])
    }) as PosterProgressReporter)

    expect(result).toEqual({ brokerName: '国新证券', redirectUrl: 'https://example.com/open?ch=sc01' })
    expect(progress[0]).toEqual([3, '解析图片'])
    expect(progress[progress.length - 1]).toEqual([100, '完成'])
    // jsQR 收到 RGBA 像素数据与反色尝试配置
    expect(jsQRMocket).toHaveBeenCalledWith(expect.any(Uint8ClampedArray), expect.any(Number), expect.any(Number), { inversionAttempts: 'attemptBoth' })
  })

  it('多策略解码优先采纳 http(s) URL，而非普通文本', async () => {
    const { recognizePosterFile } = await loadModule()
    jsQRMocket.mockReturnValueOnce({ data: 'not-a-url' }).mockReturnValueOnce({ data: 'https://example.com/x' })
    setOcrResults(['信达证券'])

    const result = await recognizePosterFile(makeFile())
    expect(result.redirectUrl).toBe('https://example.com/x')
  })

  it('无 URL 时返回首个非空解码内容兜底', async () => {
    const { recognizePosterFile } = await loadModule()
    jsQRMocket.mockReturnValue({ data: 'PLAIN-TOKEN' })
    setOcrResults(['信达证券'])

    const result = await recognizePosterFile(makeFile())
    expect(result.redirectUrl).toBe('PLAIN-TOKEN')
  })

  it('某区域解码抛错时记录日志并继续，不影响整体识别', async () => {
    const { recognizePosterFile } = await loadModule()
    jsQRMocket.mockImplementationOnce(() => { throw new Error('bad region') })
    setOcrResults(['信达证券'])

    const result = await recognizePosterFile(makeFile())
    expect(result.redirectUrl).toBe('')
    expect(logger.error).toHaveBeenCalledWith('二维码解码区域失败:', expect.any(Error))
  })

  it('彩色图严格匹配失败时，二值化重试命中「××证券」', async () => {
    const { recognizePosterFile } = await loadModule()
    setOcrResults(['首创证劳', '首创证券'])

    const result = await recognizePosterFile(makeFile())
    expect(result.brokerName).toBe('首创证券')
    // 第一次严格失败 → 二值化第二次识别
    const worker = await createWorkerMock.mock.results[0].value as Worker
    expect(worker.recognize).toHaveBeenCalledTimes(2)
  })

  it('两次均未严格命中时走模糊纠错「××证Y」→「××证券」', async () => {
    const { recognizePosterFile } = await loadModule()
    setOcrResults(['国新证刚', '国新证刚'])

    const result = await recognizePosterFile(makeFile())
    expect(result.brokerName).toBe('国新证券')
  })

  it('「证明」等非「券」形近误识不做模糊纠错，避免误判', async () => {
    const { recognizePosterFile } = await loadModule()
    setOcrResults(['相关证明', '相关证明'])

    const result = await recognizePosterFile(makeFile())
    expect(result.brokerName).toBe('')
  })

  it('OCR 全部失败时券商名为空但不抛错', async () => {
    const { recognizePosterFile } = await loadModule()
    setOcrResults(['xyz123', 'ABC456'])

    const result = await recognizePosterFile(makeFile())
    expect(result.brokerName).toBe('')
    expect(result.redirectUrl).toBe('')
  })

  it('OCR Worker 创建失败时记录日志，二维码结果不受影响', async () => {
    const { recognizePosterFile } = await loadModule()
    jsQRMocket.mockReturnValue({ data: 'https://example.com/ok' })
    createWorkerMock.mockRejectedValue(new Error('worker boom'))

    const result = await recognizePosterFile(makeFile())
    expect(result).toEqual({ brokerName: '', redirectUrl: 'https://example.com/ok' })
    expect(logger.error).toHaveBeenCalledWith('券商名称识别失败:', expect.any(Error))
  })

  it('图片解析失败时向上抛出统一错误', async () => {
    const { recognizePosterFile } = await loadModule()
    const BadImage = class extends FakeImage { ok = false }
    vi.stubGlobal('Image', BadImage)

    await expect(recognizePosterFile(makeFile())).rejects.toThrow('图片解析失败，文件可能已损坏')
  })

  it('进度回调抛异常不影响识别流程，且百分比钳制在 0-100', async () => {
    const { recognizePosterFile } = await loadModule()
    setOcrResults(['信达证券'], true)

    const seen: number[] = []
    const result = await recognizePosterFile(makeFile(), ((p: number) => {
      seen.push(p)
      throw new Error('callback boom')
    }) as PosterProgressReporter)

    expect(result.brokerName).toBe('信达证券')
    expect(seen.every(p => p >= 0 && p <= 100)).toBe(true)
    // recognizing text progress=0.5 → 55 + 20 = 75
    expect(seen).toContain(75)
  })
})
