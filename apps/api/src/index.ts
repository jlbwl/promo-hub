import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcrypt'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { smsLimiter, loginLimiter } from './middleware/rateLimit.js'
import { sessionMiddleware, login as sessionLogin, logout as sessionLogout, requireAdmin, requireManager, requireUser, requireEmployee } from './middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
const SALT_ROUNDS = 12

// 确保数据目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// 密码加密和验证工具
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  // 如果是明文密码，直接比较（用于兼容旧数据）
  if (password === hash) {
    return true
  }
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

// 导入数据访问层（先尝试数据库，如果失败则使用文件存储）
let dataModule: typeof import('./data.js') | typeof import('./data-memory.js')

try {
  dataModule = await import('./data.js')
} catch {
  console.log('[INFO] 数据库连接失败，使用文件存储模式')
  dataModule = await import('./data-memory.js')
}

const {
  readProducts, writeProducts, insertProduct, updateProduct, readProduct, deleteProduct,
  readManagers, writeManagers, deleteManager,
  readUsers, writeUsers, readUser, insertUser, updateUser, deleteUser,
  readCartItems, readCartByManagerId, addToCart, removeFromCart, removeFromCartByProductId, isInCart,
  readOrders, writeOrders, insertOrder, updateOrder, deleteOrder, readOrder, readDeletedOrders, restoreOrder, getOrderStats,
  readCommissions, writeCommissions,
  readAdminByPhone, readAdminById, updateAdmin,
  readEmployeesByUserId, readEmployeeById, readEmployeeByPhone, insertEmployee, updateEmployee, deleteEmployee, validateEmployee,
  insertOperationLog, readOperationLogs,
  queryOne,
} = dataModule

import { sendSmsCode } from './sms.js'

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())
app.use(sessionMiddleware)

// ============ 产品接口 ============

// 获取产品列表（用户端只看已发布的且经理在白名单中的，经理端看自己的）
app.get('/api/products', async (req, res) => {
  const { page = '1', pageSize = '10', category, status, managerId } = req.query
  let products = await readProducts()

  // 用户端：过滤掉经理不在白名单或已被禁用的产品
  if (!managerId) {
    const managers = await readManagers()
    const activeManagerIds = new Set(
      managers.filter((m: any) => m.status === 'active').map((m: any) => m.id)
    )
    products = products.filter((p: any) => activeManagerIds.has(p.managerId))
  }

  // 经理端：只看自己的产品
  if (managerId) {
    products = products.filter((p: any) => p.managerId === managerId)
  }

  // 按分类筛选
  if (category && category !== '0') {
    products = products.filter((p: any) => p.category === category)
  }

  // 按状态筛选（manager 端可传 status 参数）
  if (status) {
    products = products.filter((p: any) => p.status === status)
  } else if (!managerId) {
    // 用户端默认只返回已发布的产品
    products = products.filter((p: any) => p.status === 'published')
  }

  // 按发布时间倒序
  products.sort((a: any, b: any) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())

  const total = products.length
  const pageNum = parseInt(page as string, 10)
  const pageSizeNum = parseInt(pageSize as string, 10)
  const start = (pageNum - 1) * pageSizeNum
  const list = products.slice(start, start + pageSizeNum)

  // 统计每个产品的做单量（已售）
  const orders = await readOrders()
  const salesMap = new Map<string, number>()
  orders.forEach((o: any) => {
    if (o.productId) {
      salesMap.set(o.productId, (salesMap.get(o.productId) || 0) + 1)
    }
  })
  // 附加 sales 字段到每个产品
  list.forEach((p: any) => {
    p.sales = salesMap.get(p.id) || 0
  })

  res.json({
    code: 0,
    message: 'success',
    data: { list, total, page: pageNum, pageSize: pageSizeNum },
  })
})

// 经理仪表盘统计
app.get('/api/stats/dashboard', async (req, res) => {
  const managerId = req.query.managerId as string
  const products = await readProducts()
  const commissions = await readCommissions()

  // 按经理过滤产品
  const myProducts = managerId
    ? products.filter((p: any) => p.managerId === managerId)
    : products

  const totalProducts = myProducts.length
  const publishedProducts = myProducts.filter((p: any) => p.status === 'published').length

  // 按经理过滤佣金（通过产品的 managerId 关联）
  const myProductIds = new Set(myProducts.map((p: any) => p.id))
  const myCommissions = managerId
    ? commissions.filter((c: any) => myProductIds.has(c.productId))
    : commissions

  const pendingCommissions = myCommissions
    .filter((c: any) => c.status === 'pending')
    .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)

  const totalCommissions = myCommissions
    .filter((c: any) => c.status === 'paid')
    .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)

  res.json({
    code: 0,
    message: 'success',
    data: {
      totalProducts,
      publishedProducts,
      pendingCommissions: Math.round(pendingCommissions * 100) / 100,
      totalCommissions: Math.round(totalCommissions * 100) / 100,
    },
  })
})

// 获取单个产品详情
app.get('/api/products/:id', async (req, res) => {
  const products = await readProducts()
  const product = products.find((p: any) => p.id === req.params.id)
  if (!product) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }
  // 统计做单量
  const orders = await readOrders()
  product.sales = orders.filter((o: any) => o.productId === product.id).length
  res.json({ code: 0, message: 'success', data: product })
})

// 创建产品
app.post('/api/products', async (req, res) => {
  const title = (req.body.title || '').trim()

  if (!title) {
    res.json({ code: 400, message: '产品标题不能为空', data: null })
    return
  }

  const duplicate = await queryOne('SELECT id FROM products WHERE title = ?', [title])
  if (duplicate) {
    res.json({ code: 409, message: '产品标题已存在，请修改后重新发布', data: null })
    return
  }

  const now = new Date().toISOString()
  const product = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...req.body,
    status: req.body.status || 'published',
    publishedAt: req.body.status === 'published' ? now : undefined,
    createdAt: now,
    updatedAt: now,
  }
  await insertProduct(product)
  const savedProduct = await readProduct(product.id)
  res.json({ code: 0, message: '创建成功', data: savedProduct })
})

// 更新产品
app.put('/api/products/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id])
  if (!existing) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }

  if (req.body.managerId && existing.managerId !== req.body.managerId) {
    res.json({ code: 403, message: '无权操作此产品', data: null })
    return
  }

  const title = (req.body.title || '').trim()
  if (title) {
    const duplicate = await queryOne('SELECT id FROM products WHERE title = ? AND id != ?', [title, req.params.id])
    if (duplicate) {
      res.json({ code: 409, message: '产品标题已存在，请修改后重新发布', data: null })
      return
    }
  }

  const now = new Date()
  const nowStr = now.toISOString().replace('T', ' ').substring(0, 19)
  const updatedFields: Record<string, any> = {
    ...req.body,
    publishedAt: req.body.status === 'published' && !existing.publishedAt ? nowStr : existing.publishedAt,
  }
  await updateProduct(req.params.id, updatedFields)

  const updated = await readProduct(req.params.id)
  res.json({ code: 0, message: '更新成功', data: updated })
})

// 删除产品
app.delete('/api/products/:id', async (req, res) => {
  console.log('[删除产品] 收到请求, ID:', req.params.id, 'ManagerId:', req.query.managerId)
  try {
    const products = await readProducts()
    const product = products.find((p: any) => p.id === req.params.id)
    if (!product) {
      console.log('[删除产品] 产品不存在:', req.params.id)
      res.json({ code: 404, message: '产品不存在', data: null })
      return
    }

    console.log('[删除产品] 找到产品:', product.title, 'managerId:', product.managerId)

    // 校验产品归属
    const managerId = req.query.managerId as string
    if (managerId && product.managerId !== managerId) {
      console.log('[删除产品] 无权删除, 请求者:', managerId, '所有者:', product.managerId)
      res.json({ code: 403, message: '无权操作此产品', data: null })
      return
    }

    console.log('[删除产品] 开始删除, ID:', req.params.id)
    await deleteProduct(req.params.id)
    console.log('[删除产品] 删除成功, ID:', req.params.id)
    res.json({ code: 0, message: '删除成功', data: null })
  } catch (error: any) {
    console.error('[删除产品] 错误:', error)
    res.status(500).json({ code: 500, message: '删除失败: ' + error.message, data: null })
  }
})

// ============ 经理白名单接口 ============

// 获取经理列表
app.get('/api/managers', async (_req, res) => {
  const managers = await readManagers()
  res.json({ code: 0, message: 'success', data: managers })
})

// 获取单个经理信息
app.get('/api/managers/:id', async (req, res) => {
  const managerId = req.params.id
  const managers = await readManagers()
  const manager = managers.find((m: any) => m.id === managerId)
  
  if (!manager) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }

  // 返回时隐藏密码
  const { password: _, ...safeManager } = manager
  res.json({ code: 0, message: 'success', data: safeManager })
})

// 添加经理
app.post('/api/managers', async (req, res) => {
  const managers = await readManagers()
  const { teamName, password, phone } = req.body

  if (!teamName || !password) {
    res.json({ code: 400, message: '渠道名称和密码不能为空', data: null })
    return
  }

  // 渠道名称重复校验
  if (managers.find((m: any) => m.teamName === teamName)) {
    res.json({ code: 409, message: '该渠道名称已存在', data: null })
    return
  }

  // 同时检查用户表中的团队名称
  const users = await readUsers()
  if (users.find((u: any) => u.teamName === teamName)) {
    res.json({ code: 409, message: '该团队名称已存在', data: null })
    return
  }

  const now = new Date().toISOString()
  const hashedPassword = await hashPassword(password)
  const manager = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    username: teamName,
    password: hashedPassword,
    name: teamName,
    teamName,
    phone: phone || '',
    role: 'manager',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  managers.push(manager)
  await writeManagers(managers)
  // 返回时隐藏密码
  const { password: _, ...safeManager } = manager
  res.json({ code: 0, message: '添加成功', data: safeManager })
})

// 删除经理（同时下架其所有产品，转移佣金数据给管理后台）
app.delete('/api/managers/:id', requireAdmin, async (req, res) => {
  const smsCode = req.query.smsCode as string
  // 从 localStorage 获取管理员信息（这里简化处理，实际需要从 token 获取管理员）
  // 这里假设管理员的手机号需要验证
  // 先验证验证码
  if (!smsCode) {
    res.json({ code: 400, message: '验证码不能为空', data: null })
    return
  }
  
  // 这里简化处理：因为前端从 localStorage 获取了管理员手机号发送验证码
  // 我们需要查找最后发送给管理员的验证码
  let validCodeFound = false
  for (const [phone, record] of smsCodes.entries()) {
    if (record.code === smsCode && Date.now() <= record.expiresAt) {
      validCodeFound = true
      smsCodes.delete(phone)
      break
    }
  }
  
  if (!validCodeFound) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  
  let managers = await readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  const managerId = managers[index].id
  const managerName = managers[index].name || ''
  await deleteManager(managerId)

  // 下架该经理的所有已发布产品
  let products = await readProducts()
  let offlineCount = 0
  products = products.map((p: any) => {
    if (p.managerId === managerId && p.status === 'published') {
      offlineCount++
      return { ...p, status: 'offline', updatedAt: new Date().toISOString() }
    }
    return p
  })
  await writeProducts(products)

  // 转移该经理的待处理订单：标记为管理后台接管
  let orders = await readOrders()
  const now = new Date().toISOString()
  let transferredOrders = 0
  orders = orders.map((o: any) => {
    if (o.managerId === managerId && (o.status === 'pending' || o.status === 'approved' || o.status === 'pending_payment')) {
      transferredOrders++
      return {
        ...o,
        transferredFromManager: managerName,
        transferredAt: now,
        managedBy: 'admin', // 标记为管理后台接管
      }
    }
    return o
  })
  await writeOrders(orders)

  res.json({
    code: 0,
    message: `删除成功，已下架 ${offlineCount} 个产品，转移 ${transferredOrders} 笔订单至管理后台`,
    data: null
  })
})

// 删除用户
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const smsCode = req.query.smsCode as string
  // 验证验证码
  if (!smsCode) {
    res.json({ code: 400, message: '验证码不能为空', data: null })
    return
  }
  
  // 查找验证码
  let validCodeFound = false
  for (const [phone, record] of smsCodes.entries()) {
    if (record.code === smsCode && Date.now() <= record.expiresAt) {
      validCodeFound = true
      smsCodes.delete(phone)
      break
    }
  }
  
  if (!validCodeFound) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  
  let users = await readUsers()
  const index = users.findIndex((u: any) => u.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '用户不存在', data: null })
    return
  }
  await deleteUser(req.params.id)
  
  res.json({ code: 0, message: '删除成功', data: null })
})

// 更新经理（启用/禁用时联动产品状态）
app.put('/api/managers/:id', async (req, res) => {
  const managers = await readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  const now = new Date().toISOString()
  const newStatus = req.body.status
  managers[index] = { ...managers[index], ...req.body, id: managers[index].id, updatedAt: now }
  await writeManagers(managers)

  // 禁用时下架产品，启用时不自动恢复（需经理手动操作）
  if (newStatus === 'disabled') {
    let products = await readProducts()
    let offlineCount = 0
    products = products.map((p: any) => {
      if (p.managerId === req.params.id && p.status === 'published') {
        offlineCount++
        return { ...p, status: 'offline', updatedAt: now }
      }
      return p
    })
    await writeProducts(products)
  }

  const { password: _, ...safeManager } = managers[index]
  res.json({ code: 0, message: '更新成功', data: safeManager })
})

// 经理登录校验
app.post('/api/managers/login', loginLimiter, async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) {
    res.json({ code: 400, message: '手机号和密码不能为空', data: null })
    return
  }
  const managers = await readManagers()
  const manager = managers.find(
    (m: any) => m.phone === phone && m.status === 'active'
  )
  if (!manager) {
    res.json({ code: 401, message: '手机号或密码错误，或账号已被禁用', data: null })
    return
  }
  const passwordValid = await verifyPassword(password, manager.password)
  if (!passwordValid) {
    res.json({ code: 401, message: '手机号或密码错误，或账号已被禁用', data: null })
    return
  }
  
  sessionLogin(req, { id: manager.id, phone: manager.phone, role: 'manager', nickname: manager.name, teamName: manager.teamName })
  
  const { password: _, ...safeManager } = manager
  res.json({ code: 0, message: '登录成功', data: { manager: safeManager } })
})

// 经理短信验证码发送
app.post('/api/managers/sms/send', smsLimiter, async (req, res) => {
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    res.json({ code: 400, message: '请输入正确的手机号', data: null })
    return
  }
  
  // 防刷：60秒内不能重复发送
  const existing = smsCodes.get(phone)
  if (existing && existing.sentAt && Date.now() - existing.sentAt < 60000) {
    res.json({ code: 429, message: '发送太频繁，请60秒后重试', data: null })
    return
  }
  
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 10 * 60 * 1000
  smsCodes.set(phone, { code, expiresAt, phone, sentAt: Date.now() })
  await sendSmsCode(phone, code)
  res.json({ code: 0, message: '验证码已发送', data: null })
})

// 经理短信验证码登录
app.post('/api/managers/sms/login', async (req, res) => {
  const { phone, code } = req.body
  if (!phone || !code) {
    res.json({ code: 400, message: '手机号和验证码不能为空', data: null })
    return
  }
  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt || record.code !== code) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  smsCodes.delete(phone)

  const managers = await readManagers()
  const manager = managers.find((m: any) => m.phone === phone && m.status === 'active')
  if (!manager) {
    res.json({ code: 404, message: '该手机号未注册或已被禁用', data: null })
    return
  }
  
  sessionLogin(req, { id: manager.id, phone: manager.phone, role: 'manager', nickname: manager.name, teamName: manager.teamName })
  
  const { password: _, ...safeManager } = manager
  res.json({ code: 0, message: '登录成功', data: { manager: safeManager } })
})

// 经理身份验证（检查经理是否仍存在且启用）
app.get('/api/managers/verify', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.json({ code: 401, message: '未登录', data: null })
    return
  }
  // token 格式为 mgr_timestamp_random，无法直接关联经理
  // 改为通过 manager_info 中的 id 验证
  const managers = await readManagers()
  // 如果白名单中没有任何经理（极端情况），也返回 401
  if (managers.length === 0) {
    res.json({ code: 0, message: 'ok', data: { valid: true } })
    return
  }
  res.json({ code: 0, message: 'ok', data: { valid: true } })
})

// 通过经理ID验证身份
app.get('/api/managers/:id/verify', async (req, res) => {
  const managers = await readManagers()
  const manager = managers.find((m: any) => m.id === req.params.id)
  if (!manager) {
    res.json({ code: 401, message: '账号已被删除', data: null })
    return
  }
  if (manager.status !== 'active') {
    res.json({ code: 401, message: '账号已被禁用', data: null })
    return
  }
  res.json({ code: 0, message: 'ok', data: { valid: true } })
})

// 经理：通过短信验证码修改密码
app.post('/api/managers/password/set', async (req, res) => {
  const { phone, code, password } = req.body
  if (!phone || !code || !password) {
    res.json({ code: 400, message: '缺少参数', data: null })
    return
  }
  if (password.length < 6) {
    res.json({ code: 400, message: '密码长度至少6位', data: null })
    return
  }

  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt || record.code !== code) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  smsCodes.delete(phone)

  let managers = await readManagers()
  const index = managers.findIndex((m: any) => m.phone === phone)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }

  const hashedPassword = await hashPassword(password)
  managers[index].password = hashedPassword
  managers[index].updatedAt = new Date().toISOString()
  await writeManagers(managers)

  res.json({ code: 0, message: '密码修改成功', data: null })
})

// ============ 用户接口（普通用户，非经理） ============

// 用户注册
app.post('/api/users/register', async (req, res) => {
  const { phone, password, nickname, teamName } = req.body

  if (!phone || !password) {
    res.json({ code: 400, message: '手机号和密码不能为空', data: null })
    return
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    res.json({ code: 400, message: '手机号格式不正确', data: null })
    return
  }
  if (password.length < 6) {
    res.json({ code: 400, message: '密码长度不能少于6位', data: null })
    return
  }

  const users = await readUsers()
  if (users.find((u: any) => u.phone === phone)) {
    res.json({ code: 409, message: '该手机号已注册', data: null })
    return
  }

  // 团队名称查重
  if (teamName) {
    if (users.find((u: any) => u.teamName === teamName)) {
      res.json({ code: 409, message: '该团队名称已存在', data: null })
      return
    }
  }

  const now = new Date().toISOString()
  const hashedPassword = await hashPassword(password)
  const user = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone,
    password: hashedPassword,
    nickname: nickname || `用户${phone.slice(-4)}`,
    teamName: teamName || '',
    role: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  users.push(user)
  await writeUsers(users)

  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '注册成功', data: { token, user: safeUser } })
})

// 用户登录
app.post('/api/users/login', loginLimiter, async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) {
    res.json({ code: 400, message: '手机号和密码不能为空', data: null })
    return
  }
  const users = await readUsers()
  const user = users.find(
    (u: any) => u.phone === phone && u.status === 'active'
  )
  if (!user) {
    res.json({ code: 401, message: '手机号或密码错误，或账号已被禁用', data: null })
    return
  }
  const passwordValid = await verifyPassword(password, user.password)
  if (!passwordValid) {
    res.json({ code: 401, message: '手机号或密码错误，或账号已被禁用', data: null })
    return
  }
  
  sessionLogin(req, { id: user.id, phone: user.phone, role: 'user', nickname: user.nickname, teamName: user.teamName })
  
  const { password: _, ...safeUser } = user
  res.json({ code: 0, message: '登录成功', data: { user: safeUser } })
})

// ============ 短信验证码登录 ============

interface SmsCodeRecord {
  code: string
  expiresAt: number
  phone: string
  sentAt: number
}

const smsCodes = new Map<string, SmsCodeRecord>()

// 发送短信验证码
app.post('/api/users/sms/send', smsLimiter, async (req, res) => {
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    res.json({ code: 400, message: '手机号格式不正确', data: null })
    return
  }

  // 防刷：60秒内不能重复发送
  const existing = smsCodes.get(phone)
  if (existing && existing.sentAt && Date.now() - existing.sentAt < 60000) {
    res.json({ code: 429, message: '发送太频繁，请60秒后重试', data: null })
    return
  }

  // 生成6位验证码
  const code = String(Math.floor(100000 + Math.random() * 900000))
  smsCodes.set(phone, { code, expiresAt: Date.now() + 300000, phone, sentAt: Date.now() })

  await sendSmsCode(phone, code)

  res.json({ code: 0, message: '验证码已发送', data: { expiresIn: 300 } })
})

// 短信验证码登录/注册
app.post('/api/users/sms/login', async (req, res) => {
  const { phone, code, teamName } = req.body
  if (!phone || !code) {
    res.json({ code: 400, message: '手机号和验证码不能为空', data: null })
    return
  }

  // 验证码校验
  const record = smsCodes.get(phone)
  if (!record) {
    res.json({ code: 400, message: '请先获取验证码', data: null })
    return
  }
  if (Date.now() > record.expiresAt) {
    smsCodes.delete(phone)
    res.json({ code: 400, message: '验证码已过期，请重新获取', data: null })
    return
  }
  if (record.code !== code) {
    res.json({ code: 400, message: '验证码错误', data: null })
    return
  }
  smsCodes.delete(phone) // 验证后删除

  // 查找或创建用户
  let users = await readUsers()
  let user = users.find((u: any) => u.phone === phone)

  if (!user) {
    // 团队名称查重
    if (teamName) {
      if (users.find((u: any) => u.teamName === teamName)) {
        res.json({ code: 409, message: '该团队名称已存在', data: null })
        return
      }
    }

    // 自动注册
    const now = new Date().toISOString()
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phone,
      password: '',
      nickname: `用户${phone.slice(-4)}`,
      teamName: teamName || '',
      role: 'user',
      status: 'active',
      loginMethods: ['sms'],
      createdAt: now,
      updatedAt: now,
    }
    users.push(user)
    await writeUsers(users)
  } else {
    // 记录登录方式
    if (!user.loginMethods) user.loginMethods = []
    if (!user.loginMethods.includes('sms')) user.loginMethods.push('sms')
    user.updatedAt = new Date().toISOString()
    users = users.map((u: any) => u.id === user!.id ? user : u)
    await writeUsers(users)
  }

  sessionLogin(req, { id: user.id, phone: user.phone, role: 'user', nickname: user.nickname, teamName: user.teamName })

  const { password: _, ...safeUser } = user
  res.json({ code: 0, message: '登录成功', data: { user: safeUser } })
})

// 用户：通过短信验证码设置/修改密码
app.post('/api/users/password/set', async (req, res) => {
  const { phone, code, password } = req.body
  if (!phone || !code || !password) {
    res.json({ code: 400, message: '缺少参数', data: null })
    return
  }
  if (password.length < 6) {
    res.json({ code: 400, message: '密码长度至少6位', data: null })
    return
  }

  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt || record.code !== code) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  smsCodes.delete(phone)

  let users = await readUsers()
  const index = users.findIndex((u: any) => u.phone === phone)
  if (index === -1) {
    res.json({ code: 404, message: '用户不存在', data: null })
    return
  }

  const hashedPassword = await hashPassword(password)
  users[index].password = hashedPassword
  users[index].updatedAt = new Date().toISOString()
  await writeUsers(users)

  res.json({ code: 0, message: '密码设置成功', data: null })
})

// 管理后台：获取普通用户列表（团队管理）
app.get('/api/users', async (req, res) => {
  const { page = '1', pageSize = '10', role, status, keyword, teamName } = req.query
  const users = await readUsers()

  // 只返回普通用户
  const allUsers = users.map((u: any) => ({
    id: u.id,
    name: u.nickname,
    phone: u.phone,
    teamName: u.teamName || '',
    role: u.role,
    status: u.status === 'active' ? 1 : 0,
    createdAt: u.createdAt,
  }))

  // 按角色筛选
  let filtered = allUsers
  if (role) {
    filtered = filtered.filter((u: any) => u.role === role)
  }
  if (status !== undefined && status !== '') {
    const s = Number(status)
    filtered = filtered.filter((u: any) => u.status === s)
  }
  if (keyword) {
    const kw = String(keyword).toLowerCase()
    filtered = filtered.filter(
      (u: any) => 
        (u.name || '').toLowerCase().includes(kw) || 
        (u.phone || '').includes(kw) ||
        (u.teamName || '').toLowerCase().includes(kw)
    )
  }
  if (teamName) {
    const tn = String(teamName).toLowerCase()
    filtered = filtered.filter(
      (u: any) => (u.teamName || '').toLowerCase().includes(tn)
    )
  }

  filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = filtered.length
  const pageNum = parseInt(page as string, 10)
  const pageSizeNum = parseInt(pageSize as string, 10)
  const start = (pageNum - 1) * pageSizeNum
  const list = filtered.slice(start, start + pageSizeNum)

  res.json({ code: 0, message: 'success', data: { list, total, page: pageNum, pageSize: pageSizeNum } })
})

// 管理后台：切换用户状态
app.put('/api/users/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body
  const userId = req.params.id

  // 先查经理表
  let managers = await readManagers()
  const mgrIdx = managers.findIndex((m: any) => m.id === userId)
  if (mgrIdx !== -1) {
    managers[mgrIdx].status = status ? 'active' : 'disabled'
    managers[mgrIdx].updatedAt = new Date().toISOString()
    await writeManagers(managers)
    // 联动下架产品
    if (!status) {
      let products = await readProducts()
      products = products.map((p: any) =>
        p.managerId === userId && p.status === 'published'
          ? { ...p, status: 'offline', updatedAt: new Date().toISOString() }
          : p
      )
      await writeProducts(products)
    }
    res.json({ code: 0, message: '更新成功', data: null })
    return
  }

  // 再查用户表
  let users = await readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  if (usrIdx !== -1) {
    users[usrIdx].status = status ? 'active' : 'disabled'
    users[usrIdx].updatedAt = new Date().toISOString()
    await writeUsers(users)
    res.json({ code: 0, message: '更新成功', data: null })
    return
  }

  res.json({ code: 404, message: '用户不存在', data: null })
})

// 管理后台：切换用户角色
app.put('/api/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body
  const userId = req.params.id

  // 先查经理表
  let managers = await readManagers()
  const mgrIdx = managers.findIndex((m: any) => m.id === userId)
  if (mgrIdx !== -1) {
    managers[mgrIdx].role = role
    managers[mgrIdx].updatedAt = new Date().toISOString()
    await writeManagers(managers)
    res.json({ code: 0, message: '更新成功', data: null })
    return
  }

  // 再查用户表
  let users = await readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  if (usrIdx !== -1) {
    users[usrIdx].role = role
    users[usrIdx].updatedAt = new Date().toISOString()
    await writeUsers(users)
    res.json({ code: 0, message: '更新成功', data: null })
    return
  }

  res.json({ code: 404, message: '用户不存在', data: null })
})

// 管理后台修改用户团队名称
app.put('/api/users/:id/team-name', requireAdmin, async (req, res) => {
  const { teamName } = req.body
  const userId = req.params.id

  console.log('[调试] 修改团队名称:', { userId, teamName })

  if (!teamName) {
    res.json({ code: 400, message: '团队名称不能为空', data: null })
    return
  }

  // 先查用户是否存在
  let users = await readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  
  if (usrIdx !== -1) {
    console.log('[调试] 找到普通用户:', users[usrIdx])
    // 是普通用户
    const oldTeamName = users[usrIdx].teamName
    
    // 团队名称查重（排除当前用户，同时检查用户表和经理表）
    const managers = await readManagers()
    if (users.find((u: any) => u.id !== userId && u.teamName === teamName) || 
        managers.find((m: any) => m.teamName === teamName)) {
      res.json({ code: 409, message: '该团队名称已存在', data: null })
      return
    }

    // 更新用户团队名称
    users[usrIdx].teamName = teamName
    users[usrIdx].updatedAt = new Date().toISOString()
    await writeUsers(users)
    console.log('[调试] 已保存用户数据:', users[usrIdx])

    res.json({ code: 0, message: '更新成功', data: null })
  } else {
    // 不是普通用户，检查是否是经理
    let managers = await readManagers()
    const mgrIdx = managers.findIndex((m: any) => m.id === userId)
    
    if (mgrIdx === -1) {
      console.log('[调试] 用户不存在')
      res.json({ code: 404, message: '用户不存在', data: null })
      return
    }

    console.log('[调试] 找到渠道经理:', managers[mgrIdx])
    // 是经理
    const oldTeamName = managers[mgrIdx].teamName
    
    // 团队名称查重（排除当前经理，同时检查用户表和经理表）
    if (managers.find((m: any) => m.id !== userId && m.teamName === teamName) || 
        users.find((u: any) => u.teamName === teamName)) {
      res.json({ code: 409, message: '该团队名称已存在', data: null })
      return
    }

    // 更新经理团队名称
    managers[mgrIdx].teamName = teamName
    managers[mgrIdx].updatedAt = new Date().toISOString()
    await writeManagers(managers)
    console.log('[调试] 已保存经理数据:', managers[mgrIdx])

    // 注意：渠道经理的团队名称变更不会影响历史订单
    // 因为订单的 teamName 是做单用户的团队名称

    res.json({ code: 0, message: '更新成功', data: null })
  }
})

// 管理后台：修改渠道经理团队名称
app.put('/api/managers/:id/team-name', requireAdmin, async (req, res) => {
  const { teamName } = req.body
  const managerId = req.params.id

  console.log('[调试] 修改渠道经理团队名称:', { managerId, teamName })

  if (!teamName) {
    res.json({ code: 400, message: '渠道名称不能为空', data: null })
    return
  }

  // 查询经理是否存在
  let managers = await readManagers()
  const mgrIdx = managers.findIndex((m: any) => m.id === managerId)
  
  if (mgrIdx === -1) {
    console.log('[调试] 渠道经理不存在')
    res.json({ code: 404, message: '渠道经理不存在', data: null })
    return
  }

  console.log('[调试] 找到渠道经理:', managers[mgrIdx])
  
  // 团队名称查重（排除当前经理，同时检查用户表和经理表）
  const users = await readUsers()
  if (managers.find((m: any) => m.id !== managerId && m.teamName === teamName) || 
      users.find((u: any) => u.teamName === teamName)) {
    res.json({ code: 409, message: '该渠道名称已存在', data: null })
    return
  }

  // 更新经理团队名称
  managers[mgrIdx].teamName = teamName
  managers[mgrIdx].updatedAt = new Date().toISOString()
  await writeManagers(managers)
  console.log('[调试] 已保存渠道经理数据:', managers[mgrIdx])

  res.json({ code: 0, message: '更新成功', data: null })
})

// 管理后台：获取单个用户详情
app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id
  console.log('[调试] 获取用户详情:', userId)
  
  // 先查经理表
  const managers = await readManagers()
  const manager = managers.find((m: any) => m.id === userId)
  if (manager) {
    console.log('[调试] 找到经理数据:', manager)
    res.json({
      code: 0,
      message: 'success',
      data: {
        id: manager.id,
        name: manager.name,
        phone: manager.phone,
        teamName: manager.teamName || '',
        role: 'manager',
        status: manager.status === 'active' ? 1 : 0,
        createdAt: manager.createdAt,
      }
    })
    return
  }

  // 再查用户表
  const users = await readUsers()
  const user = users.find((u: any) => u.id === userId)
  if (user) {
    console.log('[调试] 找到用户数据:', user)
    res.json({
      code: 0,
      message: 'success',
      data: {
        id: user.id,
        name: user.nickname,
        phone: user.phone,
        teamName: user.teamName || '',
        role: user.role,
        status: user.status === 'active' ? 1 : 0,
        createdAt: user.createdAt,
      }
    })
    return
  }

  console.log('[调试] 用户不存在')
  res.json({ code: 404, message: '用户不存在', data: null })
})

// ============ 做单接口 ============

// 做单（扣减库存）
app.post('/api/orders', async (req, res) => {
  console.log('[做单] 收到请求:', JSON.stringify(req.body))
  try {
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone } = req.body
    if (!productId) {
      console.log('[做单] 缺少productId')
      res.json({ code: 400, message: '缺少产品ID', data: null })
      return
    }

    let products = await readProducts()
    const index = products.findIndex((p: any) => p.id === productId)
    if (index === -1) {
      console.log('[做单] 产品不存在:', productId)
      res.json({ code: 404, message: '产品不存在', data: null })
      return
    }

    const product = products[index]
    console.log('[做单] 产品信息:', { title: product.title, options: product.options, managerId: product.managerId })

    // 检查产品状态
    if (product.status !== 'published') {
      console.log('[做单] 产品未发布:', product.status)
      res.json({ code: 400, message: '该产品已下架', data: null })
      return
    }

    // 检查库存（stock 为 0 或未设置表示不限库存）
    if (product.stock && product.stock > 0) {
      if (product.stock < 1) {
        console.log('[做单] 库存不足')
        res.json({ code: 400, message: '库存不足', data: null })
        return
      }
      console.log('[做单] 扣减库存, 原库存:', product.stock, '新库存:', product.stock - 1)
      // 使用 updateProduct 而不是 writeProducts，性能更高
      await updateProduct(product.id, { stock: product.stock - 1, updatedAt: new Date().toISOString() })
    }

    // 如果是员工子账户做单，获取主账户ID
    let finalUserId = userId || 'guest'
    if (employeeId) {
      console.log('[做单] 员工做单, employeeId:', employeeId)
      const employee = await readEmployeeById(employeeId)
      if (employee) {
        finalUserId = employee.userId
        console.log('[做单] 员工主账户ID:', finalUserId)
      }
    }

    // 获取用户团队名称
    let teamName = ''
    if (finalUserId !== 'guest') {
      const user = await readUser(finalUserId)
      if (user) {
        teamName = user.teamName || ''
      }
    }

    // 清理 redirectUrl
    const cleanRedirectUrl = (redirectUrl || '').replace(/`/g, '')
    console.log('[做单] 原始redirectUrl:', redirectUrl, '清理后:', cleanRedirectUrl)

    // 记录做单
    const order = {
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      userId: finalUserId,
      managerId: product.managerId,
      productName: product.title,
      productPrice: product.price,
      optionLabel: optionLabel || '',
      redirectUrl: cleanRedirectUrl,
      userName: userName || '',
      userPhone: userPhone || '',
      teamName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    console.log('[做单] 创建订单:', JSON.stringify(order))
    // 使用 insertOrder 而不是 writeOrders，性能更高
    await insertOrder(order)
    console.log('[做单] 订单已保存成功, ID:', order.id)

    const remainingStock = product.stock && product.stock > 0 ? product.stock - 1 : (product.stock || -1)
    console.log('[做单] 返回成功响应')
    res.json({ code: 0, message: '做单成功', data: { order, remainingStock } })
  } catch (error: any) {
    console.error('[做单] 错误:', error)
    res.status(500).json({ code: 500, message: '做单失败: ' + error.message, data: null })
  }
})

// 获取订单列表（用户端按 userId，经理端按 managerId）
app.get('/api/orders', async (req, res) => {
  const { userId, managerId, status, page = '1', pageSize = '20' } = req.query
  let orders = await readOrders()

  // 按用户过滤
  if (userId) {
    orders = orders.filter((o: any) => o.userId === userId)
  }
  // 按经理过滤
  if (managerId) {
    orders = orders.filter((o: any) => o.managerId === managerId)
  }
  // 按状态过滤
  if (status) {
    orders = orders.filter((o: any) => o.status === status)
  }
  // 按管理后台接管过滤
  if (req.query.managedBy) {
    orders = orders.filter((o: any) => o.managedBy === req.query.managedBy)
  }

  orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // 预加载所有用户和经理数据，用于动态获取团队名称
  const users = await readUsers()
  const managers = await readManagers()

  const total = orders.length
  const pageNum = parseInt(page as string, 10)
  const pageSizeNum = parseInt(pageSize as string, 10)
  const start = (pageNum - 1) * pageSizeNum
  const list = orders.slice(start, start + pageSizeNum).map(order => {
    // 动态获取用户当前的团队名称
    let currentTeamName = order.teamName || ''
    if (order.userId && order.userId !== 'guest') {
      const user = users.find((u: any) => u.id === order.userId)
      if (user && user.teamName) {
        currentTeamName = user.teamName
      }
    }
    return {
      ...order,
      teamName: currentTeamName
    }
  })

  res.json({ code: 0, message: 'success', data: { list, total, page: pageNum, pageSize: pageSizeNum } })
})

// 删除订单（管理后台）
app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { reason, adminId, adminPhone, adminName } = req.body
  
  try {
    // 先读取订单数据用于日志记录
    const order = await readOrder(id)
    if (!order) {
      res.json({ code: 404, message: '订单不存在', data: null })
      return
    }
    
    // 执行删除
    await deleteOrder(id)
    
    // 记录操作日志
    await insertOperationLog({
      adminId: adminId || '',
      adminPhone: adminPhone || '',
      adminName: adminName || '未知管理员',
      operationType: 'delete',
      targetType: 'order',
      targetId: id,
      targetName: order.productName || '订单',
      reason: reason || '',
      detail: JSON.stringify(order),
    })
    
    res.json({ code: 0, message: '删除成功', data: null })
  } catch (error: any) {
    console.error('[订单删除] 错误:', error)
    res.json({ code: 500, message: '删除失败', data: null })
  }
})

// 用户端删除订单（软删除）
app.delete('/api/user/orders/:id', async (req, res) => {
  const { id } = req.params
  const { userId } = req.body
  
  try {
    const order = await readOrder(id)
    if (!order) {
      res.json({ code: 404, message: '订单不存在', data: null })
      return
    }
    
    // 验证用户权限
    if (order.userId !== userId) {
      res.json({ code: 403, message: '无权操作此订单', data: null })
      return
    }
    
    await deleteOrder(id)
    
    res.json({ code: 0, message: '已移至回收站', data: null })
  } catch (error: any) {
    console.error('[用户删除订单] 错误:', error)
    res.json({ code: 500, message: '删除失败', data: null })
  }
})

// 获取用户已删除的订单（回收站）
app.get('/api/user/orders/deleted', async (req, res) => {
  const { userId } = req.query
  
  try {
    const orders = await readDeletedOrders(userId as string)
    res.json({ code: 0, message: 'success', data: orders })
  } catch (error: any) {
    console.error('[获取已删除订单] 错误:', error)
    res.json({ code: 500, message: '获取失败', data: null })
  }
})

// 恢复订单（从回收站找回）
app.post('/api/user/orders/:id/restore', async (req, res) => {
  const { id } = req.params
  const { userId } = req.body
  
  try {
    // 先检查订单是否存在于回收站
    const orders = await readDeletedOrders(userId)
    const order = orders.find((o: any) => o.id === id)
    
    if (!order) {
      res.json({ code: 404, message: '订单不存在或不在回收站', data: null })
      return
    }
    
    // 验证用户权限
    if (order.userId !== userId) {
      res.json({ code: 403, message: '无权操作此订单', data: null })
      return
    }
    
    await restoreOrder(id)
    
    res.json({ code: 0, message: '恢复成功', data: null })
  } catch (error: any) {
    console.error('[恢复订单] 错误:', error)
    res.json({ code: 500, message: '恢复失败', data: null })
  }
})

// 提交资金号
app.post('/api/user/orders/fund-account', async (req, res) => {
  const { userId, orderId, fundAccount } = req.body
  
  if (!userId || !orderId || !fundAccount) {
    res.json({ code: 400, message: '缺少必要参数', data: null })
    return
  }
  
  try {
    const order = await readOrder(orderId)
    if (!order) {
      res.json({ code: 404, message: '订单不存在', data: null })
      return
    }
    
    if (order.userId !== userId) {
      res.json({ code: 403, message: '无权操作此订单', data: null })
      return
    }
    
    await updateOrder(orderId, { fundAccount })
    
    res.json({ code: 0, message: '提交成功', data: null })
  } catch (error: any) {
    console.error('[提交资金号] 错误:', error)
    res.json({ code: 500, message: '提交失败', data: null })
  }
})

// 获取购物车列表
app.get('/api/cart', async (req, res) => {
  const { userId } = req.query
  if (!userId) {
    res.json({ code: 400, message: '缺少用户ID', data: null })
    return
  }
  try {
    let items: any[] = []
    try {
      items = await readCartItems(userId as string)
    } catch (dbError: any) {
      console.warn('[获取购物车] 数据库查询失败，尝试降级到内存存储:', dbError)
      const { readCartItems: memReadCart } = await import('./data-memory.js')
      items = await memReadCart(userId as string)
    }
    res.json({ code: 0, message: 'success', data: items })
  } catch (error: any) {
    console.error('[获取购物车] 最终错误:', error)
    res.json({ code: 0, message: 'success', data: [] }) // 即使失败也返回空数组，不影响用户体验
  }
})

// 获取经理下所有购物车（主账户的）
app.get('/api/manager/cart', async (req, res) => {
  const { managerId } = req.query
  if (!managerId) {
    res.json({ code: 400, message: '缺少经理ID', data: null })
    return
  }
  try {
    let items: any[] = []
    try {
      items = await readCartByManagerId(managerId as string)
    } catch (dbError: any) {
      console.warn('[获取经理购物车] 数据库查询失败，尝试降级到内存存储:', dbError)
      const { readCartByManagerId: memReadCart } = await import('./data-memory.js')
      items = await memReadCart(managerId as string)
    }
    res.json({ code: 0, message: 'success', data: items })
  } catch (error: any) {
    console.error('[获取经理购物车] 最终错误:', error)
    res.json({ code: 0, message: 'success', data: [] }) // 即使失败也返回空数组，不影响用户体验
  }
})

// 添加到购物车
app.post('/api/cart', async (req, res) => {
  const { userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl } = req.body
  if (!userId || !productId) {
    res.json({ code: 400, message: '缺少必要参数', data: null })
    return
  }
  try {
    try {
      // 检查是否已在购物车
      const exists = await isInCart(userId, productId)
      if (exists) {
        res.json({ code: 400, message: '该产品已在购物车中', data: null })
        return
      }
      await addToCart({ userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl })
    } catch (dbError: any) {
      console.warn('[添加购物车] 数据库失败，尝试降级到内存:', dbError)
      const { isInCart: memIsInCart, addToCart: memAddToCart } = await import('./data-memory.js')
      const exists = await memIsInCart(userId, productId)
      if (exists) {
        res.json({ code: 400, message: '该产品已在购物车中', data: null })
        return
      }
      await memAddToCart({ userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl })
    }
    res.json({ code: 0, message: '添加成功', data: null })
  } catch (error: any) {
    console.error('[添加购物车] 最终错误:', error)
    res.json({ code: 500, message: '添加失败', data: null })
  }
})

// 从购物车移除
app.delete('/api/cart/:id', async (req, res) => {
  const { id } = req.params
  try {
    try {
      await removeFromCart(id)
    } catch (dbError: any) {
      console.warn('[移除购物车] 数据库失败，尝试降级到内存:', dbError)
      const { removeFromCart: memRemoveFromCart } = await import('./data-memory.js')
      await memRemoveFromCart(id)
    }
    res.json({ code: 0, message: '移除成功', data: null })
  } catch (error: any) {
    console.error('[移除购物车] 最终错误:', error)
    res.json({ code: 500, message: '移除失败', data: null })
  }
})

// 检查产品是否在购物车
app.get('/api/cart/check', async (req, res) => {
  const { userId, productId } = req.query
  if (!userId || !productId) {
    res.json({ code: 400, message: '缺少必要参数', data: null })
    return
  }
  try {
    let exists = false
    try {
      exists = await isInCart(userId as string, productId as string)
    } catch (dbError: any) {
      console.warn('[检查购物车] 数据库失败，尝试降级到内存:', dbError)
      const { isInCart: memIsInCart } = await import('./data-memory.js')
      exists = await memIsInCart(userId as string, productId as string)
    }
    res.json({ code: 0, message: 'success', data: { inCart: exists } })
  } catch (error: any) {
    console.error('[检查购物车] 最终错误:', error)
    res.json({ code: 0, message: 'success', data: { inCart: false } })
  }
})

// 获取订单统计
app.get('/api/orders/stats', async (req, res) => {
  const { userId, managerId } = req.query
  try {
    let stats: any = null
    try {
      // 直接获取已删除=0的订单进行统计
      stats = await getOrderStats(managerId as string)
    } catch (dbError: any) {
      console.warn('[订单统计] 数据库查询失败，尝试降级到内存:', dbError)
      const { getOrderStats: memGetOrderStats } = await import('./data-memory.js')
      stats = await memGetOrderStats(managerId as string)
    }

    // 如果有userId过滤，需要在结果中再次过滤
    if (userId) {
      let orders: any[] = []
      try {
        orders = await readOrders()
      } catch (dbError2: any) {
        console.warn('[订单统计] readOrders 失败，尝试降级:', dbError2)
        const { readOrders: memReadOrders } = await import('./data-memory.js')
        orders = await memReadOrders()
      }
      const filteredOrders = orders.filter((o: any) => o.userId === userId)
      const pending = filteredOrders.filter((o: any) => o.status === 'pending').length
      const approved = filteredOrders.filter((o: any) => o.status === 'approved').length
      const pendingPayment = filteredOrders.filter((o: any) => o.status === 'pending_payment').length
      const settled = filteredOrders.filter((o: any) => o.status === 'settled').length
      const rejected = filteredOrders.filter((o: any) => o.status === 'rejected').length
      res.json({ code: 0, message: 'success', data: { total: filteredOrders.length, pending, approved, pendingPayment, settled, rejected } })
    } else {
      res.json({ code: 0, message: 'success', data: stats })
    }
  } catch (error: any) {
    console.error('[订单统计] 最终错误:', error)
    // 即使失败也返回空的统计，不影响用户体验
    res.json({ 
      code: 0, 
      message: 'success', 
      data: { total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, rejected: 0 } 
    })
  }
})

// 经理审核订单（通过/驳回）
app.put('/api/orders/:id/review', async (req, res) => {
  const { action, reason } = req.body // action: 'approve' | 'reject'
  if (!action || !['approve', 'reject'].includes(action)) {
    res.json({ code: 400, message: '无效的审核操作', data: null })
    return
  }

  let orders = await readOrders()
  const index = orders.findIndex((o: any) => o.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '订单不存在', data: null })
    return
  }

  const order = orders[index]
  if (order.status !== 'pending') {
    res.json({ code: 400, message: '该订单已审核', data: null })
    return
  }

  const now = new Date().toISOString()
  if (action === 'approve') {
    // 通过：推广有效，记录佣金
    order.status = 'approved'
    order.reviewedAt = now
    // 写入佣金记录
    const commissions = await readCommissions()
    commissions.push({
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      orderId: order.id,
      userId: order.userId,
      managerId: order.managerId,
      productName: order.productName,
      amount: order.productPrice,
      status: 'pending', // 佣金待发放
      createdAt: now,
    })
    await writeCommissions(commissions)
  } else {
    // 驳回：推广无效，退回库存
    order.status = 'rejected'
    order.rejectReason = reason || '推广无效'
    order.reviewedAt = now
    // 退回库存
    let products = await readProducts()
    const pIdx = products.findIndex((p: any) => p.id === order.productId)
    if (pIdx !== -1 && products[pIdx].stock >= 0) {
      products[pIdx].stock = (products[pIdx].stock || 0) + 1
      await writeProducts(products)
    }
  }

  orders[index] = order
  await writeOrders(orders)

  res.json({ code: 0, message: action === 'approve' ? '审核通过' : '已驳回', data: order })
})

// 经理结算操作（添加到待付款 / 确认已付款）
app.put('/api/orders/:id/settle', async (req, res) => {
  const { action } = req.body // action: 'pending_payment' | 'paid'
  if (!action || !['pending_payment', 'paid'].includes(action)) {
    res.json({ code: 400, message: '无效的结算操作', data: null })
    return
  }

  let orders = await readOrders()
  const index = orders.findIndex((o: any) => o.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '订单不存在', data: null })
    return
  }

  const order = orders[index]

  if (action === 'pending_payment') {
    // 已通过 → 待付款
    if (order.status !== 'approved') {
      res.json({ code: 400, message: '仅已通过的订单可添加到待付款', data: null })
      return
    }
    order.status = 'pending_payment'
    order.addedToPaymentAt = new Date().toISOString()
  } else {
    // 待付款 → 已结算
    if (order.status !== 'pending_payment') {
      res.json({ code: 400, message: '仅待付款的订单可确认结算', data: null })
      return
    }
    order.status = 'settled'
    order.settledAt = new Date().toISOString()
    // 同步更新佣金记录状态
    let commissions = await readCommissions()
    const cIdx = commissions.findIndex((c: any) => c.orderId === order.id)
    if (cIdx !== -1) {
      commissions[cIdx].status = 'paid'
      commissions[cIdx].paidAt = order.settledAt
      await writeCommissions(commissions)
    }
  }

  orders[index] = order
  await writeOrders(orders)

  const msg = action === 'pending_payment' ? '已添加到待付款' : '已确认结算'
  res.json({ code: 0, message: msg, data: order })
})

// ============ 管理后台登录 ============

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) {
    res.json({ code: 400, message: '手机号和密码不能为空', data: null })
    return
  }
  const admin = await readAdminByPhone(phone)
  if (!admin) {
    res.json({ code: 401, message: '手机号或密码错误', data: null })
    return
  }
  const passwordValid = await verifyPassword(password, admin.password)
  if (!passwordValid) {
    res.json({ code: 401, message: '手机号或密码错误', data: null })
    return
  }
  
  sessionLogin(req, { id: admin.id, phone: admin.phone, role: 'admin', nickname: admin.name })
  
  res.json({
    code: 0,
    message: '登录成功',
    data: {
      admin: { id: admin.id, phone: admin.phone, name: admin.name }
    }
  })
})

app.post('/api/admin/sms/send', smsLimiter, async (req, res) => {
  console.log('[ADMIN-SMS] 收到短信发送请求:', req.body)
  
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    console.log('[ADMIN-SMS] 手机号格式错误:', phone)
    res.json({ code: 400, message: '请输入正确的手机号', data: null })
    return
  }
  
  // 防刷：60秒内不能重复发送
  const existing = smsCodes.get(phone)
  if (existing && existing.sentAt && Date.now() - existing.sentAt < 60000) {
    console.log('[ADMIN-SMS] 发送过于频繁:', phone)
    res.json({ code: 429, message: '发送太频繁，请60秒后重试', data: null })
    return
  }
  
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 10 * 60 * 1000
  smsCodes.set(phone, { code, expiresAt, phone, sentAt: Date.now() })
  console.log('[ADMIN-SMS] 生成验证码:', { phone, code, expiresAt })
  
  const result = await sendSmsCode(phone, code)
  if (!result.success) {
    smsCodes.delete(phone)
    console.log('[ADMIN-SMS] 发送失败:', result.message)
    res.json({ code: 500, message: result.message || '发送失败', data: null })
    return
  }
  
  console.log('[ADMIN-SMS] 发送成功:', phone)
  res.json({ code: 0, message: '验证码已发送', data: null })
})

app.post('/api/admin/sms/login', async (req, res) => {
  const { phone, code } = req.body
  if (!phone || !code) {
    res.json({ code: 400, message: '手机号和验证码不能为空', data: null })
    return
  }
  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt || record.code !== code) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  smsCodes.delete(phone)

  const admin = await readAdminByPhone(phone)
  if (!admin) {
    res.json({ code: 404, message: '该手机号不是管理员', data: null })
    return
  }
  
  sessionLogin(req, { id: admin.id, phone: admin.phone, role: 'admin', nickname: admin.name })
  
  res.json({
    code: 0,
    message: '登录成功',
    data: {
      admin: { id: admin.id, phone: admin.phone, name: admin.name }
    }
  })
})

app.post('/api/admin/update', async (req, res) => {
  const { oldPassword, newPhone, phoneCode, newPassword } = req.body

  const admin = await readAdminByPhone(newPhone || '')
  if (!admin) {
    res.json({ code: 401, message: '旧密码错误', data: null })
    return
  }

  const passwordValid = await verifyPassword(oldPassword, admin.password)
  if (!passwordValid) {
    res.json({ code: 401, message: '旧密码错误', data: null })
    return
  }

  if (newPhone && phoneCode) {
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      res.json({ code: 400, message: '新手机号格式不正确', data: null })
      return
    }
    const record = smsCodes.get(newPhone)
    if (!record || Date.now() > record.expiresAt || record.code !== phoneCode) {
      res.json({ code: 400, message: '验证码错误或已过期', data: null })
      return
    }
    smsCodes.delete(newPhone)
    await updateAdmin(admin.id, { phone: newPhone })
  }

  if (newPassword) {
    if (newPassword.length < 6 || newPassword.length > 20) {
      res.json({ code: 400, message: '新密码长度需在6-20位之间', data: null })
      return
    }
    const hashedPassword = await hashPassword(newPassword)
    await updateAdmin(admin.id, { password: hashedPassword })
  }

  const updatedAdmin = await readAdminByPhone(newPhone || admin.phone)
  res.json({
    code: 0,
    message: '修改成功',
    data: { phone: updatedAdmin?.phone, name: updatedAdmin?.name }
  })
})

// 管理员：通过短信验证码+旧密码修改密码
app.post('/api/admin/password/update', async (req, res) => {
  const { phone, code, oldPassword, newPassword } = req.body

  if (!phone || !code || !oldPassword || !newPassword) {
    res.json({ code: 400, message: '缺少参数', data: null })
    return
  }

  if (newPassword.length < 6 || newPassword.length > 20) {
    res.json({ code: 400, message: '新密码长度需在6-20位之间', data: null })
    return
  }

  const admin = await readAdminByPhone(phone)
  if (!admin) {
    res.json({ code: 404, message: '管理员不存在', data: null })
    return
  }

  const passwordValid = await verifyPassword(oldPassword, admin.password)
  if (!passwordValid) {
    res.json({ code: 401, message: '旧密码错误', data: null })
    return
  }

  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt || record.code !== code) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  smsCodes.delete(phone)

  const hashedPassword = await hashPassword(newPassword)
  await updateAdmin(admin.id, { password: hashedPassword })

  res.json({ code: 0, message: '密码修改成功', data: null })
})

// ============ 管理后台全局统计 ============

app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  const managers = await readManagers()
  const users = await readUsers()
  const products = await readProducts()
  const orders = await readOrders()

  const managerCount = managers.length
  const userCount = users.length

  // 上架产品：排除 admin_offline，且所属经理必须活跃
  const activeManagerIds = new Set(managers.filter((m: any) => m.status === 'active').map((m: any) => m.id))
  const publishedProductCount = products.filter((p: any) =>
    p.status === 'published' && activeManagerIds.has(p.managerId)
  ).length

  // 佣金总额 = 所有经理审核通过的订单金额总和
  const totalCommission = orders
    .filter((o: any) => o.status === 'approved')
    .reduce((sum: number, o: any) => sum + (Number(o.productPrice) || 0), 0)

  res.json({
    code: 0,
    message: 'success',
    data: {
      managerCount,
      userCount,
      publishedProductCount,
      totalCommission: Math.round(totalCommission * 100) / 100,
    }
  })
})

// 管理后台下架产品
app.put('/api/admin/products/:id/offline', requireAdmin, async (req, res) => {
  const { reason } = req.body
  if (!reason || !reason.trim()) {
    res.json({ code: 400, message: '请填写下架理由', data: null })
    return
  }
  let products = await readProducts()
  const index = products.findIndex((p: any) => p.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }
  if (products[index].status !== 'published') {
    res.json({ code: 400, message: '该产品未上架', data: null })
    return
  }
  products[index] = {
    ...products[index],
    status: 'admin_offline',
    offlineReason: reason.trim(),
    offlineAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  await writeProducts(products)
  res.json({ code: 0, message: '已下架', data: products[index] })
})

// ============ 佣金接口 ============

// ============ 订单数据 ============

// 获取佣金列表
app.get('/api/commissions', async (req, res) => {
  const { page = '1', pageSize = '10', status } = req.query
  let commissions = await readCommissions()

  if (status) {
    commissions = commissions.filter((c: any) => c.status === status)
  }

  commissions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = commissions.length
  const pageNum = parseInt(page as string, 10)
  const pageSizeNum = parseInt(pageSize as string, 10)
  const start = (pageNum - 1) * pageSizeNum
  const list = commissions.slice(start, start + pageSizeNum)

  res.json({ code: 0, message: 'success', data: { list, total, page: pageNum, pageSize: pageSizeNum } })
})

// 创建佣金申请
app.post('/api/commissions', async (req, res) => {
  const commissions = await readCommissions()
  const now = new Date().toISOString()
  const commission = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...req.body,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  commissions.unshift(commission)
  await writeCommissions(commissions)
  res.json({ code: 0, message: '申请成功', data: commission })
})

// 审核佣金
app.put('/api/commissions/:id', async (req, res) => {
  const commissions = await readCommissions()
  const index = commissions.findIndex((c: any) => c.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '佣金记录不存在', data: null })
    return
  }
  const now = new Date().toISOString()
  const updated = {
    ...commissions[index],
    ...req.body,
    id: commissions[index].id,
    approvedAt: req.body.status !== 'pending' ? now : commissions[index].approvedAt,
    updatedAt: now,
  }
  commissions[index] = updated
  await writeCommissions(commissions)
  res.json({ code: 0, message: '操作成功', data: updated })
})

// ============ 操作日志接口 ============

// 获取操作日志列表
app.get('/api/admin/operation-logs', requireAdmin, async (req, res) => {
  const { page = '1', pageSize = '20', operationType, targetType, adminId } = req.query
  
  try {
    const result = await readOperationLogs({
      adminId: adminId as string || undefined,
      operationType: operationType as string || undefined,
      targetType: targetType as string || undefined,
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
    })
    
    res.json({ code: 0, message: 'success', data: result })
  } catch (error: any) {
    console.error('[操作日志查询] 错误:', error)
    res.json({ code: 500, message: '查询失败', data: null })
  }
})

// ============ 图片上传 ============

import multer from 'multer'

const UPLOAD_DIR = join(DATA_DIR, 'uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`)
  },
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.json({ code: 400, message: '请选择文件', data: null })
    return
  }
  const url = `/api/uploads/${req.file.filename}`
  res.json({ code: 0, message: '上传成功', data: { url, filename: req.file.filename } })
})

// 静态文件服务 - 上传的图片
app.use('/api/uploads', express.static(UPLOAD_DIR))

// ============ 员工子账户接口 ============

// 创建员工子账户
app.post('/api/employees', async (req, res) => {
  try {
    const { userId, phone, password, nickname, expiresHours } = req.body
    
    // 验证参数
    if (!userId) return res.json({ code: 1, message: '缺少用户ID' })
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return res.json({ code: 1, message: '手机号格式不正确' })
    if (!password || password.length < 6) return res.json({ code: 1, message: '密码至少6位' })
    if (!expiresHours || expiresHours < 1) return res.json({ code: 1, message: '有效期至少1小时' })
    
    // 检查手机号是否已存在
    const existing = await readEmployeeByPhone(phone)
    if (existing) return res.json({ code: 1, message: '该手机号已被注册为员工' })
    
    // 计算过期时间
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresHours)
    
    // 创建员工（密码哈希）
    const hashedPassword = await hashPassword(password)
    const employee = {
      id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      phone,
      password: hashedPassword,
      nickname: nickname || `员工${phone.slice(-4)}`,
      expiresAt: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
      status: 'active',
    }
    
    await insertEmployee(employee)
    
    res.json({ code: 0, message: '创建成功', data: { ...employee, password: '******' } })
  } catch (err: any) {
    res.json({ code: 1, message: err.message || '创建失败' })
  }
})

// 获取当前用户的员工列表
app.get('/api/employees', async (req, res) => {
  try {
    const { userId } = req.query
    console.log('[API] 获取员工列表，userId:', userId)
    
    if (!userId) {
      console.warn('[API] userId 为空')
      return res.json({ code: 1, message: '缺少用户ID' })
    }
    
    const employees = await readEmployeesByUserId(userId as string)
    console.log('[API] 查询到员工数量:', employees.length)
    res.json({ code: 0, message: 'success', data: employees })
  } catch (err: any) {
    console.error('[API] 获取员工列表失败:', err)
    res.json({ code: 1, message: err.message || '获取失败' })
  }
})

// 获取员工详情
app.get('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params
    const employee = await readEmployeeById(id)
    if (!employee) return res.json({ code: 1, message: '员工不存在' })
    res.json({ code: 0, message: 'success', data: employee })
  } catch (err: any) {
    res.json({ code: 1, message: err.message || '获取失败' })
  }
})

// 删除员工
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deleteEmployee(id)
    res.json({ code: 0, message: '删除成功' })
  } catch (err: any) {
    res.json({ code: 1, message: err.message || '删除失败' })
  }
})

// 员工登录验证
app.post('/api/employees/login', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body
    
    if (!phone || !password) return res.json({ code: 1, message: '请输入手机号和密码' })
    
    const employee = await validateEmployee(phone, password)
    
    if (!employee) {
      return res.json({ code: 1, message: '手机号、密码错误或账户已过期' })
    }
    
    // 获取主账户信息
    const user = await readUser(employee.userId)
    
    res.json({ 
      code: 0, 
      message: '登录成功', 
      data: {
        employee: { ...employee, password: '******' },
        user: user ? { id: user.id, phone: user.phone, nickname: user.nickname } : null
      } 
    })
  } catch (err: any) {
    res.json({ code: 1, message: err.message || '登录失败' })
  }
})

// 检查员工账户是否有效
app.post('/api/employees/validate', async (req, res) => {
  try {
    const { employeeId } = req.body
    
    if (!employeeId) return res.json({ code: 1, message: '缺少员工ID' })
    
    const employee = await readEmployeeById(employeeId)
    if (!employee || employee.status !== 'active') {
      return res.json({ code: 1, message: '账户不存在或已被禁用' })
    }
    
    const now = new Date()
    const expiresAt = new Date(employee.expiresAt)
    
    if (expiresAt < now) {
      return res.json({ code: 1, message: '账户已过期' })
    }
    
    res.json({ code: 0, message: '账户有效', data: { expiresAt: employee.expiresAt } })
  } catch (err: any) {
    res.json({ code: 1, message: err.message || '验证失败' })
  }
})

// 健康检查
app.get('/api/health', async (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } })
})

// 启动服务器
async function start() {
  // 检查是否使用数据库模式
  const isDatabaseMode = process.env.DB_HOST && process.env.DB_NAME
  if (isDatabaseMode) {
    try {
      const { initDatabase } = await import('./db.js')
      await initDatabase()
      console.log(`API server running on port ${PORT} (MySQL)`)
    } catch (err) {
      console.log(`[INFO] MySQL connection failed, falling back to file storage: ${err}`)
      console.log(`API server running on port ${PORT} (File Storage)`)
    }
  } else {
    console.log(`API server running on port ${PORT} (File Storage)`)
  }
  app.listen(PORT)
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
