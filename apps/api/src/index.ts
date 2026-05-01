import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 数据目录放在项目根目录下（不在 dist 内），避免部署时被覆盖
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')
const DATA_FILE = join(DATA_DIR, 'products.json')

// 确保数据目录存在
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// 初始化数据文件
if (!existsSync(DATA_FILE)) {
  writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8')
}

// 读写数据的工具函数
function readProducts() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
}

function writeProducts(data: unknown[]) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())

// ============ 产品接口 ============

// 获取产品列表（用户端只看已发布的且经理在白名单中的，经理端看自己的）
app.get('/api/products', (req, res) => {
  const { page = '1', pageSize = '10', category, status, managerId } = req.query
  let products = readProducts()

  // 用户端：过滤掉经理不在白名单或已被禁用的产品
  if (!managerId) {
    const managers = readManagers()
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

  res.json({
    code: 0,
    message: 'success',
    data: { list, total, page: pageNum, pageSize: pageSizeNum },
  })
})

// 经理仪表盘统计
app.get('/api/stats/dashboard', (req, res) => {
  const managerId = req.query.managerId as string
  const products = readProducts()
  const commissions = readCommissions()

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
app.get('/api/products/:id', (req, res) => {
  const products = readProducts()
  const product = products.find((p: any) => p.id === req.params.id)
  if (!product) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }
  res.json({ code: 0, message: 'success', data: product })
})

// 创建产品
app.post('/api/products', (req, res) => {
  const products = readProducts()
  const title = (req.body.title || '').trim()

  if (!title) {
    res.json({ code: 400, message: '产品标题不能为空', data: null })
    return
  }

  // 标题重复校验
  const duplicate = products.find((p: any) => p.title === title)
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
  products.unshift(product)
  writeProducts(products)
  res.json({ code: 0, message: '创建成功', data: product })
})

// 更新产品
app.put('/api/products/:id', (req, res) => {
  const products = readProducts()
  const index = products.findIndex((p: any) => p.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }

  // 校验产品归属
  if (req.body.managerId && products[index].managerId !== req.body.managerId) {
    res.json({ code: 403, message: '无权操作此产品', data: null })
    return
  }

  const title = (req.body.title || '').trim()
  if (title) {
    // 标题重复校验（排除自身）
    const duplicate = products.find((p: any) => p.title === title && p.id !== req.params.id)
    if (duplicate) {
      res.json({ code: 409, message: '产品标题已存在，请修改后重新发布', data: null })
      return
    }
  }

  const now = new Date().toISOString()
  const updated = {
    ...products[index],
    ...req.body,
    id: products[index].id,
    publishedAt: req.body.status === 'published' && !products[index].publishedAt ? now : products[index].publishedAt,
    updatedAt: now,
  }
  products[index] = updated
  writeProducts(products)
  res.json({ code: 0, message: '更新成功', data: updated })
})

// 删除产品
app.delete('/api/products/:id', (req, res) => {
  let products = readProducts()
  const index = products.findIndex((p: any) => p.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }

  // 校验产品归属
  const managerId = req.query.managerId as string
  if (managerId && products[index].managerId !== managerId) {
    res.json({ code: 403, message: '无权操作此产品', data: null })
    return
  }

  products.splice(index, 1)
  writeProducts(products)
  res.json({ code: 0, message: '删除成功', data: null })
})

// ============ 经理白名单接口 ============

const MANAGER_FILE = join(DATA_DIR, 'managers.json')

if (!existsSync(MANAGER_FILE)) {
  writeFileSync(MANAGER_FILE, JSON.stringify([], null, 2), 'utf-8')
}

function readManagers() {
  return JSON.parse(readFileSync(MANAGER_FILE, 'utf-8'))
}

function writeManagers(data: unknown[]) {
  writeFileSync(MANAGER_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// 获取经理列表
app.get('/api/managers', (_req, res) => {
  const managers = readManagers()
  res.json({ code: 0, message: 'success', data: managers })
})

// 添加经理
app.post('/api/managers', (req, res) => {
  const managers = readManagers()
  const { username, password, name, phone } = req.body

  if (!username || !password) {
    res.json({ code: 400, message: '用户名和密码不能为空', data: null })
    return
  }

  // 用户名重复校验
  if (managers.find((m: any) => m.username === username)) {
    res.json({ code: 409, message: '用户名已存在', data: null })
    return
  }

  const now = new Date().toISOString()
  const manager = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    username,
    password,
    name: name || username,
    phone: phone || '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  managers.push(manager)
  writeManagers(managers)
  // 返回时隐藏密码
  const { password: _, ...safeManager } = manager
  res.json({ code: 0, message: '添加成功', data: safeManager })
})

// 删除经理（同时下架其所有产品）
app.delete('/api/managers/:id', (req, res) => {
  let managers = readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  const managerId = managers[index].id
  managers.splice(index, 1)
  writeManagers(managers)

  // 下架该经理的所有已发布产品
  let products = readProducts()
  let offlineCount = 0
  products = products.map((p: any) => {
    if (p.managerId === managerId && p.status === 'published') {
      offlineCount++
      return { ...p, status: 'offline', updatedAt: new Date().toISOString() }
    }
    return p
  })
  writeProducts(products)

  res.json({ code: 0, message: `删除成功，已下架 ${offlineCount} 个产品`, data: null })
})

// 更新经理（启用/禁用时联动产品状态）
app.put('/api/managers/:id', (req, res) => {
  const managers = readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  const now = new Date().toISOString()
  const newStatus = req.body.status
  managers[index] = { ...managers[index], ...req.body, id: managers[index].id, updatedAt: now }
  writeManagers(managers)

  // 禁用时下架产品，启用时不自动恢复（需经理手动操作）
  if (newStatus === 'disabled') {
    let products = readProducts()
    let offlineCount = 0
    products = products.map((p: any) => {
      if (p.managerId === req.params.id && p.status === 'published') {
        offlineCount++
        return { ...p, status: 'offline', updatedAt: now }
      }
      return p
    })
    writeProducts(products)
  }

  const { password: _, ...safeManager } = managers[index]
  res.json({ code: 0, message: '更新成功', data: safeManager })
})

// 经理登录校验
app.post('/api/managers/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.json({ code: 400, message: '用户名和密码不能为空', data: null })
    return
  }
  const managers = readManagers()
  const manager = managers.find(
    (m: any) => m.username === username && m.password === password && m.status === 'active'
  )
  if (!manager) {
    res.json({ code: 401, message: '用户名或密码错误，或账号已被禁用', data: null })
    return
  }
  const { password: _, ...safeManager } = manager
  const token = `mgr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '登录成功', data: { token, manager: safeManager } })
})

// ============ 用户接口（普通用户，非经理） ============

const USER_FILE = join(DATA_DIR, 'users.json')

if (!existsSync(USER_FILE)) {
  writeFileSync(USER_FILE, JSON.stringify([], null, 2), 'utf-8')
}

function readUsers() {
  return JSON.parse(readFileSync(USER_FILE, 'utf-8'))
}

function writeUsers(data: unknown[]) {
  writeFileSync(USER_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// 用户注册
app.post('/api/users/register', (req, res) => {
  const { phone, password, nickname } = req.body

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

  const users = readUsers()
  if (users.find((u: any) => u.phone === phone)) {
    res.json({ code: 409, message: '该手机号已注册', data: null })
    return
  }

  const now = new Date().toISOString()
  const user = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone,
    password,
    nickname: nickname || `用户${phone.slice(-4)}`,
    role: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  users.push(user)
  writeUsers(users)

  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '注册成功', data: { token, user: safeUser } })
})

// 用户登录
app.post('/api/users/login', (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) {
    res.json({ code: 400, message: '手机号和密码不能为空', data: null })
    return
  }
  const users = readUsers()
  const user = users.find(
    (u: any) => u.phone === phone && u.password === password && u.status === 'active'
  )
  if (!user) {
    res.json({ code: 401, message: '手机号或密码错误，或账号已被禁用', data: null })
    return
  }
  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '登录成功', data: { token, user: safeUser } })
})

// 管理后台：获取所有用户列表（推广经理 + 普通用户）
app.get('/api/users', (req, res) => {
  const { page = '1', pageSize = '10', role, status, keyword } = req.query
  const managers = readManagers()
  const users = readUsers()

  // 合并推广经理和普通用户
  const allUsers = [
    ...managers.map((m: any) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      role: 'manager',
      status: m.status === 'active' ? 1 : 0,
      createdAt: m.createdAt,
    })),
    ...users.map((u: any) => ({
      id: u.id,
      name: u.nickname,
      phone: u.phone,
      role: u.role,
      status: u.status === 'active' ? 1 : 0,
      createdAt: u.createdAt,
    })),
  ]

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
      (u: any) => (u.name || '').toLowerCase().includes(kw) || (u.phone || '').includes(kw)
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
app.put('/api/users/:id/status', (req, res) => {
  const { status } = req.body
  const userId = req.params.id

  // 先查经理表
  let managers = readManagers()
  const mgrIdx = managers.findIndex((m: any) => m.id === userId)
  if (mgrIdx !== -1) {
    managers[mgrIdx].status = status ? 'active' : 'disabled'
    managers[mgrIdx].updatedAt = new Date().toISOString()
    writeManagers(managers)
    // 联动下架产品
    if (!status) {
      let products = readProducts()
      products = products.map((p: any) =>
        p.managerId === userId && p.status === 'published'
          ? { ...p, status: 'offline', updatedAt: new Date().toISOString() }
          : p
      )
      writeProducts(products)
    }
    res.json({ code: 0, message: '更新成功', data: null })
    return
  }

  // 再查用户表
  let users = readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  if (usrIdx !== -1) {
    users[usrIdx].status = status ? 'active' : 'disabled'
    users[usrIdx].updatedAt = new Date().toISOString()
    writeUsers(users)
    res.json({ code: 0, message: '更新成功', data: null })
    return
  }

  res.json({ code: 404, message: '用户不存在', data: null })
})

// ============ 做单接口 ============

// 做单（扣减库存）
app.post('/api/orders', (req, res) => {
  const { productId, userId } = req.body
  if (!productId) {
    res.json({ code: 400, message: '缺少产品ID', data: null })
    return
  }

  let products = readProducts()
  const index = products.findIndex((p: any) => p.id === productId)
  if (index === -1) {
    res.json({ code: 404, message: '产品不存在', data: null })
    return
  }

  const product = products[index]

  // 检查产品状态
  if (product.status !== 'published') {
    res.json({ code: 400, message: '该产品已下架', data: null })
    return
  }

  // 检查库存（stock 为 0 或未设置表示不限库存）
  if (product.stock && product.stock > 0) {
    if (product.stock < 1) {
      res.json({ code: 400, message: '库存不足', data: null })
      return
    }
    product.stock -= 1
    products[index] = product
    writeProducts(products)
  }

  // 记录做单
  const orders = readOrders()
  const order = {
    id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId,
    userId: userId || 'guest',
    managerId: product.managerId,
    productName: product.title,
    productPrice: product.price,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  orders.push(order)
  writeOrders(orders)

  res.json({ code: 0, message: '做单成功', data: { order, remainingStock: product.stock || -1 } })
})

// 获取订单列表（用户端按 userId，经理端按 managerId）
app.get('/api/orders', (req, res) => {
  const { userId, managerId, status, page = '1', pageSize = '20' } = req.query
  let orders = readOrders()

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

  orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = orders.length
  const pageNum = parseInt(page as string, 10)
  const pageSizeNum = parseInt(pageSize as string, 10)
  const start = (pageNum - 1) * pageSizeNum
  const list = orders.slice(start, start + pageSizeNum)

  res.json({ code: 0, message: 'success', data: { list, total, page: pageNum, pageSize: pageSizeNum } })
})

// 获取订单统计
app.get('/api/orders/stats', (req, res) => {
  const { userId, managerId } = req.query
  let orders = readOrders()

  if (userId) orders = orders.filter((o: any) => o.userId === userId)
  if (managerId) orders = orders.filter((o: any) => o.managerId === managerId)

  const pending = orders.filter((o: any) => o.status === 'pending').length
  const approved = orders.filter((o: any) => o.status === 'approved').length
  const pendingPayment = orders.filter((o: any) => o.status === 'pending_payment').length
  const settled = orders.filter((o: any) => o.status === 'settled').length
  const rejected = orders.filter((o: any) => o.status === 'rejected').length

  res.json({ code: 0, message: 'success', data: { total: orders.length, pending, approved, pendingPayment, settled, rejected } })
})

// 经理审核订单（通过/驳回）
app.put('/api/orders/:id/review', (req, res) => {
  const { action, reason } = req.body // action: 'approve' | 'reject'
  if (!action || !['approve', 'reject'].includes(action)) {
    res.json({ code: 400, message: '无效的审核操作', data: null })
    return
  }

  let orders = readOrders()
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
    const commissions = readCommissions()
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
    writeCommissions(commissions)
  } else {
    // 驳回：推广无效，退回库存
    order.status = 'rejected'
    order.rejectReason = reason || '推广无效'
    order.reviewedAt = now
    // 退回库存
    let products = readProducts()
    const pIdx = products.findIndex((p: any) => p.id === order.productId)
    if (pIdx !== -1 && products[pIdx].stock >= 0) {
      products[pIdx].stock = (products[pIdx].stock || 0) + 1
      writeProducts(products)
    }
  }

  orders[index] = order
  writeOrders(orders)

  res.json({ code: 0, message: action === 'approve' ? '审核通过' : '已驳回', data: order })
})

// 经理结算操作（添加到待付款 / 确认已付款）
app.put('/api/orders/:id/settle', (req, res) => {
  const { action } = req.body // action: 'pending_payment' | 'paid'
  if (!action || !['pending_payment', 'paid'].includes(action)) {
    res.json({ code: 400, message: '无效的结算操作', data: null })
    return
  }

  let orders = readOrders()
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
    let commissions = readCommissions()
    const cIdx = commissions.findIndex((c: any) => c.orderId === order.id)
    if (cIdx !== -1) {
      commissions[cIdx].status = 'paid'
      commissions[cIdx].paidAt = order.settledAt
      writeCommissions(commissions)
    }
  }

  orders[index] = order
  writeOrders(orders)

  const msg = action === 'pending_payment' ? '已添加到待付款' : '已确认结算'
  res.json({ code: 0, message: msg, data: order })
})

// ============ 佣金接口 ============

const COMMISSION_FILE = join(DATA_DIR, 'commissions.json')

if (!existsSync(COMMISSION_FILE)) {
  writeFileSync(COMMISSION_FILE, JSON.stringify([], null, 2), 'utf-8')
}

function readCommissions() {
  return JSON.parse(readFileSync(COMMISSION_FILE, 'utf-8'))
}

function writeCommissions(data: unknown[]) {
  writeFileSync(COMMISSION_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// ============ 订单数据 ============

const ORDER_FILE = join(DATA_DIR, 'orders.json')

if (!existsSync(ORDER_FILE)) {
  writeFileSync(ORDER_FILE, JSON.stringify([], null, 2), 'utf-8')
}

function readOrders() {
  return JSON.parse(readFileSync(ORDER_FILE, 'utf-8'))
}

function writeOrders(data: unknown[]) {
  writeFileSync(ORDER_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// 获取佣金列表
app.get('/api/commissions', (req, res) => {
  const { page = '1', pageSize = '10', status } = req.query
  let commissions = readCommissions()

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
app.post('/api/commissions', (req, res) => {
  const commissions = readCommissions()
  const now = new Date().toISOString()
  const commission = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...req.body,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  commissions.unshift(commission)
  writeCommissions(commissions)
  res.json({ code: 0, message: '申请成功', data: commission })
})

// 审核佣金
app.put('/api/commissions/:id', (req, res) => {
  const commissions = readCommissions()
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
  writeCommissions(commissions)
  res.json({ code: 0, message: '操作成功', data: updated })
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

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.json({ code: 400, message: '请选择文件', data: null })
    return
  }
  const url = `/api/uploads/${req.file.filename}`
  res.json({ code: 0, message: '上传成功', data: { url, filename: req.file.filename } })
})

// 静态文件服务 - 上传的图片
app.use('/api/uploads', express.static(UPLOAD_DIR))

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } })
})

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`)
})
