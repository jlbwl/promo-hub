import fs from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
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
