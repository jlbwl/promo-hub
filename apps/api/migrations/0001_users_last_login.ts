import type { Knex } from 'knex'

// users 表新增最近登录时间：登录成功时由数据库 NOW() 写入，旧用户为 NULL（前端展示"从未登录"）
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasColumn('users', 'lastLoginAt')
  if (!exists) {
    await knex.schema.alterTable('users', (table) => {
      table.datetime('lastLoginAt').nullable().after('createdAt')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasColumn('users', 'lastLoginAt')
  if (exists) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('lastLoginAt')
    })
  }
}
