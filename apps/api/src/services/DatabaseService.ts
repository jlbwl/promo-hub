import { injectable } from 'tsyringe'
import type { Product, Employee, Commission, Manager } from '@promo/shared'
import type { OrderRow } from '../data-memory.js'
import { readUsers, writeUsers, readProducts, writeProducts, readEmployees, writeEmployees, readOrders, writeOrders, readCommissions, writeCommissions, readManagers, writeManagers, type UserRow } from '../data/index.js'

/** data 层 EmployeeRecord 的等价行类型（data/employee.ts 未导出，此处保持一致） */
type EmployeeRecordRow = Omit<Employee, 'expiresAt'> & { expiresAt: string | null }

@injectable()
export class DatabaseService {
  async readUsers(): Promise<UserRow[]> {
    return await readUsers()
  }

  async writeUsers(users: UserRow[]): Promise<void> {
    return await writeUsers(users)
  }

  async readProducts(): Promise<Product[]> {
    return await readProducts()
  }

  async writeProducts(products: Product[]): Promise<void> {
    return await writeProducts(products)
  }

  async readEmployees(): Promise<EmployeeRecordRow[]> {
    return await readEmployees()
  }

  async writeEmployees(employees: Employee[]): Promise<void> {
    return await writeEmployees(employees)
  }

  async readOrders(): Promise<OrderRow[]> {
    return await readOrders()
  }

  async writeOrders(orders: OrderRow[]): Promise<void> {
    return await writeOrders(orders)
  }

  async readCommissions(): Promise<Commission[]> {
    return await readCommissions()
  }

  async writeCommissions(commissions: Commission[]): Promise<void> {
    return await writeCommissions(commissions)
  }

  async readManagers(): Promise<Manager[]> {
    return await readManagers()
  }

  async writeManagers(managers: Manager[]): Promise<void> {
    return await writeManagers(managers)
  }
}
