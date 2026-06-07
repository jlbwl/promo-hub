import { injectable } from 'tsyringe'
import { readUsers, writeUsers, readProducts, writeProducts, readEmployees, writeEmployees, readOrders, writeOrders, readCommissions, writeCommissions } from '../data.js'

@injectable()
export class DatabaseService {
  async readUsers(): Promise<any[]> {
    return await readUsers()
  }

  async writeUsers(users: any[]): Promise<void> {
    return await writeUsers(users)
  }

  async readProducts(): Promise<any[]> {
    return await readProducts()
  }

  async writeProducts(products: any[]): Promise<void> {
    return await writeProducts(products)
  }

  async readEmployees(): Promise<any[]> {
    return await readEmployees()
  }

  async writeEmployees(employees: any[]): Promise<void> {
    return await writeEmployees(employees)
  }

  async readOrders(): Promise<any[]> {
    return await readOrders()
  }

  async writeOrders(orders: any[]): Promise<void> {
    return await writeOrders(orders)
  }

  async readCommissions(): Promise<any[]> {
    return await readCommissions()
  }

  async writeCommissions(commissions: any[]): Promise<void> {
    return await writeCommissions(commissions)
  }
}
