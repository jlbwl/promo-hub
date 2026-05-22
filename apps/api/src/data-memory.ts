import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 密码验证函数
async function verifyPassword(password: string, hash: string): Promise<boolean> {
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

// 通用读写函数
function readFileData(filename: string): any[] {
  const filepath = join(DATA_DIR, `${filename}.json`)
  if (!fs.existsSync(filepath)) {
    return []
  }
  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

function writeFileData(filename: string, data: any[]): void {
  const filepath = join(DATA_DIR, `${filename}.json`)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

// 模拟数据库查询（用于兼容原有代码）
export async function queryOne(sql: string, params?: any[]): Promise<any> {
  // 简单实现：根据SQL判断查询类型
  if (sql.includes('products') && sql.includes('title')) {
    const products = readFileData('products')
    return products.find((p: any) => p.title === params?.[0]) || null
  }
  return null
}

// ============ Users ============

export async function readUsers(): Promise<any[]> {
  return readFileData('users')
}

export async function writeUsers(users: any[]): Promise<void> {
  writeFileData('users', users)
}

export async function readUser(id: string): Promise<any> {
  const users = await readUsers()
  return users.find((u: any) => u.id === id) || null
}

export async function insertUser(u: any): Promise<void> {
  const users = await readUsers()
  users.push(u)
  await writeUsers(users)
}

export async function updateUser(id: string, fields: Record<string, any>): Promise<void> {
  const users = await readUsers()
  const index = users.findIndex((u: any) => u.id === id)
  if (index !== -1) {
    users[index] = { ...users[index], ...fields }
    await writeUsers(users)
  }
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readUsers()
  const filtered = users.filter((u: any) => u.id !== id)
  await writeUsers(filtered)
}

// ============ Orders ============

export async function readOrders(): Promise<any[]> {
  const orders = await readFileData('orders')
  return orders.filter((o: any) => !o.deleted)
}

export async function writeOrders(orders: any[]): Promise<void> {
  writeFileData('orders', orders)
}

export async function readOrder(id: string): Promise<any> {
  const orders = await readFileData('orders')
  return orders.find((o: any) => o.id === id && !o.deleted) || null
}

// 优化的订单统计
export async function getOrderStats(managerId?: string): Promise<any> {
  const orders = await readOrders()
  let filtered = orders
  if (managerId) {
    filtered = orders.filter((o: any) => o.managerId === managerId)
  }
  return {
    total: filtered.length,
    pending: filtered.filter((o: any) => o.status === 'pending').length,
    approved: filtered.filter((o: any) => o.status === 'approved').length,
    pendingPayment: filtered.filter((o: any) => o.status === 'pending_payment').length,
    settled: filtered.filter((o: any) => o.status === 'settled').length,
    rejected: filtered.filter((o: any) => o.status === 'rejected').length,
  }
}

export async function readDeletedOrders(userId?: string): Promise<any[]> {
  const orders = await readFileData('orders')
  let filtered = orders.filter((o: any) => o.deleted)
  if (userId) {
    filtered = filtered.filter((o: any) => o.userId === userId)
  }
  return filtered.sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
}

export async function insertOrder(o: any): Promise<void> {
  const orders = await readFileData('orders')
  orders.push(o)
  await writeOrders(orders)
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = await readFileData('orders')
  const updated = orders.map((o: any) => {
    if (o.id === id) {
      return { ...o, deleted: 1, deletedAt: new Date().toISOString() }
    }
    return o
  })
  await writeOrders(updated)
}

export async function restoreOrder(id: string): Promise<void> {
  const orders = await readFileData('orders')
  const updated = orders.map((o: any) => {
    if (o.id === id) {
      return { ...o, deleted: 0, deletedAt: null }
    }
    return o
  })
  await writeOrders(updated)
}

export async function updateOrder(id: string, fields: Record<string, any>): Promise<void> {
  const orders = await readFileData('orders')
  const updated = orders.map((o: any) => {
    if (o.id === id) {
      return { ...o, ...fields }
    }
    return o
  })
  await writeOrders(updated)
}

// ============ 优化的订单查询方法 ============

export async function getOrdersPaginated(params: {
  userId?: string
  managerId?: string
  status?: string
  managedBy?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<{ list: any[]; total: number }> {
  let orders = await readOrders()

  if (params.userId) {
    orders = orders.filter((o: any) => o.userId === params.userId)
  }
  if (params.managerId) {
    orders = orders.filter((o: any) => o.managerId === params.managerId)
  }
  if (params.status) {
    orders = orders.filter((o: any) => o.status === params.status)
  }
  if (params.managedBy) {
    orders = orders.filter((o: any) => o.managedBy === params.managedBy)
  }
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase()
    orders = orders.filter((o: any) =>
      (o.productName?.toLowerCase()?.includes(keyword)) ||
      (o.userName?.toLowerCase()?.includes(keyword)) ||
      (o.userPhone?.includes(keyword))
    )
  }

  orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = orders.length
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
  const start = (page - 1) * pageSize
  const list = orders.slice(start, start + pageSize)

  const userIds = Array.from(new Set(list.map((o: any) => o.userId).filter(Boolean)))
  const usersMap = new Map()
  if (userIds.length > 0) {
    const users = await readUsers()
    users.forEach((user: any) => {
      usersMap.set(user.id, user.teamName)
    })
  }

  return {
    list: list.map((order: any) => ({
      ...order,
      productPrice: Number(order.productPrice) || 0,
      teamName: order.teamName || usersMap.get(order.userId) || '',
    })),
    total,
  }
}

// ============ Cart ============

export async function readCartItems(userId: string): Promise<any[]> {
  const cart = await readFileData('cart')
  return cart.filter((item: any) => item.userId === userId).sort((a: any, b: any) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function readCartByManagerId(managerId: string): Promise<any[]> {
  const cart = await readFileData('cart')
  return cart.filter((item: any) => item.managerId === managerId).sort((a: any, b: any) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function addToCart(item: any): Promise<void> {
  const cart = await readFileData('cart')
  const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  cart.push({
    id,
    userId: item.userId,
    managerId: item.managerId || '',
    productId: item.productId,
    productName: item.productName || '',
    productPrice: item.productPrice || 0,
    coverImage: item.coverImage || '',
    optionLabel: item.optionLabel || '',
    redirectUrl: item.redirectUrl || '',
    addedAt: new Date().toISOString()
  })
  await writeFileData('cart', cart)
}

export async function removeFromCart(id: string): Promise<void> {
  const cart = await readFileData('cart')
  const filtered = cart.filter((item: any) => item.id !== id)
  await writeFileData('cart', filtered)
}

export async function removeFromCartByProductId(userId: string, productId: string): Promise<void> {
  const cart = await readFileData('cart')
  const filtered = cart.filter((item: any) => !(item.userId === userId && item.productId === productId))
  await writeFileData('cart', filtered)
}

export async function isInCart(userId: string, productId: string): Promise<boolean> {
  const cart = await readFileData('cart')
  return cart.some((item: any) => item.userId === userId && item.productId === productId)
}

// ============ Products ============

export async function readProducts(): Promise<any[]> {
  return readFileData('products')
}

export async function writeProducts(products: any[]): Promise<void> {
  writeFileData('products', products)
}

export async function readProduct(id: string): Promise<any> {
  const products = await readProducts()
  return products.find((p: any) => p.id === id) || null
}

export async function insertProduct(p: any): Promise<void> {
  const products = await readProducts()
  products.push(p)
  await writeProducts(products)
}

export async function updateProduct(id: string, fields: Record<string, any>): Promise<void> {
  const products = await readProducts()
  const index = products.findIndex((p: any) => p.id === id)
  if (index !== -1) {
    products[index] = { ...products[index], ...fields }
    await writeProducts(products)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await readProducts()
  const index = products.findIndex((p: any) => p.id === id)
  if (index !== -1) {
    products.splice(index, 1)
    await writeProducts(products)
  }
}

// ============ Managers ============

export async function readManagers(): Promise<any[]> {
  return readFileData('managers')
}

export async function writeManagers(managers: any[]): Promise<void> {
  writeFileData('managers', managers)
}

export async function readManager(id: string): Promise<any> {
  const managers = await readManagers()
  return managers.find((m: any) => m.id === id) || null
}

export async function readManagerByPhone(phone: string): Promise<any> {
  const managers = await readManagers()
  return managers.find((m: any) => m.phone === phone) || null
}

export async function deleteManager(id: string): Promise<void> {
  const managers = await readManagers()
  const filtered = managers.filter((m: any) => m.id !== id)
  await writeManagers(filtered)
}

// ============ Admins ============

export async function readAdminByPhone(phone: string): Promise<any> {
  const admins = readFileData('admins')
  return admins.find((a: any) => a.phone === phone && a.status === 'active') || null
}

export async function readAdminById(id: string): Promise<any> {
  const admins = readFileData('admins')
  return admins.find((a: any) => a.id === id) || null
}

export async function updateAdmin(id: string, fields: Record<string, any>): Promise<void> {
  const admins = readFileData('admins')
  const index = admins.findIndex((a: any) => a.id === id)
  if (index !== -1) {
    admins[index] = { ...admins[index], ...fields, updatedAt: new Date().toISOString() }
    writeFileData('admins', admins)
  }
}

// ============ Commissions ============

export async function readCommissions(): Promise<any[]> {
  return readFileData('commissions')
}

export async function writeCommissions(commissions: any[]): Promise<void> {
  writeFileData('commissions', commissions)
}

// ============ Employees ============

export async function readEmployees(): Promise<any[]> {
  return readFileData('employees')
}

export async function writeEmployees(employees: any[]): Promise<void> {
  writeFileData('employees', employees)
}

export async function readEmployeeById(id: string): Promise<any> {
  const employees = await readEmployees()
  return employees.find((e: any) => e.id === id) || null
}

export async function readEmployeeByPhone(phone: string): Promise<any> {
  const employees = await readEmployees()
  return employees.find((e: any) => e.phone === phone) || null
}

export async function readEmployeesByUserId(userId: string): Promise<any[]> {
  const employees = await readEmployees()
  return employees.filter((e: any) => e.userId === userId && e.status === 'active')
}

export async function deleteEmployee(id: string): Promise<void> {
  const employees = await readEmployees()
  const filtered = employees.filter((e: any) => e.id !== id)
  await writeEmployees(filtered)
}

export async function validateEmployee(phone: string, password: string): Promise<any> {
  const employees = await readEmployees()
  const employee = employees.find((e: any) => e.phone === phone && e.status === 'active')
  if (!employee) return null
  
  // 检查密码是否匹配
  const passwordValid = await verifyPassword(password, employee.password)
  if (!passwordValid) return null
  
  // 检查是否过期
  const now = new Date()
  const expiresAt = new Date(employee.expiresAt)
  if (expiresAt < now) return null
  
  return employee
}

export async function insertEmployee(employee: any): Promise<void> {
  const employees = await readEmployees()
  employees.push(employee)
  await writeEmployees(employees)
}

export async function updateEmployee(id: string, fields: Record<string, any>): Promise<void> {
  const employees = await readEmployees()
  const index = employees.findIndex((e: any) => e.id === id)
  if (index !== -1) {
    employees[index] = { ...employees[index], ...fields }
    await writeEmployees(employees)
  }
}

// ============ Operation Logs (操作日志) ============

export async function insertOperationLog(log: {
  adminId: string
  adminPhone: string
  adminName: string
  operationType: string
  targetType: string
  targetId: string
  targetName: string
  reason?: string
  detail?: string
}): Promise<void> {
  const logs = await readFileData('operation_logs')
  logs.push({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...log,
    createdAt: new Date().toISOString(),
  })
  await writeFileData('operation_logs', logs)
}

export async function readOperationLogs(params?: {
  adminId?: string
  operationType?: string
  targetType?: string
  page?: number
  pageSize?: number
}): Promise<{ list: any[]; total: number }> {
  let logs = await readFileData('operation_logs')
  
  if (params?.adminId) {
    logs = logs.filter((log: any) => log.adminId === params.adminId)
  }
  if (params?.operationType) {
    logs = logs.filter((log: any) => log.operationType === params.operationType)
  }
  if (params?.targetType) {
    logs = logs.filter((log: any) => log.targetType === params.targetType)
  }
  
  logs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  const total = logs.length
  const pageNum = params?.page || 1
  const pageSizeNum = params?.pageSize || 20
  const start = (pageNum - 1) * pageSizeNum
  const list = logs.slice(start, start + pageSizeNum)
  
  return { list, total }
}

// ============ Product Categories (产品分类) ============

export async function readCategories(includeArchived = false): Promise<any[]> {
  let categories = readFileData('categories')
  if (!includeArchived) {
    categories = categories.filter((c: any) => c.status === 'active')
  }
  categories.sort((a: any, b: any) => a.sort - b.sort || a.id.localeCompare(b.id))
  return categories
}

export async function readCategoryById(id: string): Promise<any> {
  const categories = readFileData('categories')
  return categories.find((c: any) => c.id === id) || null
}

export async function createCategory(name: string, value: string, sort?: number): Promise<any> {
  const categories = readFileData('categories')
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const category = {
    id,
    name,
    value,
    sort: sort || 0,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  categories.push(category)
  writeFileData('categories', categories)
  return category
}

export async function updateCategory(id: string, data: Partial<{ name: string; sort: number; status: 'active' | 'archived' }>): Promise<any | null> {
  const categories = readFileData('categories')
  const index = categories.findIndex((c: any) => c.id === id)
  if (index === -1) {
    return null
  }
  categories[index] = {
    ...categories[index],
    ...data,
    updatedAt: new Date().toISOString()
  }
  writeFileData('categories', categories)
  return categories[index]
}

export async function archiveCategory(id: string): Promise<boolean> {
  const categories = readFileData('categories')
  const index = categories.findIndex((c: any) => c.id === id)
  if (index === -1) {
    return false
  }
  categories[index] = {
    ...categories[index],
    status: 'archived',
    updatedAt: new Date().toISOString()
  }
  writeFileData('categories', categories)
  return true
}
