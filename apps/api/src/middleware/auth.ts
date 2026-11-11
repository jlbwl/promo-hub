import logger from '../utils/logger.js'
import { getErrorMessage } from '@promo/shared'
import { Request, Response, NextFunction, RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { getCacheService } from '../services/cache/index.js'
import { readEmployeeById, readUser, readManager, readAdminById } from '../data/index.js'

// 安全验证：确保必需的密钥环境变量已设置
// 只强制 JWT_SECRET；SESSION_SECRET 已废弃（改为无状态 JWT + CSRF Double-Submit）
if (!process.env.JWT_SECRET) {
  throw new Error('致命错误：JWT_SECRET 环境变量未设置')
}

const JWT_SECRET = process.env.JWT_SECRET

// 验证 JWT_SECRET 强度
if (JWT_SECRET.length < 32) {
  logger.warn('[Security] JWT_SECRET 长度不足（建议至少32字符）', { currentLength: JWT_SECRET.length })
}

export interface AuthUser {
  id: string
  phone: string
  role: 'admin' | 'manager' | 'user' | 'employee'
  nickname?: string
  teamName?: string
  userId?: string
  token?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

// JWT 载荷结构（sign 时写入的字段）
interface JwtPayload {
  id: string
  phone: string
  role: AuthUser['role']
  type?: string
  // 员工子账户关联的主账户 ID（H2：签发与解析都需保留）
  userId?: string
  // 令牌版本：改密后与缓存中的当前版本不一致即拒绝刷新
  authVersion?: string
}

/** R6：读取正整数环境变量，未配置或非法时回退到历史默认值（行为不变） */
function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Refresh Token 存储键前缀
const REFRESH_TOKEN_PREFIX = 'refresh_token:'
// P0-7: 宽限期键前缀，旧 token 删除后默认 60 秒内仍可用
const REFRESH_TOKEN_GRACE_PREFIX = 'refresh_token_grace:'
const REFRESH_TOKEN_GRACE_TTL = readPositiveIntEnv('REFRESH_TOKEN_GRACE_TTL_SECONDS', 60)  // 60秒宽限期
// Access Token 有效期（秒），默认 1 小时；黑名单 TTL 与之保持一致
const ACCESS_TOKEN_TTL = readPositiveIntEnv('ACCESS_TOKEN_TTL_SECONDS', 60 * 60)
// Refresh Token 有效期（秒），默认 7 天；签发与缓存 TTL 共用同一值
const REFRESH_TOKEN_TTL = readPositiveIntEnv('REFRESH_TOKEN_TTL_SECONDS', 7 * 24 * 60 * 60)
// Admin 单设备登录：存储当前活跃的 refresh token
const ADMIN_ACTIVE_TOKEN_PREFIX = 'admin_active_token:'
// 令牌版本：改密/重置密码后递增，使该账号此前签发的 refresh token 全部失效
// 只写单个精确键（不做任何前缀扫描或清除），不影响其它账号与令牌键
const USER_AUTH_VERSION_PREFIX = 'user_auth_version:'
// Admin refresh token 滑动过期时间（默认 365 天，每次刷新自动续期）
const ADMIN_REFRESH_TOKEN_TTL = readPositiveIntEnv('ADMIN_REFRESH_TOKEN_TTL_SECONDS', 365 * 24 * 60 * 60)

// Plan C: Access Token 黑名单（登出后使未过期的 Access Token 立即失效）
// 与 Access Token 有效期一致，到期自动清理
const ACCESS_TOKEN_BLACKLIST_PREFIX = 'access_token_blacklist:'

/**
 * 将 Access Token 加入黑名单（登出时调用）
 * 使未过期的 Access Token 立即失效，防止登出后仍可访问受保护接口
 */
export async function blacklistAccessToken(token: string): Promise<void> {
  const cacheService = getTokenStore()
  if (cacheService) {
    await cacheService.set(ACCESS_TOKEN_BLACKLIST_PREFIX + token, '1', ACCESS_TOKEN_TTL)
  }
}

/**
 * 检查 Access Token 是否已被吊销（登出黑名单）
 */
export async function isAccessTokenBlacklisted(token: string): Promise<boolean> {
  const cacheService = getTokenStore()
  if (cacheService) {
    return !!(await cacheService.get(ACCESS_TOKEN_BLACKLIST_PREFIX + token))
  }
  return false
}

// M22：Redis 不可用时 refresh token 会退化为进程内存，重启/发版即失效，必须显式告警
let tokenStoreDegraded = false

// 获取缓存服务（使用 Redis）
function getTokenStore() {
  try {
    const service = getCacheService()
    const redisAvailable = typeof service.isRedisAvailable === 'function' ? service.isRedisAvailable() : true
    if (!redisAvailable) {
      if (!tokenStoreDegraded) {
        tokenStoreDegraded = true
        logger.error('[Auth] Redis 不可用：refresh token 仅保存在进程内存，重启/发版后用户需重新登录')
      }
    } else {
      tokenStoreDegraded = false
    }
    return service
  } catch {
    logger.warn('[Auth] CacheService 未初始化，降级到内存存储')
    return null
  }
}

// H8：账号状态校验（60 秒进程内缓存，避免每次请求都查库）
const ACCOUNT_STATUS_CACHE_TTL = 60 * 1000
const accountStatusCache = new Map<string, { active: boolean; at: number }>()

/** 令牌版本键（精确键，不使用任何前缀扫描） */
function authVersionKey(id: string): string {
  return USER_AUTH_VERSION_PREFIX + id
}

/**
 * 读取账号当前令牌版本；未设置过版本（从未改密）时返回空串。
 * 版本只用于 refresh 校验，不写入 JWT 之外的任何位置。
 */
async function readAuthVersion(cacheService: ReturnType<typeof getTokenStore>, id: string): Promise<string> {
  if (!cacheService) return ''
  const version = await cacheService.get<string>(authVersionKey(id))
  return version || ''
}

/** 精确删除某个 refresh token 的主存储、宽限期与宽限期令牌对 */
async function clearRefreshTokenKeys(
  cacheService: ReturnType<typeof getTokenStore>,
  refreshToken: string
): Promise<void> {
  if (!cacheService) return
  await cacheService.delete(REFRESH_TOKEN_PREFIX + refreshToken)
  await cacheService.delete(REFRESH_TOKEN_GRACE_PREFIX + refreshToken)
  await cacheService.delete(REFRESH_TOKEN_GRACE_PREFIX + refreshToken + ':tokens')
}

/**
 * 读取 refresh token 缓存中的用户对象。
 * 兼容旧数据：历史上写入侧手动 JSON.stringify 过一次，CacheService.set 内部又序列化，
 * 导致 Redis 中现存记录被双重编码（get 解析一次后仍是 JSON 字符串）。
 * 读到字符串时二次解析，容忍存量数据，避免上线后全站 refresh 失效。
 * TODO: 存量 7 天 refresh token 全部过期后可移除该兼容分支。
 */
async function readCachedAuthUser(
  cacheService: ReturnType<typeof getTokenStore>,
  key: string
): Promise<AuthUser | null> {
  if (!cacheService) return null
  const raw = await cacheService.get<AuthUser | string>(key)
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  }
  return raw
}

/**
 * 吊销某账号已签发的全部 refresh token（改密 / 重置密码后调用）。
 *
 * 实现：写入一个新的令牌版本号。刷新时令牌版本与当前版本不一致即拒绝，
 * 因此无需扫描/删除 refresh_token 命名空间，也不会波及其它账号或 access token 黑名单。
 * 用「写新版本」而非「删除版本键」：历史令牌没有版本（空串），删除会让它们重新生效。
 */
export async function revokeAllRefreshTokens(role: AuthUser['role'], id: string): Promise<void> {
  const cacheService = getTokenStore()
  if (!cacheService) {
    logger.error('[Auth] 缓存不可用，无法递增令牌版本；改密后旧 refresh token 仍可能有效', { userId: id, role })
    return
  }

  await cacheService.set(
    authVersionKey(id),
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    ADMIN_REFRESH_TOKEN_TTL
  )

  // 管理员单设备令牌是精确键，直接删除；旧 token 此后既过不了版本校验也过不了活跃令牌校验
  if (role === 'admin') {
    await cacheService.delete(ADMIN_ACTIVE_TOKEN_PREFIX + id)
  }
}

/**
 * 以数据库为准解析账号当前身份（refresh 时使用，替代 token 内的快照）。
 * 返回 null 表示账号已删除/禁用/员工已过期，必须拒绝刷新并要求重新登录。
 */
async function loadCurrentIdentity(role: AuthUser['role'], id: string): Promise<AuthUser | null> {
  switch (role) {
    case 'admin': {
      const admin = await readAdminById(id)
      if (!admin || admin.status !== 'active') return null
      return { id: admin.id, phone: admin.phone, role: 'admin', nickname: admin.name }
    }
    case 'manager': {
      const manager = await readManager(id)
      if (!manager || manager.status !== 'active') return null
      return {
        id: manager.id,
        phone: manager.phone || '',
        // 仅在数据库明确降级为 user 时下调，其余取值一律按 manager 处理，避免通过数据字段提权
        role: manager.role === 'user' ? 'user' : 'manager',
        nickname: manager.name,
        teamName: manager.teamName || '',
      }
    }
    case 'employee': {
      const employee = await readEmployeeById(id)
      if (!employee || employee.status !== 'active') return null
      if (employee.expiresAt && new Date(employee.expiresAt) < new Date()) return null
      return {
        id: employee.id,
        phone: employee.phone || '',
        role: 'employee',
        nickname: employee.nickname,
        userId: employee.userId,
      }
    }
    default: {
      const user = await readUser(id)
      if (!user || user.status !== 'active') return null
      // users.role 的取值是 user/vip（团队等级），鉴权上一律按普通用户处理，
      // 不接受数据库中出现其它角色值，避免通过资料字段提权
      return {
        id: user.id,
        phone: user.phone || '',
        role: 'user',
        nickname: user.nickname,
        teamName: user.teamName || '',
      }
    }
  }
}

async function isAccountActive(user: AuthUser): Promise<boolean> {
  const key = `${user.role}:${user.id}`
  const cached = accountStatusCache.get(key)
  if (cached && Date.now() - cached.at < ACCOUNT_STATUS_CACHE_TTL) {
    return cached.active
  }

  let active = false
  try {
    if (user.role === 'admin') {
      const admin = await readAdminById(user.id)
      active = !!admin && admin.status === 'active'
    } else if (user.role === 'manager') {
      const manager = await readManager(user.id)
      active = !!manager && manager.status === 'active'
    } else if (user.role === 'employee') {
      const employee = await readEmployeeById(user.id)
      active = !!employee && employee.status === 'active'
    } else {
      const targetUser = await readUser(user.id)
      active = !!targetUser && targetUser.status === 'active'
    }
  } catch (error) {
    // 数据库异常时不因附加校验阻断全部请求，记录告警后放行
    logger.warn('[Auth] 账号状态校验失败，暂时放行', {
      userId: user.id,
      role: user.role,
      error: getErrorMessage(error),
    })
    return true
  }

  accountStatusCache.set(key, { active, at: Date.now() })
  return active
}

// 生成 JWT Token（Access Token - 短期有效）
export function generateAuthToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, type: 'access', userId: user.userId },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL } // Access Token 有效期（默认 1 小时）
  )
}

// 生成 Refresh Token（长期有效）
// Admin 角色：不设置 JWT 过期时间 + 单设备登录（新登录顶掉旧设备）+ 滑动过期365天
// 其他角色：保持原有7天有效期
export async function generateRefreshToken(user: AuthUser): Promise<string> {
  const isAdmin = user.role === 'admin'
  const cacheService = getTokenStore()
  // 令牌版本随账号当前版本签发；改密后版本递增，旧令牌刷新时即被拒绝
  const authVersion = await readAuthVersion(cacheService, user.id)
  const refreshToken = jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, type: 'refresh', userId: user.userId, authVersion },
    JWT_SECRET,
    isAdmin ? {} : { expiresIn: REFRESH_TOKEN_TTL }
  )

  if (cacheService) {
    const ttl = isAdmin ? ADMIN_REFRESH_TOKEN_TTL : REFRESH_TOKEN_TTL
    // 注意：CacheService.set 内部会 JSON.stringify，这里必须传对象；
    // 历史上传过 JSON 字符串，读取侧（redis 模式）会 JSON.parse 两次抛异常，导致 refresh 静默失败
    await cacheService.set(REFRESH_TOKEN_PREFIX + refreshToken, user, ttl)
    // Admin 单设备登录：记录当前活跃 token，新登录自动覆盖旧 token（顶号）
    if (isAdmin) {
      await cacheService.set(ADMIN_ACTIVE_TOKEN_PREFIX + user.id, refreshToken, ttl)
    }
  }

  return refreshToken
}

// 同时生成 Access Token 和 Refresh Token
export async function generateTokens(user: AuthUser): Promise<{ token: string; refreshToken: string }> {
  const token = generateAuthToken(user)
  const refreshToken = await generateRefreshToken(user)
  return { token, refreshToken }
}

// 验证 JWT Token
function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    // H1：Refresh Token 不得作为 Access Token 使用
    if (decoded.type !== 'access') return null
    return {
      id: decoded.id,
      phone: decoded.phone,
      role: decoded.role,
      userId: decoded.userId,
      token
    }
  } catch {
    return null
  }
}

export const authMiddleware = (allowedRoles?: Array<'admin' | 'manager' | 'user' | 'employee'>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      const refreshToken = req.headers['x-refresh-token'] as string | undefined

      // 1. 检查 Bearer Token（JWT）
      if (bearerToken) {
        const user = verifyAuthToken(bearerToken)
        if (user) {
          // 检查 Access Token 是否已被吊销（登出黑名单）
          const blacklisted = await isAccessTokenBlacklisted(bearerToken)
          if (!blacklisted) {
            // H8：禁用/删除账号后，已签发的 Access Token 立即失效
            if (!(await isAccountActive(user))) {
              res.status(401).json({
                code: 401,
                message: '账号已被禁用或删除，请重新登录',
                data: null
              })
              return
            }
            if (allowedRoles && allowedRoles.length > 0) {
              if (!allowedRoles.includes(user.role)) {
                res.status(403).json({
                  code: 403,
                  message: '您没有权限执行此操作',
                  data: null
                })
                return
              }
            }
            req.user = user
            next()
            return
          }
        }
      }

      // 2. 尝试使用 Refresh Token 刷新 Access Token
      if (refreshToken) {
        const newTokens = await refreshAuthToken(refreshToken)
        if (newTokens) {
          try {
            const decoded = jwt.verify(newTokens.token, JWT_SECRET) as JwtPayload
            const user: AuthUser = {
              id: decoded.id,
              phone: decoded.phone,
              role: decoded.role,
              userId: decoded.userId,
              token: newTokens.token
            }
            
            if (allowedRoles && allowedRoles.length > 0) {
              if (!allowedRoles.includes(user.role)) {
                res.status(403).json({
                  code: 403,
                  message: '您没有权限执行此操作',
                  data: null
                })
                return
              }
            }
            
            req.user = user
            res.setHeader('X-New-Token', newTokens.token)
            res.setHeader('X-New-Refresh-Token', newTokens.refreshToken)
            next()
            return
          } catch {
            logger.warn('[Auth] 刷新后的 Token 验证失败')
          }
        }
      }

      res.status(401).json({
        code: 401,
        message: '未登录或会话已过期，请重新登录',
        data: null
      })
    } catch (error) {
      logger.error('[Auth] Middleware error:', { error: getErrorMessage(error) })
      res.status(500).json({ code: 500, message: '认证服务异常', data: null })
    }
  }
}

// 刷新 Token
// P0-7: 实现宽限期机制，防止并发请求 token 刷新失败
// 流程：
//   1. 先从主存储读取 user，若不存在则从宽限期读取
//   2. 生成新 token 后，将旧 token 放入宽限期（60秒）
//   3. 删除主存储中的旧 token
//   4. 并发请求中的后续请求可从宽限期读取，使用相同的新 token
export async function refreshAuthToken(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload
    
    if (decoded.type !== 'refresh') {
      return null
    }
    
    const cacheService = getTokenStore()
    let cachedUser: AuthUser | null = null
    let fromGrace = false
    let graceTokens: { token: string; refreshToken: string } | null = null
    
    if (cacheService) {
      // 1. 先从主存储读取
      cachedUser = await readCachedAuthUser(cacheService, REFRESH_TOKEN_PREFIX + refreshToken)

      // 2. 若主存储不存在，从宽限期读取（并发场景：已被其他请求刷新过）
      if (!cachedUser) {
        cachedUser = await readCachedAuthUser(cacheService, REFRESH_TOKEN_GRACE_PREFIX + refreshToken)
        if (cachedUser) {
          fromGrace = true
          // 宽限期中存储的是已经刷新后的新 token 对（兼容旧的双编码数据）
          const rawTokens = await cacheService.get<{ token: string; refreshToken: string } | string>(
            REFRESH_TOKEN_GRACE_PREFIX + refreshToken + ':tokens'
          )
          if (typeof rawTokens === 'string') {
            try {
              graceTokens = JSON.parse(rawTokens)
            } catch {
              graceTokens = null
            }
          } else {
            graceTokens = rawTokens
          }
        }
      }
    }
    
    if (!cachedUser) {
      return null
    }

    // 3. 令牌版本校验：改密/重置密码后版本递增，此前签发的 refresh token 全部失效
    //    放在返回宽限期令牌之前，避免改密后 60 秒内仍能拿到旧会话
    const currentVersion = await readAuthVersion(cacheService, cachedUser.id)
    if ((decoded.authVersion || '') !== currentVersion) {
      await clearRefreshTokenKeys(cacheService, refreshToken)
      logger.info('[Auth] refresh token 版本已失效（账号凭证已变更），要求重新登录', {
        userId: cachedUser.id,
        role: cachedUser.role,
      })
      return null
    }

    if (fromGrace && graceTokens) {
      return graceTokens
    }

    // 4. 以数据库中的当前状态为准解析身份：角色、账号状态、团队归属、手机号
    //    不再沿用 token 内的快照，避免改角色/改团队/改手机号后仍签发旧身份
    const identity = await loadCurrentIdentity(cachedUser.role, cachedUser.id)
    if (!identity) {
      await clearRefreshTokenKeys(cacheService, refreshToken)
      logger.info('[Auth] 账号不存在/已禁用/员工已过期，拒绝刷新', {
        userId: cachedUser.id,
        role: cachedUser.role,
      })
      return null
    }

    // 5. 角色以数据库为准；若与令牌中的角色不一致（账号被升降级），要求重新登录
    if (identity.role !== cachedUser.role) {
      await clearRefreshTokenKeys(cacheService, refreshToken)
      logger.info('[Auth] 账号角色已变更，拒绝沿用旧角色并重新登录', {
        userId: cachedUser.id,
        tokenRole: cachedUser.role,
        currentRole: identity.role,
      })
      return null
    }

    const authUser: AuthUser = identity

    // Admin 单设备登录校验：检查该 token 是否为当前活跃 token
    if (authUser.role === 'admin' && cacheService) {
      const activeToken = await cacheService.get(ADMIN_ACTIVE_TOKEN_PREFIX + authUser.id)
      if (activeToken !== refreshToken) {
        // 已被新设备顶号，拒绝刷新
        logger.debug(`[Auth] Admin ${authUser.id} token 已被顶号，拒绝刷新`)
        return null
      }
    }

    const newTokens = await generateTokens(authUser)
    
    // P0-7: 先将旧 token 放入宽限期（带新 token 信息），再删除旧 token
    // 这样并发请求中的后续请求可以从宽限期获取相同的新 token
    if (cacheService && !fromGrace) {
      await cacheService.set(
        REFRESH_TOKEN_GRACE_PREFIX + refreshToken,
        authUser,
        REFRESH_TOKEN_GRACE_TTL
      )
      await cacheService.set(
        REFRESH_TOKEN_GRACE_PREFIX + refreshToken + ':tokens',
        newTokens,
        REFRESH_TOKEN_GRACE_TTL
      )
      await cacheService.delete(REFRESH_TOKEN_PREFIX + refreshToken)
    }
    
    return newTokens
  } catch {
    return null
  }
}

// 使 Refresh Token 失效（用于登出）
// P0-7: 同时清理主存储和宽限期，防止登出后仍可通过宽限期刷新
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const cacheService = getTokenStore()
  if (cacheService) {
    await clearRefreshTokenKeys(cacheService, refreshToken)
    return true
  }
  return false
}

/**
 * 可选鉴权：尽力解析请求身份，解析失败不阻断请求（不返回 401）
 * 解析顺序：Bearer JWT → X-Refresh-Token 兜底刷新（Plan C 已移除 Session）
 *
 * 用于公开路由（如 POST /orders 允许访客下单）：
 * 前端已登录用户的身份携带在 Bearer Token 中；若公开路由不解析 Bearer，
 * 请求会被误判为访客，导致订单归属错误（userId = sharerId/guest），
 * 用户端"我的订单"看不到自己的订单。
 */
export const attachUser: RequestHandler = async (req, res, next) => {
  try {
    // 1. Bearer Token（JWT）
    const authHeader = req.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (bearerToken) {
      const user = verifyAuthToken(bearerToken)
      if (user) {
        const blacklisted = await isAccessTokenBlacklisted(bearerToken)
        if (!blacklisted) {
          // H8：禁用/删除账号不赋予请求身份
          if (!(await isAccountActive(user))) {
            next()
            return
          }
          req.user = user
          next()
          return
        }
      }
    }

    // 2. X-Refresh-Token 兜底刷新（Access Token 过期时）
    // 依赖 refreshAuthToken 的 60 秒宽限期机制保证并发请求安全
    const refreshToken = req.headers['x-refresh-token'] as string | undefined
    if (refreshToken) {
      const newTokens = await refreshAuthToken(refreshToken)
      if (newTokens) {
        try {
          const decoded = jwt.verify(newTokens.token, JWT_SECRET) as JwtPayload
          req.user = {
            id: decoded.id,
            phone: decoded.phone,
            role: decoded.role,
            userId: decoded.userId,
            token: newTokens.token,
          }
          res.setHeader('X-New-Token', newTokens.token)
          res.setHeader('X-New-Refresh-Token', newTokens.refreshToken)
        } catch {
          logger.warn('[Auth] attachUser 刷新后的 Token 验证失败')
        }
      }
    }

    next()
  } catch (error) {
    logger.error('[Auth] attachUser error:', { error: getErrorMessage(error) })
    next()
  }
}

export const requireAuth = authMiddleware()

export const requireAdmin = authMiddleware(['admin'])

export const requireManager = authMiddleware(['admin', 'manager'])

export const requireUser = authMiddleware(['admin', 'user'])

export const requireEmployee = authMiddleware(['admin', 'user', 'employee'])
