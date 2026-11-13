/**
 * 批量上传收款码：文件名群号解析、图片/ZIP 读取、匹配预览与逐张上传。
 * ZIP 解析使用浏览器原生 DecompressionStream，不引入额外解压依赖。
 */

export const MAX_QRCODE_FILE_SIZE = 5 * 1024 * 1024
/** ZIP 包体积上限，避免一次性读入过大文件 */
export const MAX_ZIP_SIZE = 200 * 1024 * 1024

const SUPPORTED_IMAGE_EXT = /\.(png|jpe?g|webp)$/i

export interface PickedImage {
  /** 原始文件名，可能带目录（ZIP 内） */
  name: string
  /** 字节数；ZIP 条目取中央目录声明的解压后大小 */
  size: number
  getBlob: () => Promise<Blob>
}

export interface QrcodeCustomer {
  id: string
  groupName: string
}

export interface QrcodeConflict {
  groupName: string
  fileNames: string[]
}

export interface QrcodeUploadTarget {
  groupName: string
  customerId: string
  fileName: string
  size: number
  getBlob: () => Promise<Blob>
}

export interface QrcodePlan {
  /** 可上传的图片（每个群号一张） */
  targets: QrcodeUploadTarget[]
  matchedGroupCount: number
  /** 找不到对应客户的群号 */
  unmatchedGroups: string[]
  /** 同一群号对应多张图片 */
  conflicts: QrcodeConflict[]
  /** 非 png/jpg/jpeg/webp 的文件名 */
  unsupported: string[]
  /** 超过 5MB 的文件名 */
  oversize: string[]
  /** 文件名无法解析出群号 */
  unparsed: string[]
}

export type QrcodeUploadStage = 'upload' | 'save'

export interface QrcodeUploadFailure {
  groupName: string
  fileName: string
  stage: QrcodeUploadStage
  reason: string
}

export interface QrcodeUploadResult {
  success: number
  failures: QrcodeUploadFailure[]
}

const basename = (name: string): string =>
  name.replace(/^.*[\\/]/, '').trim()

const imageMime = (name: string): string => {
  if (/\.png$/i.test(name)) return 'image/png'
  if (/\.webp$/i.test(name)) return 'image/webp'
  return 'image/jpeg'
}

/**
 * 从文件名解析群号简称：
 * 去扩展名、副本序号、「收款码/二维码/qrcode」等后缀、空格与首尾分隔符。
 * 例：`888 收款码 (1).png` → `888`
 */
export function parseGroupNameFromFileName(fileName: string): string {
  let base = basename(fileName).replace(/\.[^.]+$/, '')
  // 去掉 Windows/macOS 复制的「(1)」「（2）」后缀
  base = base.replace(/[（(]\s*\d+\s*[)）]$/, '')
  base = base.replace(/[\s\u3000]+/g, '')

  const suffix = /(?:收款二维码|收款码图片|收款图片|收款码|二维码图片|二维码|qrcode|qr码|qr)$/i
  for (let i = 0; i < 3; i++) {
    const next = base.replace(suffix, '')
    if (next === base) break
    base = next
  }

  return base.replace(/^[-_—－·.]+/, '').replace(/[-_—－·.]+$/, '').trim()
}

export function isSupportedQrcodeFile(fileName: string): boolean {
  return SUPPORTED_IMAGE_EXT.test(basename(fileName))
}

/** 普通图片文件转换为待处理项 */
export function pickLocalImages(files: File[]): PickedImage[] {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    getBlob: async () => file,
  }))
}

/**
 * 根据待处理文件与客户列表生成导入计划。
 * 支持格式与 5MB 限制先过滤，再做文件名群号匹配与冲突识别。
 */
export function buildQrcodePlan(files: PickedImage[], customers: QrcodeCustomer[]): QrcodePlan {
  const customerMap = new Map<string, QrcodeCustomer>()
  customers.forEach((customer) => {
    const key = customer.groupName.trim()
    if (key) customerMap.set(key, customer)
  })

  const byGroup = new Map<string, PickedImage[]>()
  const unsupported: string[] = []
  const oversize: string[] = []
  const unparsed: string[] = []

  files.forEach((file) => {
    const base = basename(file.name)
    if (!SUPPORTED_IMAGE_EXT.test(base)) {
      unsupported.push(base)
      return
    }
    if (file.size > MAX_QRCODE_FILE_SIZE) {
      oversize.push(base)
      return
    }
    const groupName = parseGroupNameFromFileName(base)
    if (!groupName) {
      unparsed.push(base)
      return
    }
    const list = byGroup.get(groupName) || []
    list.push(file)
    byGroup.set(groupName, list)
  })

  const targets: QrcodeUploadTarget[] = []
  const unmatchedGroups: string[] = []
  const conflicts: QrcodeConflict[] = []

  byGroup.forEach((groupFiles, groupName) => {
    if (groupFiles.length > 1) {
      conflicts.push({ groupName, fileNames: groupFiles.map((file) => basename(file.name)) })
      return
    }
    const customer = customerMap.get(groupName)
    if (!customer) {
      unmatchedGroups.push(groupName)
      return
    }
    const file = groupFiles[0]
    targets.push({
      groupName,
      customerId: customer.id,
      fileName: basename(file.name),
      size: file.size,
      getBlob: file.getBlob,
    })
  })

  return {
    targets,
    matchedGroupCount: targets.length,
    unmatchedGroups: unmatchedGroups.sort(),
    conflicts,
    unsupported,
    oversize,
    unparsed,
  }
}

export interface QrcodeUploadDeps {
  /** 上传单张图片，返回服务端地址 */
  upload: (blob: Blob, fileName: string) => Promise<string>
  /** 将地址写回客户档案 */
  save: (customerId: string, url: string) => Promise<void>
  onProgress?: (done: number, total: number) => void
}

/**
 * 逐张上传并回写，单条失败不中断后续；失败项记录阶段与具体群号，便于定位。
 */
export async function runQrcodeUploads(
  targets: QrcodeUploadTarget[],
  deps: QrcodeUploadDeps
): Promise<QrcodeUploadResult> {
  const failures: QrcodeUploadFailure[] = []
  let success = 0

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]
    let stage: QrcodeUploadStage = 'upload'
    try {
      const blob = await target.getBlob()
      const url = await deps.upload(blob, target.fileName)
      stage = 'save'
      await deps.save(target.customerId, url)
      success += 1
    } catch (error) {
      failures.push({
        groupName: target.groupName,
        fileName: target.fileName,
        stage,
        reason: error instanceof Error && error.message ? error.message : '未知错误',
      })
    }
    deps.onProgress?.(index + 1, targets.length)
  }

  return { success, failures }
}

// ============================================
// ZIP 解压（仅解析中央目录 + deflate/store，无第三方依赖）
// ============================================

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

function findEocd(view: DataView): number {
  const start = Math.max(0, view.byteLength - 65557)
  for (let i = view.byteLength - 22; i >= start; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i
  }
  return -1
}

function decodeZipName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder('utf-8').decode(bytes)
  // 中文 Windows 打的包通常未设置 UTF-8 标记，按 GBK 解码更稳
  try {
    return new TextDecoder('gbk').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

async function extractZipEntry(
  bytes: Uint8Array,
  view: DataView,
  localOffset: number,
  compressedSize: number,
  method: number,
  mime: string
): Promise<Blob> {
  if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
    throw new Error('ZIP 条目已损坏')
  }
  const nameLength = view.getUint16(localOffset + 26, true)
  const extraLength = view.getUint16(localOffset + 28, true)
  const dataStart = localOffset + 30 + nameLength + extraLength
  const raw = bytes.slice(dataStart, dataStart + compressedSize)

  if (method === 0) {
    return new Blob([raw], { type: mime })
  }
  if (method === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('当前浏览器不支持 ZIP 解压，请改用解压后的图片上传')
    }
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const output = await new Response(stream).arrayBuffer()
    return new Blob([output], { type: mime })
  }
  throw new Error('ZIP 使用了不支持的压缩方式')
}

/** 读取 ZIP 内的文件条目；目录、隐藏文件与 __MACOSX 元数据会被忽略 */
export async function readZipEntries(file: Blob): Promise<PickedImage[]> {
  if (file.size > MAX_ZIP_SIZE) {
    throw new Error('ZIP 文件不能超过 200MB')
  }

  const buffer = await file.arrayBuffer()
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const eocd = findEocd(view)
  if (eocd < 0) {
    throw new Error('不是有效的 ZIP 文件')
  }

  const total = view.getUint16(eocd + 10, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  if (total === 0xffff || centralOffset === 0xffffffff) {
    throw new Error('暂不支持 ZIP64 格式，请拆分压缩包后重试')
  }

  const entries: PickedImage[] = []
  let pointer = centralOffset

  for (let i = 0; i < total; i++) {
    if (pointer + 46 > view.byteLength || view.getUint32(pointer, true) !== CENTRAL_SIG) break

    const flags = view.getUint16(pointer + 8, true)
    const method = view.getUint16(pointer + 10, true)
    const compressedSize = view.getUint32(pointer + 20, true)
    const uncompressedSize = view.getUint32(pointer + 24, true)
    const nameLength = view.getUint16(pointer + 28, true)
    const extraLength = view.getUint16(pointer + 30, true)
    const commentLength = view.getUint16(pointer + 32, true)
    const localOffset = view.getUint32(pointer + 42, true)
    const nameBytes = bytes.subarray(pointer + 46, pointer + 46 + nameLength)
    const entryName = decodeZipName(nameBytes, (flags & 0x800) !== 0)
    pointer += 46 + nameLength + extraLength + commentLength

    if (!entryName || entryName.endsWith('/')) continue
    const base = basename(entryName)
    if (!base || base.startsWith('.') || entryName.includes('__MACOSX/')) continue

    entries.push({
      name: entryName,
      size: uncompressedSize,
      getBlob: () =>
        extractZipEntry(bytes, view, localOffset, compressedSize, method, imageMime(base)),
    })
  }

  return entries
}
