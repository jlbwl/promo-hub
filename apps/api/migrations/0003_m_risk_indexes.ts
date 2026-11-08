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
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('commissions', (table) => {
    table.unique(['orderId'], { indexName: 'uniq_commissions_orderId' })
    table.index(['managerId', 'status'], 'idx_commissions_managerId_status')
  })

  await knex.schema.alterTable('products', (table) => {
    table.index(['managerId', 'status'], 'idx_products_managerId_status')
  })

  await knex.schema.alterTable('users', (table) => {
    table.unique(['phone'], { indexName: 'uniq_users_phone' })
  })

  await knex.schema.alterTable('operation_logs', (table) => {
    table.index(['createdAt'], 'idx_operation_logs_createdAt')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('operation_logs', (table) => {
    table.dropIndex(['createdAt'], 'idx_operation_logs_createdAt')
  })

  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['phone'], 'uniq_users_phone')
  })

  await knex.schema.alterTable('products', (table) => {
    table.dropIndex(['managerId', 'status'], 'idx_products_managerId_status')
  })

  await knex.schema.alterTable('commissions', (table) => {
    table.dropIndex(['managerId', 'status'], 'idx_commissions_managerId_status')
    table.dropIndex(['orderId'], 'uniq_commissions_orderId')
  })
}
