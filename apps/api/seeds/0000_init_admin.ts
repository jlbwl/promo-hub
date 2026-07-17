import type { Knex } from 'knex'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function seed(knex: Knex): Promise<void> {
  const adminCount = await knex('admins').count('* as count').first()
  if ((adminCount as any).count === 0) {
    const adminPhone = process.env.ADMIN_PHONE
    const adminPassword = process.env.ADMIN_PASSWORD
    const adminName = process.env.ADMIN_NAME || '超级管理员'

    if (adminPhone && adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS)
      await knex('admins').insert({
        id: 'admin_1',
        phone: adminPhone,
        password: hashedPassword,
        name: adminName,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      console.log(`[DB] Default admin account created: ${adminPhone}`)
    } else {
      console.warn('[DB] ADMIN_PHONE and ADMIN_PASSWORD not set, skipping default admin creation')
      console.warn('[DB] Please set these environment variables and run: knex seed:run')
    }
  }
}
