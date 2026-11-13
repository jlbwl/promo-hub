import { mkdirSync } from 'fs'
import { join } from 'path'
import { UPLOAD_DIR } from './imageProcessor.js'

/** 收款码原图目录：与封面分开存放，避免被封面裁剪流程影响 */
export const QRCODE_DIR = join(UPLOAD_DIR, 'qrcodes')

/**
 * 确保收款码目录存在并返回目录路径。
 * 部署脚本会整体替换 api 目录，运行中进程的上传目录可能瞬时消失（ENOENT），
 * 因此上传前逐请求调用一次（mkdirSync 递归创建是幂等的）。
 */
export function ensureQrcodeDir(): string {
  mkdirSync(QRCODE_DIR, { recursive: true })
  return QRCODE_DIR
}
