/**
 * 本地主链路 e2e —— 种子数据（幂等：先删固定 id 再插入，只作用于 promo_hub_e2e）
 * 列名来自 apps/api/migrations/0000_baseline.ts（camelCase 列名）；
 * 密码加密方式与 apps/api/src/utils/password.ts 一致（bcryptjs hash）。
 * 运行：pnpm exec tsx scripts/e2e/seed.ts
 */
import { createRequire } from 'module'
import { join } from 'path'
import { pathToFileURL } from 'url'

const ROOT_DIR = join(__dirname, '..', '..')
const API_DIR = join(ROOT_DIR, 'apps', 'api')
const E2E_DB_NAME = 'promo_hub_e2e'

const apiRequire = createRequire(pathToFileURL(join(API_DIR, 'package.json')))

export const E2E = {
  manager: { id: 'e2e_manager', phone: '13900000001', password: 'e2ePass123', name: 'E2E经理', teamName: 'E2E团队' },
  user: { id: 'e2e_user', phone: '13800000001', password: 'e2ePass123', nickname: 'E2E测试', teamName: 'E2E团队' },
  // stock=10（有库存限制）：主链路会命中 OrderService.createOrder 的扣库存分支
  // （该分支曾对 query() 返回的 ResultSetHeader 做数组解构导致 500，现已修复），
  // e2e 结束后库存应为 10-1=9，用于验证扣减生效
  product: { id: 'e2e_product', title: 'E2E测试产品', price: 1, stock: 10, optionLabel: '默认' },
} as const

interface MinimalConnection {
  query: (sql: string, values?: unknown[]) => Promise<unknown>
  end: () => Promise<unknown>
}

export async function seedE2eData(): Promise<void> {
  const mysql = apiRequire('mysql2/promise') as {
    createConnection: (options: Record<string, unknown>) => Promise<MinimalConnection>
  }
  const bcrypt = apiRequire('bcryptjs') as {
    hashSync: (password: string, salt: number) => string
  }

  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: E2E_DB_NAME,
  })

  const managerHash = bcrypt.hashSync(E2E.manager.password, 10)
  const userHash = bcrypt.hashSync(E2E.user.password, 10)
  const optionsJson = JSON.stringify([{ label: E2E.product.optionLabel, limit: 1 }])

  try {
    // 幂等清理：固定 id + 该产品历史订单
    await connection.query('DELETE FROM `managers` WHERE id = ?', [E2E.manager.id])
    await connection.query('DELETE FROM `users` WHERE id = ?', [E2E.user.id])
    await connection.query('DELETE FROM `products` WHERE id = ?', [E2E.product.id])
    await connection.query('DELETE FROM `orders` WHERE productId = ?', [E2E.product.id])

    await connection.query(
      'INSERT INTO `managers` (id, username, password, name, phone, teamName, status) VALUES (?, ?, ?, ?, ?, ?, \'active\')',
      [E2E.manager.id, E2E.manager.id, managerHash, E2E.manager.name, E2E.manager.phone, E2E.manager.teamName],
    )
    await connection.query(
      'INSERT INTO `users` (id, phone, password, nickname, teamName, role, status) VALUES (?, ?, ?, ?, ?, \'user\', \'active\')',
      [E2E.user.id, E2E.user.phone, userHash, E2E.user.nickname, E2E.user.teamName],
    )
    await connection.query(
      `INSERT INTO \`products\`
        (id, title, description, price, originalPrice, category, categoryId, categoryNameSnapshot,
         status, managerId, stock, options, publishedBy, requireName, requirePhone)
       VALUES (?, ?, ?, ?, 0, '', '', '', 'published', ?, ?, ?, 'e2e_manager', 1, 1)`,
      [
        E2E.product.id,
        E2E.product.title,
        'E2E 本地主链路测试产品',
        E2E.product.price,
        E2E.manager.id,
        E2E.product.stock,
        optionsJson,
      ],
    )
  } finally {
    await connection.end()
  }
}

if (require.main === module) {
  seedE2eData()
    .then(() => console.log('[e2e-seed] 种子数据写入完成（promo_hub_e2e）'))
    .catch((error) => {
      console.error('[e2e-seed]', error)
      process.exit(1)
    })
}
