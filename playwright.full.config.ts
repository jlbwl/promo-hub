/**
 * Playwright 本地主链路 e2e 配置：用户登录 → 做单 → 经理审核（零生产风险）
 * - 只连本地 MySQL 3306 的 promo_hub_e2e 库（env 覆盖 apps/api/.env 的 3307 隧道配置）
 * - 与线上冒烟配置 playwright.config.ts 完全独立，互不影响
 * 运行：pnpm test:e2e:full
 */
import { defineConfig } from '@playwright/test'

// 环境标记：full-flow.spec.ts 据此跳过（线上冒烟配置 playwright.config.ts 未设置该标记）
process.env.PROMO_E2E_FULL_FLOW = '1'

// API 服务启动即建连数据库，必须先建库再起服务（env 覆盖 .env，dotenv 不覆盖已有环境变量）
const e2eDbEnv: Record<string, string> = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'promo_hub_e2e',
}

// process.env 值类型为 string | undefined，webServer.env 需要纯 string 值
const inheritedEnv: Record<string, string> = {}
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) inheritedEnv[key] = value
}

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/smoke.spec.ts',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  globalSetup: './scripts/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3003',
    headless: true,
    actionTimeout: 15_000,
  },
  projects: [{ name: 'full-flow', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'pnpm --filter @promo/api dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...inheritedEnv, ...e2eDbEnv },
    },
    {
      command: 'pnpm --filter @promo/user dev',
      url: 'http://localhost:3003/user/',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @promo/manager dev',
      url: 'http://localhost:3002/manager/',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
