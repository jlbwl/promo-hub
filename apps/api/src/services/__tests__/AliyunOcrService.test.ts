/**
 * AliyunOcrService 单元测试：名称提取严格规则 + OCR 调用编排 + 顶部裁剪
 * （阿里云 SDK 使用 mock，验证请求参数与响应解析）
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const { recognizeAllTextMock } = vi.hoisted(() => ({ recognizeAllTextMock: vi.fn() }))

vi.mock('@alicloud/ocr-api20210707', () => ({
  // 真实 CJS 包在 Node ESM 下：命名空间 default = module.exports，Client 类在其 default 属性
  default: {
    default: class FakeOcrClient {
      recognizeAllText = recognizeAllTextMock
    }
  },
  RecognizeAllTextRequest: class {
    type?: string
    body?: unknown
    constructor(map?: { type?: string }) {
      if (map) Object.assign(this, map)
    }
  }
}))

import {
  cropPosterTopForOcr,
  extractFinanceBrokerName,
  isAliyunOcrConfigured,
  recognizePosterBrokerName,
  recognizePosterText
} from '../AliyunOcrService.js'

const ENV_KEYS = ['ALIYUN_OCR_ACCESS_KEY_ID', 'ALIYUN_OCR_ACCESS_KEY_SECRET', 'ALIYUN_OCR_TYPE', 'ALIYUN_OCR_ENDPOINT'] as const

const withEnv = () => {
  process.env.ALIYUN_OCR_ACCESS_KEY_ID = 'test-id'
  process.env.ALIYUN_OCR_ACCESS_KEY_SECRET = 'test-secret'
}

beforeEach(() => {
  recognizeAllTextMock.mockReset()
})

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

// ===== extractFinanceBrokerName：严格规则 =====

describe('extractFinanceBrokerName', () => {
  it.each([
    [['中国银河证券'], '中国银河证券'],
    // 银行联合海报：银行名与券商名同行，剔除「建设银行」前缀
    [['中国建设银行', '中国银河证券'], '中国银河证券'],
    [['中国建设银行 中国银河证券'], '中国银河证券'],
    [['中国建设银行 China Galaxy Securities 中国银河证券'], '中国银河证券'],
    [['首创证券'], '首创证券'],
    [['国新证券股份有限公司'], '国新证券'],
    [['信达期货'], '信达期货']
  ])('从行「%j」提取「%s」', (lines, expected) => {
    expect(extractFinanceBrokerName(lines as string[])).toBe(expected)
  })

  it('不含「证券/期货」后缀时返回空串（不生成乱码选项）', () => {
    expect(extractFinanceBrokerName(['一键开户 智选银河'])).toBe('')
    expect(extractFinanceBrokerName(['全牌照综合性券商'])).toBe('')
    expect(extractFinanceBrokerName([])).toBe('')
  })
})

// ===== recognizePosterText / recognizePosterBrokerName：OCR 编排 =====

describe('recognizePosterText', () => {
  it('未配置密钥时 isAliyunOcrConfigured 为 false，调用抛错', async () => {
    expect(isAliyunOcrConfigured()).toBe(false)
    await expect(recognizePosterText(Buffer.from('x'))).rejects.toThrow('阿里云 OCR 未配置')
    expect(recognizeAllTextMock).not.toHaveBeenCalled()
  })

  it('调用 RecognizeAllText（默认高精版）并解析 data.content 为行数组', async () => {
    withEnv()
    recognizeAllTextMock.mockResolvedValue({
      body: { data: { content: '中国建设银行\n  中国银河证券 \n一键开户\n' } }
    })

    const { text, lines } = await recognizePosterText(Buffer.from('image-bytes'))

    expect(lines).toEqual(['中国建设银行', '中国银河证券', '一键开户'])
    expect(text).toContain('中国银河证券')
    expect(recognizeAllTextMock).toHaveBeenCalledTimes(1)

    const request = recognizeAllTextMock.mock.calls[0]?.[0] as { type?: string; body?: unknown }
    expect(request.type).toBe('Advanced')
    // 图片二进制以流式请求体传入
    expect(request.body).toBeTruthy()
  })

  it('响应缺失 data.content 时返回空文本不抛错', async () => {
    withEnv()
    recognizeAllTextMock.mockResolvedValue({ body: {} })

    const { text, lines } = await recognizePosterText(Buffer.from('image-bytes'))
    expect(text).toBe('')
    expect(lines).toEqual([])
  })
})

describe('recognizePosterBrokerName', () => {
  it('完整流程：真实图片裁剪 → OCR 文本行 → 提取券商名', async () => {
    withEnv()
    recognizeAllTextMock.mockResolvedValue({
      body: { data: { content: '中国建设银行\n中国银河证券\n一键开户' } }
    })
    const { default: sharp } = await import('sharp')
    const image = await sharp({
      create: { width: 400, height: 800, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).jpeg().toBuffer()

    const { brokerName, lines } = await recognizePosterBrokerName(image)
    expect(brokerName).toBe('中国银河证券')
    expect(lines).toHaveLength(3)
  })
})

// ===== cropPosterTopForOcr：顶部裁剪 =====

describe('cropPosterTopForOcr', () => {
  it('裁剪海报上部 40% 区域', async () => {
    const { default: sharp } = await import('sharp')
    const source = await sharp({
      create: { width: 100, height: 300, channels: 3, background: { r: 200, g: 16, b: 46 } }
    }).png().toBuffer()

    const cropped = await cropPosterTopForOcr(source)

    const meta = await sharp(cropped).metadata()
    expect(meta.width).toBe(100)
    expect(meta.height).toBe(120) // 300 * 0.4
  })

  it('小图不放大：高度低于 60px 时按 60px 下限裁剪', async () => {
    const { default: sharp } = await import('sharp')
    const source = await sharp({
      create: { width: 80, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } }
    }).png().toBuffer()

    const cropped = await cropPosterTopForOcr(source)
    const meta = await sharp(cropped).metadata()
    expect(meta.width).toBe(80)
    expect(meta.height).toBe(60)
  })
})
