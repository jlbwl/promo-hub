import type { Knex } from 'knex'

/**
 * 「只看重单」服务端筛选的性能索引。
 * EXISTS 子查询按 userPhone + productId + status 关联同客户同产品的在流程订单，
 * 新增 (userPhone, productId, status) 复合索引以命中该关联条件。
 *
 * 仅新增索引，不改变表结构与数据；本文件仅入库，尚未执行。
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.index(['userPhone', 'productId', 'status'], 'idx_orders_userPhone_productId_status')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.dropIndex(['userPhone', 'productId', 'status'], 'idx_orders_userPhone_productId_status')
  })
}
