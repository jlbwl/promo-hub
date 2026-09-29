/**
 * Playwright 冒烟配置：对线上环境做只读探测（不登录、不做单、零数据副作用）
 * 运行：pnpm test:e2e
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://www.jlbtg.cn',
    headless: true,
  },
  projects: [{ name: 'smoke', use: { browserName: 'chromium' } }],
})
