/**
 * 本地主链路 e2e —— Playwright globalSetup
 * Playwright 启动顺序：webServer（API 等）先于 globalSetup，因此此处不能无条件重建库
 *（否则会 DROP 掉已连接 e2e 库的 API 连接池）。幂等策略：
 * - e2e 库已含种子数据（npm script 已重建）→ 直接跳过；
 * - 否则（如直接运行 playwright test）→ spawn setup-db.ts + seed.ts。
 */
import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { join } from 'path'
import { pathToFileURL } from 'url'

const ROOT_DIR = join(__dirname, '..', '..')
const API_DIR = join(ROOT_DIR, 'apps', 'api')
const E2E_DB_NAME = 'promo_hub_e2e'

const apiRequire = createRequire(pathToFileURL(join(API_DIR, 'package.json')))

interface MinimalConnection {
  query: (sql: string) => Promise<[Array<Record<string, unknown>>, unknown]>
  end: () => Promise<unknown>
}

async function isE2eDatabaseSeeded(): Promise<boolean> {
  const mysql = apiRequire('mysql2/promise') as {
    createConnection: (options: Record<string, unknown>) => Promise<MinimalConnection>
  }
  const connection = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '' })
  try {
    const [schemas] = await connection.query(
      `SELECT COUNT(*) AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${E2E_DB_NAME}'`,
    )
    if (Number((schemas as Array<{ n?: number }>)[0]?.n ?? 0) === 0) return false
    const [seeded] = await connection.query(
      `SELECT COUNT(*) AS n FROM \`${E2E_DB_NAME}\`.\`managers\` WHERE id = 'e2e_manager'`,
    )
    return Number((seeded as Array<{ n?: number }>)[0]?.n ?? 0) > 0
  } finally {
    await connection.end()
  }
}

function runE2eScript(name: string): void {
  const result = spawnSync('pnpm', ['exec', 'tsx', join(ROOT_DIR, 'scripts', 'e2e', name)], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`e2e 脚本 ${name} 失败，退出码 ${result.status}`)
  }
}

export default async function globalSetup(): Promise<void> {
  if (await isE2eDatabaseSeeded()) {
    console.log('[e2e-global-setup] promo_hub_e2e 已就绪，跳过重建')
    return
  }
  console.log('[e2e-global-setup] 重建 promo_hub_e2e 并写入种子数据')
  runE2eScript('setup-db.ts')
  runE2eScript('seed.ts')
}
