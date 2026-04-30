import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
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

// 获取产品列表（用户端只看已发布的）
app.get('/api/products', (req, res) => {
  const { page = '1', pageSize = '10', category, status } = req.query
  let products = readProducts()

  // 按分类筛选
  if (category && category !== '0') {
    products = products.filter((p: any) => p.category === category)
  }

  // 按状态筛选（manager 端可传 status 参数）
  if (status) {
    products = products.filter((p: any) => p.status === status)
  } else {
    // 默认只返回已发布的产品
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
  products.splice(index, 1)
  writeProducts(products)
  res.json({ code: 0, message: '删除成功', data: null })
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
