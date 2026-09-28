import { Request, Response, NextFunction } from 'express'
import { sendSuccess, AppError, ErrorCode, HttpStatus, asyncHandler } from '../utils/response.js'
import logger from '../utils/logger.js'
import { sendSmsCode, generateSmsCode, saveSmsCode, deleteSmsCode } from '../utils/sms.js'

/**
 * 发送短信验证码
 * 验证手机号格式，生成6位验证码，有效期5分钟
 * @param req - HTTP请求对象，包含手机号
 * @param res - HTTP响应对象
 * @returns 验证码有效期
 */
export const sendUserSmsCode = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { phone } = req.body
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      throw new AppError('手机号格式不正确', ErrorCode.INVALID_PHONE, HttpStatus.BAD_REQUEST)
    }

    const code = generateSmsCode()
    saveSmsCode(phone, code, 300)

    const result = await sendSmsCode(phone, code)
    if (!result.success) {
      logger.error('SMS code send failed', { phone, reason: result.message })
      deleteSmsCode(phone)
      throw new AppError('验证码发送失败，请稍后重试', ErrorCode.INTERNAL_SERVER_ERROR, HttpStatus.INTERNAL_SERVER_ERROR)
    }
    sendSuccess(res, { expiresIn: 300 }, '验证码已发送')
  }
)
