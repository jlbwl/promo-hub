/**
 * 本地主链路 e2e —— 数据库初始化（每次运行重建，只作用于 promo_hub_e2e，零生产风险）
 * 步骤：root@127.0.0.1:3306 免密连接 → 重建 e2e 库 → spawn knex migrate:latest
 * 运行：pnpm exec tsx scripts/e2e/setup-db.ts
 */
import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { join } from 'path'
import { pathToFileURL } from 'url'

const ROOT_DIR = join(__dirname, '..', '..')
const API_DIR = join(ROOT_DIR, 'apps', 'api')
const E2E_DB_NAME = 'promo_hub_e2e'

// mysql2 等依赖仅安装在 apps/api，从 apps/api 包锚点解析（根目录不可见）
const apiRequire = createRequire(pathToFileURL(join(API_DIR, 'package.json')))

// 覆盖 apps/api/.env（指向 3307 线上隧道库），dotenv 不会覆盖已有 shell 环境变量
const DB_ENV: Record<string, string> = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: E2E_DB_NAME,
}

interface MinimalConnection {
  query: (sql: string) => Promise<unknown>
  end: () => Promise<unknown>
}

export async function rebuildE2eDatabase(): Promise<void> {
  const mysql = apiRequire('mysql2/promise') as {
    createConnection: (options: Record<string, unknown>) => Promise<MinimalConnection>
  }
  const connection = await mysql.createConnection({
    host: DB_ENV.DB_HOST,
    port: Number(DB_ENV.DB_PORT),
    user: DB_ENV.DB_USER,
    password: DB_ENV.DB_PASSWORD,
  })
  await connection.query(`DROP DATABASE IF EXISTS \`${E2E_DB_NAME}\``)
  await connection.query(`CREATE DATABASE \`${E2E_DB_NAME}\` CHARACTER SET utf8mb4`)
  await connection.end()

  const knexBin = join(API_DIR, 'node_modules', '.bin', 'knex')
  const result = spawnSync(knexBin, ['migrate:latest'], {
    cwd: API_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...DB_ENV },
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`knex migrate:latest 失败，退出码 ${result.status}`)
  }
}

if (require.main === module) {
  rebuildE2eDatabase()
    .then(() => console.log('[e2e-setup-db] promo_hub_e2e 重建并迁移完成'))
    .catch((error) => {
      console.error('[e2e-setup-db]', error)
      process.exit(1)
    })
}
