import { describe, it, expect, vi } from 'vitest'
import {
  parseGroupNameFromFileName,
  buildQrcodePlan,
  runQrcodeUploads,
  pickLocalImages,
  MAX_QRCODE_FILE_SIZE,
  type PickedImage,
  type QrcodeUploadTarget,
} from '../qrcodeUtils'

const makePicked = (name: string, size = 1024): PickedImage => ({
  name,
  size,
  getBlob: async () => new Blob([name]),
})

describe('parseGroupNameFromFileName', () => {
  it('去掉扩展名与空格', () => {
    expect(parseGroupNameFromFileName('888.png')).toBe('888')
    expect(parseGroupNameFromFileName(' 888 .jpg')).toBe('888')
  })

  it('去掉「收款码」「二维码」「qrcode」等后缀与副本序号', () => {
    expect(parseGroupNameFromFileName('888-收款码.png')).toBe('888')
    expect(parseGroupNameFromFileName('888 收款码 (1).png')).toBe('888')
    expect(parseGroupNameFromFileName('vip_888_收款二维码.jpg')).toBe('vip_888')
    expect(parseGroupNameFromFileName('group9_qrcode.webp')).toBe('group9')
  })

  it('支持带目录的文件名', () => {
    expect(parseGroupNameFromFileName('收款码/999 收款码.webp')).toBe('999')
  })

  it('只有「收款码」时解析为空', () => {
    expect(parseGroupNameFromFileName('收款码.png')).toBe('')
    expect(parseGroupNameFromFileName(' 二维码 (2).png')).toBe('')
  })
})

describe('buildQrcodePlan', () => {
  const customers = [
    { id: 'cust_888', groupName: '888' },
    { id: 'cust_999', groupName: '999' },
  ]

  it('识别匹配成功、找不到客户、冲突、格式不支持与超限文件', () => {
    const plan = buildQrcodePlan(
      [
        makePicked('888 收款码.png'),
        makePicked('777收款码.png'),
        makePicked('999收款码.png'),
        makePicked('999.png'),
        makePicked('readme.txt'),
        makePicked('111收款码.png', MAX_QRCODE_FILE_SIZE + 1),
        makePicked('收款码.png'),
      ],
      customers
    )

    expect(plan.targets).toHaveLength(1)
    expect(plan.targets[0]).toMatchObject({
      groupName: '888',
      customerId: 'cust_888',
      fileName: '888 收款码.png',
    })
    expect(plan.matchedGroupCount).toBe(1)
    expect(plan.unmatchedGroups).toEqual(['777'])
    expect(plan.conflicts).toEqual([
      { groupName: '999', fileNames: ['999收款码.png', '999.png'] },
    ])
    expect(plan.unsupported).toEqual(['readme.txt'])
    expect(plan.oversize).toEqual(['111收款码.png'])
    expect(plan.unparsed).toEqual(['收款码.png'])
  })

  it('恰好 5MB 的图片允许上传', () => {
    const plan = buildQrcodePlan([makePicked('888.png', MAX_QRCODE_FILE_SIZE)], customers)
    expect(plan.targets).toHaveLength(1)
    expect(plan.oversize).toHaveLength(0)
  })

  it('群号精确匹配，不做模糊或大小写归并', () => {
    const plan = buildQrcodePlan([makePicked('888abc.png')], customers)
    expect(plan.targets).toHaveLength(0)
    expect(plan.unmatchedGroups).toEqual(['888abc'])
  })

  it('pickLocalImages 保留原始文件并可直接读取 Blob', async () => {
    const file = new File(['content'], '888.png', { type: 'image/png' })
    const [picked] = pickLocalImages([file])
    expect(picked.name).toBe('888.png')
    expect(picked.size).toBe(file.size)
    await expect(picked.getBlob()).resolves.toBe(file)
  })
})

describe('runQrcodeUploads', () => {
  const targets: QrcodeUploadTarget[] = [
    { groupName: '888', customerId: 'c1', fileName: '888.png', size: 10, getBlob: async () => new Blob(['a']) },
    { groupName: '999', customerId: 'c2', fileName: '999.png', size: 10, getBlob: async () => new Blob(['b']) },
    { groupName: '777', customerId: 'c3', fileName: '777.png', size: 10, getBlob: async () => new Blob(['c']) },
  ]

  it('单条失败不中断，记录阶段与群号', async () => {
    const upload = vi.fn(async (_blob: Blob, fileName: string) => {
      if (fileName === '888.png') throw new Error('网络错误')
      return `/uploads/qrcodes/${fileName}`
    })
    const save = vi.fn(async (_id: string, url: string) => {
      if (url.includes('999.png')) throw new Error('回写失败')
    })
    const onProgress = vi.fn()

    const result = await runQrcodeUploads(targets, { upload, save, onProgress })

    expect(result.success).toBe(1)
    expect(result.failures).toEqual([
      { groupName: '888', fileName: '888.png', stage: 'upload', reason: '网络错误' },
      { groupName: '999', fileName: '999.png', stage: 'save', reason: '回写失败' },
    ])
    // 第一条上传失败后不应再尝试回写
    expect(save).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
  })

  it('全部成功时返回成功数且无失败项', async () => {
    const result = await runQrcodeUploads(targets, {
      upload: async (_blob, fileName) => `/uploads/qrcodes/${fileName}`,
      save: async () => undefined,
    })

    expect(result.success).toBe(3)
    expect(result.failures).toHaveLength(0)
  })
})
