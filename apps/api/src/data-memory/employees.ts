import bcrypt from 'bcryptjs'
import type { Employee } from '@promo/shared'
import { readFileData, writeFileData } from './_shared.js'

// ============ Employees ============

// 密码验证函数
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

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
