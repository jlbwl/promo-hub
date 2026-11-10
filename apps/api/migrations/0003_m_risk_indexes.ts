import type { Knex } from 'knex'

/**
 * M6/M8/M24：中风险审查补充索引。
 * - commissions.orderId 唯一索引：防止同一订单重复生成佣金
 * - commissions(managerId, status)：经理端佣金列表与统计
 * - products(managerId, status)：经理端/访客端商品筛选
 * - users(phone)：手机号登录与注册查重（同时作为唯一约束）
 * - operation_logs(createdAt)：仅按时间范围的列表/导出
 *
 * 仅新增索引，不改变表结构与数据；该迁移已于生产执行（batch 4）。
 *
 * 幂等说明：MySQL 的 DDL 不是事务性的，本文件有 5 个独立索引，中途失败不会写入 knex_migrations，
 * 重试会把整段 up 重跑一遍，已建好的索引会报 `Duplicate key name`。
 * 因此每个索引建之前先查 information_schema.statistics 确认不存在（按索引名判断，
 * 唯一索引同样出现在该视图中，NON_UNIQUE=0）。
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
  if (!(await hasIndex(knex, 'commissions', 'uniq_commissions_orderId'))) {
    await knex.schema.alterTable('commissions', (table) => {
      table.unique(['orderId'], { indexName: 'uniq_commissions_orderId' })
    })
  }

  if (!(await hasIndex(knex, 'commissions', 'idx_commissions_managerId_status'))) {
    await knex.schema.alterTable('commissions', (table) => {
      table.index(['managerId', 'status'], 'idx_commissions_managerId_status')
    })
  }

  if (!(await hasIndex(knex, 'products', 'idx_products_managerId_status'))) {
    await knex.schema.alterTable('products', (table) => {
      table.index(['managerId', 'status'], 'idx_products_managerId_status')
    })
  }

  if (!(await hasIndex(knex, 'users', 'uniq_users_phone'))) {
    await knex.schema.alterTable('users', (table) => {
      table.unique(['phone'], { indexName: 'uniq_users_phone' })
    })
  }

  if (!(await hasIndex(knex, 'operation_logs', 'idx_operation_logs_createdAt'))) {
    await knex.schema.alterTable('operation_logs', (table) => {
      table.index(['createdAt'], 'idx_operation_logs_createdAt')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await hasIndex(knex, 'operation_logs', 'idx_operation_logs_createdAt')) {
    await knex.schema.alterTable('operation_logs', (table) => {
      table.dropIndex(['createdAt'], 'idx_operation_logs_createdAt')
    })
  }

  if (await hasIndex(knex, 'users', 'uniq_users_phone')) {
    await knex.schema.alterTable('users', (table) => {
      table.dropIndex(['phone'], 'uniq_users_phone')
    })
  }

  if (await hasIndex(knex, 'products', 'idx_products_managerId_status')) {
    await knex.schema.alterTable('products', (table) => {
      table.dropIndex(['managerId', 'status'], 'idx_products_managerId_status')
    })
  }

  if (await hasIndex(knex, 'commissions', 'idx_commissions_managerId_status')) {
    await knex.schema.alterTable('commissions', (table) => {
      table.dropIndex(['managerId', 'status'], 'idx_commissions_managerId_status')
    })
  }

  if (await hasIndex(knex, 'commissions', 'uniq_commissions_orderId')) {
    await knex.schema.alterTable('commissions', (table) => {
      table.dropIndex(['orderId'], 'uniq_commissions_orderId')
    })
  }
}
