import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import type { CartItem, Commission, Employee, Manager, Order, OrderStats, Product, ProductCategory, User } from '@promo/shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// 密码验证函数
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

// ============ 内存行类型（与 DB 版数据层结构保持一致） ============

// 文件存储中订单的 deleted 使用 0/1 标记，deletedAt 可能为 null
// employeeId/sharerId 为订单表实际存在但 shared Order 类型未覆盖的字段
// （导出供 DB 版数据层 data/*.ts 复用，import type 不产生运行时耦合）
export type OrderRow = Omit<Order, 'deleted' | 'deletedAt'> & {
  employeeId?: string
  sharerId?: string
  deleted?: number | boolean
  deletedAt?: string | null
}

export interface AdminRow {
  id: string
  phone: string
  password: string
  name: string
  status: string
  [key: string]: unknown
}

export interface OperationLogRow {
  id: string
  adminId: string
  adminPhone: string
  adminName: string
  operationType: string
  targetType: string
  targetId: string
  targetName: string
  reason?: string
  detail?: string
  createdAt: string
}

// 通用读写函数
function readFileData<T>(filename: string): T[] {
  const filepath = join(DATA_DIR, `${filename}.json`)
  if (!fs.existsSync(filepath)) {
    return []
  }
  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(content) as T[]
  } catch {
    return []
  }
}

function writeFileData(filename: string, data: unknown[]): void {
  const filepath = join(DATA_DIR, `${filename}.json`)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

// 模拟数据库查询（用于兼容原有代码）
export async function queryOne(sql: string, params?: unknown[]): Promise<Product | null> {
  // 简单实现：根据SQL判断查询类型
  if (sql.includes('products') && sql.includes('title')) {
    const products = readFileData<Product>('products')
    return products.find((p) => p.title === params?.[0]) || null
  }
  return null
}

// ============ Users ============

export async function readUsers(): Promise<User[]> {
  return readFileData<User>('users')
}

export async function writeUsers(users: User[]): Promise<void> {
  writeFileData('users', users)
}

export async function readUser(id: string): Promise<User | null> {
  const users = await readUsers()
  return users.find((u) => u.id === id) || null
}

export async function insertUser(u: User): Promise<void> {
  const users = await readUsers()
  users.push(u)
  await writeUsers(users)
}

export async function updateUser(id: string, fields: Record<string, unknown>): Promise<void> {
  const users = await readUsers()
  const index = users.findIndex((u) => u.id === id)
  if (index !== -1) {
    users[index] = { ...users[index], ...fields }
    await writeUsers(users)
  }
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readUsers()
  const filtered = users.filter((u) => u.id !== id)
  await writeUsers(filtered)
}

// ============ Orders ============

export async function readOrders(): Promise<OrderRow[]> {
  const orders = await readFileData<OrderRow>('orders')
  return orders.filter((o) => !o.deleted)
}

export async function writeOrders(orders: OrderRow[]): Promise<void> {
  writeFileData('orders', orders)
}

export async function readOrder(id: string): Promise<OrderRow | null> {
  const orders = await readFileData<OrderRow>('orders')
  return orders.find((o) => o.id === id && !o.deleted) || null
}

// 优化的订单统计
export async function getOrderStats(managerId?: string): Promise<OrderStats> {
  const orders = await readOrders()
  let filtered = orders
  if (managerId) {
    filtered = orders.filter((o) => o.managerId === managerId)
  }
  return {
    total: filtered.length,
    pending: filtered.filter((o) => o.status === 'pending').length,
    approved: filtered.filter((o) => o.status === 'approved').length,
    pendingPayment: filtered.filter((o) => o.status === 'pending_payment').length,
    settled: filtered.filter((o) => o.status === 'settled').length,
    rejected: filtered.filter((o) => o.status === 'rejected').length,
  }
}

export async function readDeletedOrders(userId?: string): Promise<OrderRow[]> {
  const orders = await readFileData<OrderRow>('orders')
  let filtered = orders.filter((o) => o.deleted)
  if (userId) {
    filtered = filtered.filter((o) => o.userId === userId)
  }
  return filtered.sort((a, b) => new Date(b.deletedAt as string).getTime() - new Date(a.deletedAt as string).getTime())
}

export async function insertOrder(o: OrderRow): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  orders.push(o)
  await writeOrders(orders)
}

export async function deleteOrder(id: string): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  const updated = orders.map((o) => {
    if (o.id === id) {
      return { ...o, deleted: 1, deletedAt: new Date().toISOString() }
    }
    return o
  })
  await writeOrders(updated)
}

export async function restoreOrder(id: string): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  const updated = orders.map((o) => {
    if (o.id === id) {
      return { ...o, deleted: 0, deletedAt: null }
    }
    return o
  })
  await writeOrders(updated)
}

export async function updateOrder(id: string, fields: Record<string, unknown>): Promise<void> {
  const orders = await readFileData<OrderRow>('orders')
  const updated = orders.map((o) => {
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
  /** 与 userId 之间为 OR 关系：用户端按本人手机号关联注册前的访客做单 */
  matchUserPhone?: string
  managerId?: string
  employeeId?: string
  status?: string
  managedBy?: string
  userPhone?: string
  teamName?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<{ list: OrderRow[]; total: number }> {
  let orders = await readOrders()

  if (params.userId && params.matchUserPhone) {
    orders = orders.filter((o) => o.userId === params.userId || o.userPhone === params.matchUserPhone)
  } else if (params.userId) {
    orders = orders.filter((o) => o.userId === params.userId)
  }
  if (params.userPhone) {
    orders = orders.filter((o) => o.userPhone === params.userPhone)
  }
  if (params.teamName) {
    orders = orders.filter((o) => o.teamName === params.teamName)
  }
  if (params.managerId) {
    orders = orders.filter((o) => o.managerId === params.managerId)
  }
  if (params.employeeId) {
    orders = orders.filter((o) => o.employeeId === params.employeeId)
  }
  if (params.status) {
    orders = orders.filter((o) => o.status === params.status)
  }
  if (params.managedBy) {
    orders = orders.filter((o) => o.managedBy === params.managedBy)
  }
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase()
    orders = orders.filter((o) =>
      (o.productName?.toLowerCase()?.includes(keyword)) ||
      (o.userName?.toLowerCase()?.includes(keyword)) ||
      (o.userPhone?.includes(keyword))
    )
  }

  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = orders.length
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
  const start = (page - 1) * pageSize
  const list = orders.slice(start, start + pageSize)

  const userIds = Array.from(new Set(list.map((o) => o.userId).filter(Boolean)))
  const usersMap = new Map<string, string | undefined>()
  if (userIds.length > 0) {
    const users = await readUsers()
    users.forEach((user) => {
      usersMap.set(user.id, user.teamName)
    })
  }

  return {
    list: list.map((order) => ({
      ...order,
      productPrice: Number(order.productPrice) || 0,
      teamName: order.teamName || usersMap.get(order.userId) || '',
    })),
    total,
  }
}

// ============ Cart ============

export async function readCartItems(userId: string): Promise<CartItem[]> {
  const cart = await readFileData<CartItem>('cart')
  return cart.filter((item) => item.userId === userId).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function readCartByManagerId(managerId: string): Promise<CartItem[]> {
  const cart = await readFileData<CartItem>('cart')
  return cart.filter((item) => item.managerId === managerId).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
}

export async function addToCart(item: Omit<CartItem, 'id' | 'addedAt'>): Promise<void> {
  const cart = await readFileData<CartItem>('cart')
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
  const cart = await readFileData<CartItem>('cart')
  const filtered = cart.filter((item) => item.id !== id)
  await writeFileData('cart', filtered)
}

export async function removeFromCartByProductId(userId: string, productId: string): Promise<void> {
  const cart = await readFileData<CartItem>('cart')
  const filtered = cart.filter((item) => !(item.userId === userId && item.productId === productId))
  await writeFileData('cart', filtered)
}

export async function isInCart(userId: string, productId: string): Promise<boolean> {
  const cart = await readFileData<CartItem>('cart')
  return cart.some((item) => item.userId === userId && item.productId === productId)
}

// ============ Products ============

export async function readProducts(): Promise<Product[]> {
  return readFileData<Product>('products')
}

export async function writeProducts(products: Product[]): Promise<void> {
  writeFileData('products', products)
}

export async function readProduct(id: string): Promise<Product | null> {
  const products = await readProducts()
  return products.find((p) => p.id === id) || null
}

export async function insertProduct(p: Product): Promise<void> {
  const products = await readProducts()
  products.push(p)
  await writeProducts(products)
}

export async function updateProduct(id: string, fields: Record<string, unknown>): Promise<void> {
  const products = await readProducts()
  const index = products.findIndex((p) => p.id === id)
  if (index !== -1) {
    products[index] = { ...products[index], ...fields }
    await writeProducts(products)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const products = await readProducts()
  const index = products.findIndex((p) => p.id === id)
  if (index !== -1) {
    products.splice(index, 1)
    await writeProducts(products)
  }
}

// ============ Managers ============

export async function readManagers(): Promise<Manager[]> {
  return readFileData<Manager>('managers')
}

export async function writeManagers(managers: Manager[]): Promise<void> {
  writeFileData('managers', managers)
}

export async function readManager(id: string): Promise<Manager | null> {
  const managers = await readManagers()
  return managers.find((m) => m.id === id) || null
}

export async function readManagerByPhone(phone: string): Promise<Manager | null> {
  const managers = await readManagers()
  return managers.find((m) => m.phone === phone) || null
}

export async function deleteManager(id: string): Promise<void> {
  const managers = await readManagers()
  const filtered = managers.filter((m) => m.id !== id)
  await writeManagers(filtered)
}

// ============ Admins ============

export async function readAdminByPhone(phone: string): Promise<AdminRow | null> {
  const admins = readFileData<AdminRow>('admins')
  return admins.find((a) => a.phone === phone && a.status === 'active') || null
}

export async function readAdminById(id: string): Promise<AdminRow | null> {
  const admins = readFileData<AdminRow>('admins')
  return admins.find((a) => a.id === id) || null
}

export async function updateAdmin(id: string, fields: Record<string, unknown>): Promise<void> {
  const admins = readFileData<AdminRow>('admins')
  const index = admins.findIndex((a) => a.id === id)
  if (index !== -1) {
    admins[index] = { ...admins[index], ...fields, updatedAt: new Date().toISOString() }
    writeFileData('admins', admins)
  }
}

// ============ Commissions ============

export async function readCommissions(): Promise<Commission[]> {
  return readFileData<Commission>('commissions')
}

export async function writeCommissions(commissions: Commission[]): Promise<void> {
  writeFileData('commissions', commissions)
}

// ============ Employees ============

export async function readEmployees(): Promise<Employee[]> {
  return readFileData<Employee>('employees')
}

export async function writeEmployees(employees: Employee[]): Promise<void> {
  writeFileData('employees', employees)
}

export async function readEmployeeById(id: string): Promise<Employee | null> {
  const employees = await readEmployees()
  return employees.find((e) => e.id === id) || null
}

export async function readEmployeeByPhone(phone: string): Promise<Employee | null> {
  const employees = await readEmployees()
  return employees.find((e) => e.phone === phone) || null
}

export async function readEmployeesByUserId(userId: string): Promise<Employee[]> {
  const employees = await readEmployees()
  return employees.filter((e) => e.userId === userId && e.status === 'active')
}

export async function deleteEmployee(id: string): Promise<void> {
  const employees = await readEmployees()
  const filtered = employees.filter((e) => e.id !== id)
  await writeEmployees(filtered)
}

export async function validateEmployee(phone: string, password: string): Promise<Employee | null> {
  const employees = await readEmployees()
  const employee = employees.find((e) => e.phone === phone && e.status === 'active')
  if (!employee) return null
  
  // 检查密码是否匹配
  const passwordValid = await verifyPassword(password, employee.password)
  if (!passwordValid) return null
  
  // 检查是否过期
  const now = new Date()
  const expiresAt = new Date(employee.expiresAt as string)
  if (expiresAt < now) return null
  
  return employee
}

export async function insertEmployee(employee: Employee): Promise<void> {
  const employees = await readEmployees()
  employees.push(employee)
  await writeEmployees(employees)
}

export async function updateEmployee(id: string, fields: Record<string, unknown>): Promise<void> {
  const employees = await readEmployees()
  const index = employees.findIndex((e) => e.id === id)
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
  const logs = await readFileData<OperationLogRow>('operation_logs')
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
}): Promise<{ list: OperationLogRow[]; total: number }> {
  let logs = await readFileData<OperationLogRow>('operation_logs')
  
  if (params?.adminId) {
    logs = logs.filter((log) => log.adminId === params.adminId)
  }
  if (params?.operationType) {
    logs = logs.filter((log) => log.operationType === params.operationType)
  }
  if (params?.targetType) {
    logs = logs.filter((log) => log.targetType === params.targetType)
  }
  
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  const total = logs.length
  const pageNum = params?.page || 1
  const pageSizeNum = params?.pageSize || 20
  const start = (pageNum - 1) * pageSizeNum
  const list = logs.slice(start, start + pageSizeNum)
  
  return { list, total }
}

// ============ Product Categories (产品分类) ============

export async function readCategories(includeArchived = false): Promise<ProductCategory[]> {
  let categories = readFileData<ProductCategory>('categories')
  if (!includeArchived) {
    categories = categories.filter((c) => c.status === 'active')
  }
  categories.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
  return categories
}

export async function readCategoryById(id: string): Promise<ProductCategory | null> {
  const categories = readFileData<ProductCategory>('categories')
  return categories.find((c) => c.id === id) || null
}

export async function createCategory(name: string, value: string, sort?: number): Promise<ProductCategory> {
  const categories = readFileData<ProductCategory>('categories')
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const category: ProductCategory = {
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

export async function updateCategory(id: string, data: Partial<{ name: string; sort: number; status: 'active' | 'archived' }>): Promise<ProductCategory | null> {
  const categories = readFileData<ProductCategory>('categories')
  const index = categories.findIndex((c) => c.id === id)
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
  const categories = readFileData<ProductCategory>('categories')
  const index = categories.findIndex((c) => c.id === id)
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
