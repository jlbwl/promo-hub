import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { logRequest } from '../logger.js'

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), 'apps/api/src', relativePath), 'utf8')

describe('日志敏感字段脱敏', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('请求日志中 query 的验证码/令牌/密码参数被脱敏', () => {
    logRequest(
      'DELETE',
      '/api/users/u_1?smsCode=123456&code=654321&token=abc123&password=pwd888&secret=shh999',
      '10.0.0.1',
      'admin_1'
    )

    const output = infoSpy.mock.calls.flat().join(' ')
    expect(output).not.toContain('123456')
    expect(output).not.toContain('654321')
    expect(output).not.toContain('abc123')
    expect(output).not.toContain('pwd888')
    expect(output).not.toContain('shh999')
    expect(output).toContain('smsCode=***')
  })

  it('非敏感 query 参数保持原样，便于排查问题', () => {
    logRequest('GET', '/api/users?page=2&keyword=abc', '10.0.0.1', 'admin_1')

    const output = infoSpy.mock.calls.flat().join(' ')
    expect(output).toContain('page=2')
    expect(output).toContain('keyword=abc')
  })

  it('源级守卫：日志点不得直接打印完整手机号（必须走 maskPhone）', () => {
    const files = [
      'controllers/user-sms.controller.ts',
      'controllers/admin.controller.ts',
      'controllers/manager.controller.ts',
      'controllers/user-login.controller.ts',
      'controllers/user-register.controller.ts',
      'services/UserService.ts',
    ]

    const offenders: string[] = []
    for (const file of files) {
      readSource(file)
        .split('\n')
        .forEach((line, index) => {
          if (!/logger\.(debug|info|warn|error)\(/.test(line)) return
          if (!/\bphone\b/.test(line)) return
          if (/maskPhone\(/.test(line)) return
          offenders.push(`${file}:${index + 1} ${line.trim()}`)
        })
    }

    expect(offenders).toEqual([])
  })

  it('源级守卫：验证码不得出现在 URL query 中', () => {
    const files = ['controllers/user-admin.controller.ts', 'controllers/manager.controller.ts']

    const offenders = files.filter(file => /req\.query\.smsCode|query\.smsCode/.test(readSource(file)))
    expect(offenders).toEqual([])
  })
})
