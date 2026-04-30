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

// 获取产品列表（用户端只看已发布的，经理端看自己的）
app.get('/api/products', (req, res) => {
  const { page = '1', pageSize = '10', category, status, managerId } = req.query
  let products = readProducts()

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

// 删除经理
app.delete('/api/managers/:id', (req, res) => {
  let managers = readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  managers.splice(index, 1)
  writeManagers(managers)
  res.json({ code: 0, message: '删除成功', data: null })
})

// 更新经理（启用/禁用、编辑佣金比例等）
app.put('/api/managers/:id', (req, res) => {
  const managers = readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    res.json({ code: 404, message: '经理不存在', data: null })
    return
  }
  const now = new Date().toISOString()
  managers[index] = { ...managers[index], ...req.body, id: managers[index].id, updatedAt: now }
  writeManagers(managers)
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
