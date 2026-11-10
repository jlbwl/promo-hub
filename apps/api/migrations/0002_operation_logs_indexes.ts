import type { Knex } from 'knex'

/**
 * operation_logs 查询索引：支撑「目标类型 + 时间」「操作人 + 时间」的列表筛选与导出分页。
 * 仅新增二级索引，不改变表结构与数据。
 *
 * 幂等说明：MySQL 的 DDL 不是事务性的，迁移中途失败不会写入 knex_migrations，
 * 重试会把整段 up 重跑一遍，已建好的索引会报 `Duplicate key name`。
 * 因此每个索引建之前先查 information_schema.statistics 确认不存在（按索引名判断）。
 */
async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const rows = await knex('information_schema.statistics')
    .select('INDEX_NAME')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    .where({ TABLE_NAME: table, INDEX_NAME: indexName })
    .limit(1)
  return rows.length > 0
}

export async function up(knex: Knex): Promise<void> {
  if (!(await hasIndex(knex, 'operation_logs', 'idx_targetType_createdAt'))) {
    await knex.schema.alterTable('operation_logs', (table) => {
      table.index(['targetType', 'createdAt'], 'idx_targetType_createdAt')
    })
  }

  if (!(await hasIndex(knex, 'operation_logs', 'idx_adminId_createdAt'))) {
    await knex.schema.alterTable('operation_logs', (table) => {
      table.index(['adminId', 'createdAt'], 'idx_adminId_createdAt')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await hasIndex(knex, 'operation_logs', 'idx_adminId_createdAt')) {
    await knex.schema.alterTable('operation_logs', (table) => {
      table.dropIndex(['adminId', 'createdAt'], 'idx_adminId_createdAt')
    })
  }

  if (await hasIndex(knex, 'operation_logs', 'idx_targetType_createdAt')) {
    await knex.schema.alterTable('operation_logs', (table) => {
      table.dropIndex(['targetType', 'createdAt'], 'idx_targetType_createdAt')
    })
  }
}
