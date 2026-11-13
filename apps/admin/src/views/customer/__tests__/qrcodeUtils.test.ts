import { describe, it, expect, vi } from 'vitest'
import {
  parseGroupNameFromFileName,
  extractGroupNumber,
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
      { groupName: '999', fileNames: ['999收款码.png', '999.png'], reason: 'duplicate-file' },
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

  it('群号段不相同的文件不会误命中', () => {
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

describe('extractGroupNumber', () => {
  it('取开头连续数字，遇到中文、空格、下划线、括号即截断', () => {
    expect(extractGroupNumber('111211100 博信网络')).toBe('111211100')
    expect(extractGroupNumber('10302032云帆科技')).toBe('10302032')
    expect(extractGroupNumber('10302032云帆科技_z15169262608')).toBe('10302032')
    expect(extractGroupNumber('3291147一恒一树(邝裕恒)')).toBe('3291147')
    expect(extractGroupNumber('4202014\n乐玩小站')).toBe('4202014')
    expect(extractGroupNumber('2131549悦悦科技_徐帅')).toBe('2131549')
  })

  it('前导空格与全角空格被忽略', () => {
    expect(extractGroupNumber('  2131549悦悦科技')).toBe('2131549')
    expect(extractGroupNumber('\u30002131549悦悦科技')).toBe('2131549')
  })

  it('字母数字组合保留并统一大写', () => {
    expect(extractGroupNumber('a123云帆')).toBe('A123')
    expect(extractGroupNumber('Abc888')).toBe('ABC888')
  })

  it('纯中文或单个字母前缀不视为群号', () => {
    expect(extractGroupNumber('科晓网络')).toBe('')
    expect(extractGroupNumber('A 速米科技 招学员')).toBe('')
    expect(extractGroupNumber('A启泓赵老师-学院专业调剂')).toBe('')
  })
})

describe('群号段匹配（线上真实命名）', () => {
  const customers = [
    { id: 'cust_10302032', groupName: '10302032云帆科技' },
    { id: 'cust_111211100', groupName: '111211100 博信网络' },
    { id: 'cust_12301615', groupName: '12301615深圳工作室' },
    { id: 'cust_chen', groupName: 'Chen' },
    { id: 'cust_sumi', groupName: 'A 速米科技 招学员' },
  ]

  it('文件名「群号+名称+下划线联系人」可命中客户', () => {
    const plan = buildQrcodePlan(
      [
        makePicked('10302032云帆科技_z15169262608.jpg'),
        makePicked('111211100 博信网络 收款码.png'),
        makePicked('12301615深圳工作室_潘易斌(1).png'),
      ],
      customers
    )

    expect(plan.unmatchedGroups).toEqual([])
    expect(plan.targets.map((target) => target.customerId)).toEqual([
      'cust_10302032',
      'cust_111211100',
      'cust_12301615',
    ])
    expect(plan.targets[0].groupName).toBe('10302032云帆科技')
  })

  it('群号大小写不敏感', () => {
    const plan = buildQrcodePlan([makePicked('chen收款码.png')], customers)
    expect(plan.targets).toHaveLength(1)
    expect(plan.targets[0].customerId).toBe('cust_chen')
  })

  it('纯中文客户名按全名精确匹配，不会被单个字母前缀误伤', () => {
    const exact = buildQrcodePlan([makePicked('A速米科技招学员收款码.png')], customers)
    expect(exact.targets).toHaveLength(1)
    expect(exact.targets[0].customerId).toBe('cust_sumi')

    const other = buildQrcodePlan([makePicked('A启泓赵老师.png')], customers)
    expect(other.targets).toHaveLength(0)
    expect(other.unmatchedGroups).toEqual(['A启泓赵老师'])
  })

  it('多个客户命中同一群号时按冲突处理，不随意挑一个', () => {
    const plan = buildQrcodePlan(
      [makePicked('12345某某科技.png')],
      [
        { id: 'cust_a', groupName: '12345 甲科技' },
        { id: 'cust_b', groupName: '12345乙科技' },
      ]
    )

    expect(plan.targets).toHaveLength(0)
    expect(plan.conflicts).toEqual([
      {
        groupName: '12345',
        fileNames: ['12345某某科技.png'],
        reason: 'duplicate-customer',
        customerNames: ['12345 甲科技', '12345乙科技'],
      },
    ])
  })

  it('同一客户的两张图仍按同客户多图冲突处理', () => {
    const plan = buildQrcodePlan(
      [makePicked('10302032云帆科技.png'), makePicked('10302032云帆科技_z15.png')],
      customers
    )

    expect(plan.targets).toHaveLength(0)
    expect(plan.conflicts).toEqual([
      {
        groupName: '10302032云帆科技',
        fileNames: ['10302032云帆科技.png', '10302032云帆科技_z15.png'],
        reason: 'duplicate-file',
      },
    ])
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
