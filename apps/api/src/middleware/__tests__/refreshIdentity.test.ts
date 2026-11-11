import { describe, it, expect, vi, beforeEach } from 'vitest'

// 必须在导入 auth.ts 之前设置（模块加载时强校验密钥）
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test_jwt_secret_0123456789_0123456789'
})

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// 按真实键名存取的假缓存：get 返回已反序列化的值（与 CacheService 契约一致）
const store = vi.hoisted(() => new Map<string, string>())

vi.mock('../../services/cache/index.js', () => {
  const api = {
    get: async (key: string) => (store.has(key) ? JSON.parse(store.get(key) as string) : null),
    set: async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value))
    },
    delete: async (key: string) => {
      store.delete(key)
    },
    isRedisAvailable: () => true,
  }
  return { getCacheService: () => api }
})

const dataMock = vi.hoisted(() => ({
  readUser: vi.fn(),
  readManager: vi.fn(),
  readAdminById: vi.fn(),
  readEmployeeById: vi.fn(),
}))

vi.mock('../../data/index.js', () => dataMock)

import jwt from 'jsonwebtoken'
import {
  generateRefreshToken,
  refreshAuthToken,
  revokeAllRefreshTokens,
  type AuthUser,
} from '../auth.js'

const JWT_SECRET = process.env.JWT_SECRET as string

function decode(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    id: string
    phone: string
    role: string
    userId?: string
    authVersion?: string
  }
}

const activeUser = (id: string, phone: string, overrides: Record<string, unknown> = {}) => ({
  id,
  phone,
  nickname: `用户${id}`,
  teamName: '团队A',
  role: 'user',
  status: 'active',
  ...overrides,
})

describe('refresh 以数据库当前状态为准', () => {
  beforeEach(() => {
    store.clear()
    vi.clearAllMocks()
  })

  it('角色变更后 refresh 不得沿用旧角色', async () => {
    dataMock.readManager.mockResolvedValue({
      id: 'm_1',
      phone: '13800000000',
      name: '渠道A',
      teamName: '团队A',
      role: 'user', // 数据库中已被降级
      status: 'active',
    })

    const token = await generateRefreshToken({
      id: 'm_1',
      phone: '13800000000',
      role: 'manager',
      teamName: '团队A',
    } as AuthUser)

    await expect(refreshAuthToken(token)).resolves.toBeNull()
  })

  it('账号被禁用后 refresh 立即被拒（不再受 60 秒状态缓存影响）', async () => {
    dataMock.readUser.mockResolvedValue(activeUser('u_1', '13900000001'))
    const user: AuthUser = { id: 'u_1', phone: '13900000001', role: 'user' }

    // 第一次成功刷新：旧实现会把 "active" 写入 60 秒进程内缓存
    const first = await generateRefreshToken(user)
    await expect(refreshAuthToken(first)).resolves.not.toBeNull()

    // 禁用后再用一个新签发的 token 刷新：必须以数据库为准立即拒绝
    const second = await generateRefreshToken(user)
    dataMock.readUser.mockResolvedValue(activeUser('u_1', '13900000001', { status: 'disabled' }))

    await expect(refreshAuthToken(second)).resolves.toBeNull()
  })

  it('改密后旧 refresh token 失效（精确键版本号，不影响其它账号）', async () => {
    dataMock.readUser.mockResolvedValue(activeUser('u_2', '13900000002'))
    const user: AuthUser = { id: 'u_2', phone: '13900000002', role: 'user' }

    const oldToken = await generateRefreshToken(user)
    await expect(refreshAuthToken(oldToken)).resolves.not.toBeNull()

    const otherAccountToken = await generateRefreshToken({
      id: 'u_other',
      phone: '13900000009',
      role: 'user',
    })
    dataMock.readUser.mockImplementation(async (id: string) =>
      activeUser(id, id === 'u_other' ? '13900000009' : '13900000002')
    )

    await revokeAllRefreshTokens('user', 'u_2')

    // 旧 token 被拒，且版本号只落在该账号的精确键上
    await expect(refreshAuthToken(oldToken)).resolves.toBeNull()
    expect(store.has('user_auth_version:u_2')).toBe(true)
    expect(store.has('user_auth_version:u_other')).toBe(false)
    // 其它账号的 refresh 不受影响
    await expect(refreshAuthToken(otherAccountToken)).resolves.not.toBeNull()
  })

  it('正常用户的 refresh 不受影响，且新 refresh token 仍可继续使用', async () => {
    dataMock.readUser.mockResolvedValue(activeUser('u_3', '13900000003'))
    const token = await generateRefreshToken({
      id: 'u_3',
      phone: '13900000003',
      role: 'user',
      userId: undefined,
    } as AuthUser)

    const tokens = await refreshAuthToken(token)
    expect(tokens).not.toBeNull()

    const payload = decode(tokens!.token)
    expect(payload.id).toBe('u_3')
    expect(payload.phone).toBe('13900000003')
    expect(payload.role).toBe('user')

    // 轮换后的 refresh token 仍能继续刷新
    await expect(refreshAuthToken(tokens!.refreshToken)).resolves.not.toBeNull()
  })

  it('手机号/团队变更后，新 token 使用数据库中的最新手机号', async () => {
    const token = await generateRefreshToken({
      id: 'u_4',
      phone: '13900000000',
      role: 'user',
      teamName: '旧团队',
    } as AuthUser)

    dataMock.readUser.mockResolvedValue(
      activeUser('u_4', '13911112222', { teamName: '新团队' })
    )

    const tokens = await refreshAuthToken(token)
    expect(tokens).not.toBeNull()
    expect(decode(tokens!.token).phone).toBe('13911112222')
  })
})
