import type { Knex } from 'knex'

/**
 * 「只看重单」服务端筛选的性能索引。
 * EXISTS 子查询按 userPhone + productId + status 关联同客户同产品的在流程订单，
 * 新增 (userPhone, productId, status) 复合索引以命中该关联条件。
 *
 * 仅新增索引，不改变表结构与数据；本文件仅入库，尚未执行。
 *
 * 幂等说明：MySQL 的 DDL 不是事务性的，迁移中途失败不会写入 knex_migrations，
 * 重试会重跑 up，已建好的索引会报 `Duplicate key name`。
 * 因此建索引前先查 information_schema.statistics 确认不存在（按索引名判断）。
 */
async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const rows = await knex('information_schema.statistics')
    .select('INDEX_NAME')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    .where({ TABLE_NAME: table, INDEX_NAME: indexName })
    .limit(1)
  return rows.length > 0
}

const INDEX_NAME = 'idx_orders_userPhone_productId_status'

export async function up(knex: Knex): Promise<void> {
  if (await hasIndex(knex, 'orders', INDEX_NAME)) {
    return
  }
  await knex.schema.alterTable('orders', (table) => {
    table.index(['userPhone', 'productId', 'status'], INDEX_NAME)
  })
}

export async function down(knex: Knex): Promise<void> {
  if (!(await hasIndex(knex, 'orders', INDEX_NAME))) {
    return
  }
  await knex.schema.alterTable('orders', (table) => {
    table.dropIndex(['userPhone', 'productId', 'status'], INDEX_NAME)
  })
}
