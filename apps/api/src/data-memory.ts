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

// ============ Orders ============

export async function readOrders(): Promise<any[]> {
  return readFileData('orders')
}

export async function writeOrders(orders: any[]): Promise<void> {
  writeFileData('orders', orders)
}

export async function readOrder(id: string): Promise<any> {
  const orders = await readOrders()
  return orders.find((o: any) => o.id === id) || null
}

export async function insertOrder(o: any): Promise<void> {
  const orders = await readOrders()
  orders.push(o)
  await writeOrders(orders)
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
