import rateLimit from 'express-rate-limit'

export const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: '请求过于频繁，请60秒后重试'
  },
  skip: (_req, res) => {
    res.setHeader('X-RateLimit-Limit', '3')
    return false
  }
})

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: '登录尝试次数过多，请15分钟后再试'
  }
})

// H12：做单接口按 IP 限流，防止脚本批量刷单/耗尽库存
export const orderCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: '操作过于频繁，请稍后再试'
  }
})

// M8：注册接口按 IP 限流，抑制批量注册/刷号
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: '注册过于频繁，请稍后再试'
  }
})

// M17：OCR 接口限流，避免高频调用阿里云产生费用与并发内存压力
export const ocrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 429,
    message: '识别请求过于频繁，请稍后再试'
  }
})

