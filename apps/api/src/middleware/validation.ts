import { Request, Response, NextFunction } from 'express'

interface ValidationRule {
  field: string
  type: 'required' | 'phone' | 'password' | 'length' | 'pattern' | 'email'
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  message: string
}

export function validate(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = []

    for (const rule of rules) {
      const value = req.body[rule.field]

      switch (rule.type) {
        case 'required':
          if (value === undefined || value === null || value === '') {
            errors.push(rule.message)
          }
          break

        case 'phone':
          if (value && !/^1[3-9]\d{9}$/.test(value)) {
            errors.push(rule.message)
          }
          break

        case 'password':
          if (value && (value.length < 6 || value.length > 20)) {
            errors.push(rule.message)
          }
          break

        case 'length':
          if (value && (value.length < (rule.minLength || 0) || value.length > (rule.maxLength || Infinity))) {
            errors.push(rule.message)
          }
          break

        case 'pattern':
          if (value && rule.pattern && !rule.pattern.test(String(value))) {
            errors.push(rule.message)
          }
          break
      }
    }

    if (errors.length > 0) {
      res.json({ code: 400, message: errors.join('; '), data: null })
      return
    }

    next()
  }
}

export const validationRules = {
  login: [
    { field: 'phone', type: 'required', message: '手机号不能为空' },
    { field: 'phone', type: 'phone', message: '手机号格式不正确' },
    { field: 'password', type: 'required', message: '密码不能为空' },
  ],
  smsSend: [
    { field: 'phone', type: 'required', message: '手机号不能为空' },
    { field: 'phone', type: 'phone', message: '手机号格式不正确' },
  ],
  smsLogin: [
    { field: 'phone', type: 'required', message: '手机号不能为空' },
    { field: 'phone', type: 'phone', message: '手机号格式不正确' },
    { field: 'code', type: 'required', message: '验证码不能为空' },
    { field: 'code', type: 'length', minLength: 6, maxLength: 6, message: '验证码必须是6位' },
  ],
  register: [
    { field: 'phone', type: 'required', message: '手机号不能为空' },
    { field: 'phone', type: 'phone', message: '手机号格式不正确' },
    { field: 'password', type: 'required', message: '密码不能为空' },
    { field: 'password', type: 'password', message: '密码长度需在6-20位之间' },
  ],
}
