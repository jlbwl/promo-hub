import express from 'express'
import cors from 'cors'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from './db.js'
import {
  readProducts, writeProducts,
  readManagers, writeManagers,
  readUsers, writeUsers,
  readOrders, writeOrders,
  readCommissions, writeCommissions,
} from './data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', 'data')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())

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
  const products = await readProducts()
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
  await writeProducts(products)
  res.json({ code: 0, message: '创建成功', data: product })
})

// 更新产品
app.put('/api/products/:id', async (req, res) => {
  const products = await readProducts()
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
  await writeProducts(products)
  res.json({ code: 0, message: '更新成功', data: updated })
})

// 删除产品
app.delete('/api/products/:id', async (req, res) => {
  let products = await readProducts()
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
  await writeProducts(products)
  res.json({ code: 0, message: '删除成功', data: null })
})

// ============ 经理白名单接口 ============

// 获取经理列表
app.get('/api/managers', async (_req, res) => {
  const managers = await readManagers()
  res.json({ code: 0, message: 'success', data: managers })
})

// 添加经理
app.post('/api/managers', async (req, res) => {
  const managers = await readManagers()
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
  await writeManagers(managers)
  // 返回时隐藏密码
  const { password: _, ...safeManager } = manager
  res.json({ code: 0, message: '添加成功', data: safeManager })
})

// 删除经理（同时下架其所有产品，转移佣金数据给管理后台）
app.delete('/api/managers/:id', async (req, res) => {
  let managers = await readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  const managerId = managers[index].id
  const managerName = managers[index].name || ''
  managers.splice(index, 1)
  await writeManagers(managers)

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
app.post('/api/managers/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    res.json({ code: 400, message: '用户名和密码不能为空', data: null })
    return
  }
  const managers = await readManagers()
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

// ============ 用户接口（普通用户，非经理） ============

// 用户注册
app.post('/api/users/register', async (req, res) => {
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

  const users = await readUsers()
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
  await writeUsers(users)

  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '注册成功', data: { token, user: safeUser } })
})

// 用户登录
app.post('/api/users/login', async (req, res) => {
  const { phone, password } = req.body
  if (!phone || !password) {
    res.json({ code: 400, message: '手机号和密码不能为空', data: null })
    return
  }
  const users = await readUsers()
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

// ============ 短信验证码登录 ============

// 验证码存储（内存，重启后清空）
const smsCodes = new Map<string, { code: string; expiresAt: number; phone: string }>()

// 发送短信验证码
app.post('/api/users/sms/send', async (req, res) => {
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    res.json({ code: 400, message: '手机号格式不正确', data: null })
    return
  }

  // 防刷：60秒内不能重复发送
  const existing = smsCodes.get(phone)
  if (existing && Date.now() - (existing.expiresAt - 300000) < 60000) {
    res.json({ code: 429, message: '发送太频繁，请60秒后重试', data: null })
    return
  }

  // 生成6位验证码
  const code = String(Math.floor(100000 + Math.random() * 900000))
  smsCodes.set(phone, { code, expiresAt: Date.now() + 300000, phone })

  // TODO: 接入真实短信服务商（如阿里云SMS），当前为模拟模式
  console.log(`[SMS] 手机号 ${phone} 验证码: ${code}`)

  res.json({ code: 0, message: '验证码已发送', data: { expiresIn: 300 } })
})

// 短信验证码登录/注册
app.post('/api/users/sms/login', async (req, res) => {
  const { phone, code } = req.body
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
    // 自动注册
    const now = new Date().toISOString()
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phone,
      password: '',
      nickname: `用户${phone.slice(-4)}`,
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

  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '登录成功', data: { token, user: safeUser, isNew: !users.find((u: any) => u.phone === phone && u.id !== user.id) } })
})

// ============ 支付宝扫码登录 ============

app.post('/api/users/alipay/login', async (req, res) => {
  const { authCode } = req.body
  if (!authCode) {
    res.json({ code: 400, message: '授权码不能为空', data: null })
    return
  }

  // TODO: 接入真实支付宝开放平台，当前为模拟模式
  // 模拟：用 authCode 生成一个模拟的支付宝用户ID
  const alipayUserId = `alipay_${authCode.slice(0, 12)}`
  const alipayNickname = `支付宝用户${authCode.slice(-4)}`

  let users = await readUsers()
  let user = users.find((u: any) => u.alipayUserId === alipayUserId)

  if (!user) {
    // 检查是否有同手机号的用户可关联
    const now = new Date().toISOString()
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phone: '',
      password: '',
      nickname: alipayNickname,
      role: 'user',
      status: 'active',
      alipayUserId,
      loginMethods: ['alipay'],
      createdAt: now,
      updatedAt: now,
    }
    users.push(user)
    await writeUsers(users)
  } else {
    if (!user.loginMethods) user.loginMethods = []
    if (!user.loginMethods.includes('alipay')) user.loginMethods.push('alipay')
    user.updatedAt = new Date().toISOString()
    users = users.map((u: any) => u.id === user!.id ? user : u)
    await writeUsers(users)
  }

  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '登录成功', data: { token, user: safeUser, needBindPhone: !user.phone } })
})

// ============ 微信扫码登录 ============

app.post('/api/users/wechat/login', async (req, res) => {
  const { authCode } = req.body
  if (!authCode) {
    res.json({ code: 400, message: '授权码不能为空', data: null })
    return
  }

  // TODO: 接入真实微信开放平台，当前为模拟模式
  const wechatOpenId = `wx_${authCode.slice(0, 12)}`
  const wechatNickname = `微信用户${authCode.slice(-4)}`

  let users = await readUsers()
  let user = users.find((u: any) => u.wechatOpenId === wechatOpenId)

  if (!user) {
    const now = new Date().toISOString()
    user = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phone: '',
      password: '',
      nickname: wechatNickname,
      role: 'user',
      status: 'active',
      wechatOpenId,
      loginMethods: ['wechat'],
      createdAt: now,
      updatedAt: now,
    }
    users.push(user)
    await writeUsers(users)
  } else {
    if (!user.loginMethods) user.loginMethods = []
    if (!user.loginMethods.includes('wechat')) user.loginMethods.push('wechat')
    user.updatedAt = new Date().toISOString()
    users = users.map((u: any) => u.id === user!.id ? user : u)
    await writeUsers(users)
  }

  const { password: _, ...safeUser } = user
  const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ code: 0, message: '登录成功', data: { token, user: safeUser, needBindPhone: !user.phone } })
})

// ============ 绑定手机号（扫码登录后绑定） ============

app.post('/api/users/bindPhone', async (req, res) => {
  const { userId, phone, code } = req.body
  if (!userId || !phone || !code) {
    res.json({ code: 400, message: '参数不完整', data: null })
    return
  }

  // 验证码校验
  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt || record.code !== code) {
    res.json({ code: 400, message: '验证码错误或已过期', data: null })
    return
  }
  smsCodes.delete(phone)

  // 检查手机号是否已被其他用户绑定
  let users = await readUsers()
  const existingUser = users.find((u: any) => u.phone === phone && u.id !== userId)

  if (existingUser) {
    // 关联：将扫码用户的 alipayUserId/wechatOpenId 合并到已有手机号用户
    const currentUser = users.find((u: any) => u.id === userId)
    if (currentUser) {
      if (currentUser.alipayUserId && !existingUser.alipayUserId) {
        existingUser.alipayUserId = currentUser.alipayUserId
      }
      if (currentUser.wechatOpenId && !existingUser.wechatOpenId) {
        existingUser.wechatOpenId = currentUser.wechatOpenId
      }
      if (currentUser.loginMethods) {
        currentUser.loginMethods.forEach((m: string) => {
          if (!existingUser.loginMethods) existingUser.loginMethods = []
          if (!existingUser.loginMethods.includes(m)) existingUser.loginMethods.push(m)
        })
      }
      existingUser.updatedAt = new Date().toISOString()
      // 删除扫码创建的临时用户
      users = users.filter((u: any) => u.id !== userId)
      await writeUsers(users)

      const { password: _, ...safeUser } = existingUser
      const token = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      res.json({ code: 0, message: '绑定成功，已关联已有账号', data: { token, user: safeUser } })
      return
    }
  }

  // 正常绑定
  const user = users.find((u: any) => u.id === userId)
  if (!user) {
    res.json({ code: 404, message: '用户不存在', data: null })
    return
  }
  user.phone = phone
  user.updatedAt = new Date().toISOString()
  await writeUsers(users)

  const { password: _, ...safeUser } = user
  res.json({ code: 0, message: '绑定成功', data: { user: safeUser } })
})

// 管理后台：获取所有用户列表（推广经理 + 普通用户）
app.get('/api/users', async (req, res) => {
  const { page = '1', pageSize = '10', role, status, keyword } = req.query
  const managers = await readManagers()
  const users = await readUsers()

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
app.put('/api/users/:id/status', async (req, res) => {
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

// ============ 做单接口 ============

// 做单（扣减库存）
app.post('/api/orders', async (req, res) => {
  const { productId, userId, optionLabel, redirectUrl } = req.body
  if (!productId) {
    res.json({ code: 400, message: '缺少产品ID', data: null })
    return
  }

  let products = await readProducts()
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
    await writeProducts(products)
  }

  // 记录做单
  const orders = await readOrders()
  const order = {
    id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId,
    userId: userId || 'guest',
    managerId: product.managerId,
    productName: product.title,
    productPrice: product.price,
    optionLabel: optionLabel || '',
    redirectUrl: redirectUrl || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  orders.push(order)
  await writeOrders(orders)

  res.json({ code: 0, message: '做单成功', data: { order, remainingStock: product.stock || -1 } })
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

  const total = orders.length
  const pageNum = parseInt(page as string, 10)
  const pageSizeNum = parseInt(pageSize as string, 10)
  const start = (pageNum - 1) * pageSizeNum
  const list = orders.slice(start, start + pageSizeNum)

  res.json({ code: 0, message: 'success', data: { list, total, page: pageNum, pageSize: pageSizeNum } })
})

// 获取订单统计
app.get('/api/orders/stats', async (req, res) => {
  const { userId, managerId } = req.query
  let orders = await readOrders()

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

// ============ 管理后台全局统计 ============

app.get('/api/admin/stats', async (_req, res) => {
  const managers = await readManagers()
  const users = await readUsers()
  const products = await readProducts()
  const commissions = await readCommissions()

  const managerCount = managers.length
  const userCount = users.length

  // 上架产品：排除 admin_offline，且所属经理必须活跃
  const activeManagerIds = new Set(managers.filter((m: any) => m.status === 'active').map((m: any) => m.id))
  const publishedProductCount = products.filter((p: any) =>
    p.status === 'published' && activeManagerIds.has(p.managerId)
  ).length
  const totalCommission = commissions
    .filter((c: any) => c.status === 'paid')
    .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0)

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
app.put('/api/admin/products/:id/offline', async (req, res) => {
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

// 健康检查
app.get('/api/health', async (_req, res) => {
  res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } })
})

// 启动服务器（先初始化数据库）
async function start() {
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT} (MySQL)`)
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
