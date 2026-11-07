import type { Knex } from 'knex'

/**
 * operation_logs 查询索引：支撑「目标类型 + 时间」「操作人 + 时间」的列表筛选与导出分页。
 * 仅新增二级索引，不改变表结构与数据。
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('operation_logs', (table) => {
    table.index(['targetType', 'createdAt'], 'idx_targetType_createdAt')
    table.index(['adminId', 'createdAt'], 'idx_adminId_createdAt')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('operation_logs', (table) => {
    table.dropIndex(['targetType', 'createdAt'], 'idx_targetType_createdAt')
    table.dropIndex(['adminId', 'createdAt'], 'idx_adminId_createdAt')
  })
}
