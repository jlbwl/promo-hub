/**
 * 批量上传海报自动识别 E2E：新建产品 → 批量添加 → 上传多张海报 → 自动生成选项行
 * 验证真实浏览器内的完整识别链路（jsQR 二维码解码 + tesseract.js 中文 OCR）
 * 仅针对本地 e2e 环境（promo_hub_e2e 库 + 本地 dev server）；只操作表单、不保存产品，零数据副作用
 * 运行：pnpm test:e2e:full
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 线上冒烟配置（playwright.config.ts，testDir 相同）也会默认匹配 *.spec.ts；
// 本用例涉及登录与表单操作，仅允许在本地 full 配置下执行
test.skip(process.env.PROMO_E2E_FULL_FLOW !== '1', '仅通过 pnpm test:e2e:full（本地 e2e 专用配置）运行')

// 经理端是独立 vite dev server（apps/manager，端口 3002，base /manager/）
const MANAGER_BASE = 'http://localhost:3002'
const POSTERS_DIR = join(__dirname, 'fixtures', 'posters')

const E2E = {
  managerPhone: '13900000001',
  managerPassword: 'e2ePass123',
}

// fixture 海报：顶部彩底白字券商名横幅 + 右下角二维码（与真实海报样式一致）
const POSTERS = [
  { file: 'shouchuang.png', broker: '首创证券', url: 'https://example.com/e2e/shouchuang' },
  { file: 'guoxin.png', broker: '国新证券', url: 'https://example.com/e2e/guoxin' },
  { file: 'xinda.png', broker: '信达证券', url: 'https://example.com/e2e/xinda' },
]

// OCR 首次运行需加载 wasm 引擎与中文语言包，放宽超时
test.setTimeout(240_000)

// 断言登录态：localStorage 出现对应 token（与前端实际存储 key 一致）
async function expectLoggedIn(page: Page, storageKey: string): Promise<void> {
  await expect
    .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), storageKey), { timeout: 20_000 })
    .toBeTruthy()
}

/** 经理端登录并进入新建产品页（先预取 CSRF cookie：后端为双提交校验） */
async function loginManagerAndOpenCreate(page: Page): Promise<void> {
  await page.request.get('/api/products?page=1&pageSize=1')
  await page.goto(`${MANAGER_BASE}/manager/login`)
  const mgrForm = page.locator('.login-form', { has: page.locator('input[placeholder="请输入密码"]') })
  await mgrForm.locator('input[placeholder="请输入手机号"]').fill(E2E.managerPhone)
  await mgrForm.locator('input[placeholder="请输入密码"]').fill(E2E.managerPassword)
  await mgrForm.locator('button.login-btn').click()
  await expectLoggedIn(page, 'manager_token')

  await page.goto(`${MANAGER_BASE}/manager/products/create`)
  await page.getByRole('button', { name: '批量添加' }).click()
  // 冷启动时 vite dev 按需编译较慢，放宽弹窗出现断言
  await expect(page.locator('.el-dialog__title')).toHaveText('批量添加：上传海报自动识别', { timeout: 30_000 })
}

/** 在弹窗内批量上传（Playwright 不允许路径与 buffer 混用，统一读为 buffer + mimeType） */
async function uploadInDialog(page: Page, entries: Array<{ name: string; mimeType?: string; buffer?: Buffer } | string>): Promise<void> {
  const files = entries.map((e) => {
    if (typeof e === 'string') {
      return { name: e.split('/').pop() ?? e, mimeType: 'image/png', buffer: readFileSync(e) }
    }
    return { mimeType: 'image/png', ...e }
  })
  await page.locator('.el-dialog input[type="file"]').setInputFiles(files)
}

test('上传多张海报自动识别：每张图恰好一行，券商名与链接一一对应', async ({ page }) => {
  test.info().annotations.push({ type: 'description', description: '批量上传 3 张券商海报，验证识别列表、生成行数与内容精确匹配' })
  await loginManagerAndOpenCreate(page)

  // 一次选择 3 张海报，识别列表立即出现且数量一致
  await uploadInDialog(page, POSTERS.map(p => join(POSTERS_DIR, p.file)))
  const items = page.locator('.poster-item')
  await expect(items).toHaveCount(3)
  await expect(page.locator('.poster-list-header')).toContainText('识别列表')

  // 每张海报识别完成：券商名与二维码链接精确匹配，状态标签为「完成」
  for (const [i, p] of POSTERS.entries()) {
    const item = items.nth(i)
    await expect(item).toContainText(p.broker, { timeout: 180_000 })
    await expect(item).toContainText(p.url)
    await expect(item.locator('.el-tag')).toHaveText('完成')
  }
  await expect(page.getByText('识别列表（3/3）')).toBeVisible()

  // 弹窗实时填入下方选项表格：行数与图片数一致、顺序与上传顺序严格一致
  const rows = page.locator('.option-table tbody tr')
  await expect(rows).toHaveCount(3)
  for (const [i, p] of POSTERS.entries()) {
    await expect(rows.nth(i).locator('td').nth(0).locator('input')).toHaveValue(p.broker)
    await expect(rows.nth(i).locator('input[placeholder="输入跳转链接（不填则不跳转）"]')).toHaveValue(p.url)
  }

  // 生成的数据行允许手动二次修改核对
  const firstLabel = rows.nth(0).locator('td').nth(0).locator('input')
  await firstLabel.fill('手动修改的券商')
  await expect(firstLabel).toHaveValue('手动修改的券商')
})

test('识别失败的图片仍生成空行：行数与图片数保持 1:1 兜底', async ({ page }) => {
  await loginManagerAndOpenCreate(page)

  // 3 张正常海报 + 1 张损坏图片（伪 PNG 字节），损坏图放最后不影响前面行的对应关系
  await uploadInDialog(page, [
    ...POSTERS.map(p => join(POSTERS_DIR, p.file)),
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('this is not a valid png') },
  ])
  const items = page.locator('.poster-item')
  await expect(items).toHaveCount(4)

  // 损坏图片标记失败；其余三张正常完成
  const failedItem = page.locator('.poster-item', { hasText: 'broken.png' })
  await expect(failedItem.locator('.el-tag')).toHaveText('失败', { timeout: 180_000 })
  await expect(failedItem.locator('.poster-status.failed')).toContainText('识别失败')
  await expect(page.locator('.poster-item .el-tag', { hasText: '完成' })).toHaveCount(3)

  // 表格仍生成 4 行：3 行识别结果 + 1 行空数据（等待手动填写）
  const rows = page.locator('.option-table tbody tr')
  await expect(rows).toHaveCount(4)
  for (const [i, p] of POSTERS.entries()) {
    await expect(rows.nth(i).locator('td').nth(0).locator('input')).toHaveValue(p.broker)
    await expect(rows.nth(i).locator('input[placeholder="输入跳转链接（不填则不跳转）"]')).toHaveValue(p.url)
  }
  await expect(rows.nth(3).locator('td').nth(0).locator('input')).toHaveValue('')
  await expect(rows.nth(3).locator('input[placeholder="输入跳转链接（不填则不跳转）"]')).toHaveValue('')
})
