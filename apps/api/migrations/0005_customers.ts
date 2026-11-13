import type { Knex } from 'knex'

/**
 * 客户档案（客户预设 / 收款渠道档案）。
 *
 * 仅新增表与索引，不修改任何既有表：
 * - 群号简称（groupName）是业务唯一键，使用唯一索引兜住并发写入的重复；
 * - searchCount 保留源项目「使用次数」，用于默认排序；
 * - qrCodeUrl 仅保留字段位，源项目导出的「是否有收款码」不携带图片内容，导入时不会清空既有值。
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('customers')
  if (exists) return

  await knex.schema.createTable('customers', (table) => {
    table.string('id', 100).primary()
    table.string('groupName', 200).notNullable()
    table.string('contactName', 200).notNullable().defaultTo('')
    table.string('payMethod', 20).notNullable().defaultTo('alipay')
    table.string('cardNo', 500).notNullable().defaultTo('')
    table.string('qrCodeUrl', 1000).notNullable().defaultTo('')
    table.integer('searchCount').notNullable().defaultTo(0)
    table.string('status', 20).notNullable().defaultTo('active')
    table.string('source', 20).notNullable().defaultTo('manual')
    table.string('createdBy', 100).notNullable().defaultTo('')
    table.datetime('createdAt').notNullable().defaultTo(knex.fn.now())
    table.datetime('updatedAt').notNullable().defaultTo(knex.fn.now())

    table.unique(['groupName'], { indexName: 'uk_customers_groupName' })
    table.index(['payMethod'], 'idx_customers_payMethod')
    table.index(['status'], 'idx_customers_status')
    table.index(['searchCount'], 'idx_customers_searchCount')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customers')
}
