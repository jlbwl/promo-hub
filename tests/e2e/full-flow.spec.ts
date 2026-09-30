/**
 * 本地主链路 e2e：用户登录 → 做单 → 做单记录 → 经理审核通过
 * 仅针对本地 e2e 环境（promo_hub_e2e 库 + 本地三个 dev server），零生产风险
 * 运行：pnpm test:e2e:full
 */
import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

// 线上冒烟配置（playwright.config.ts，testDir 相同）也会默认匹配 *.spec.ts；
// 本文件涉及登录/做单/审核等写操作，仅允许在本地 full 配置下执行
test.skip(process.env.PROMO_E2E_FULL_FLOW !== '1', '仅通过 pnpm test:e2e:full（本地 e2e 专用配置）运行')

// 经理端是独立 vite dev server（apps/manager，端口 3002，base /manager/）
const MANAGER_BASE = 'http://localhost:3002'

const E2E = {
  userPhone: '13800000001',
  userPassword: 'e2ePass123',
  managerPhone: '13900000001',
  managerPassword: 'e2ePass123',
  productName: 'E2E测试产品',
  optionLabel: '默认',
  userName: 'E2E测试',
}

// 断言登录态：localStorage 出现对应 token（与前端实际存储 key 一致）
async function expectLoggedIn(page: Page, storageKey: string): Promise<void> {
  await expect
    .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), storageKey), { timeout: 20_000 })
    .toBeTruthy()
}

test('用户登录 → 做单 → 做单记录 → 经理审核通过', async ({ page }) => {
  // —— 0. 预取 CSRF cookie：后端为双提交校验（cookie + X-CSRF-Token 头），直接落登录页时无 cookie
  // 任一 GET API 响应都会 Set-Cookie csrfToken；cookie 属于 localhost 主机，两端 dev server 共享 ——
  await page.request.get('/api/products?page=1&pageSize=1')

  // —— 1. 用户端密码登录（登录页第一步先选「普通登录」）——
  await page.goto('/user/login')
  await page.getByText('普通登录', { exact: true }).click()
  await page.locator('.van-tab', { hasText: '密码登录' }).click()
  // vant 动画 tabs 两个面板同时挂载，用「密码输入框唯一」锁定密码登录面板
  const pwdGroup = page.locator('.van-cell-group', { has: page.locator('input[placeholder="请输入密码"]') })
  await pwdGroup.locator('input[placeholder="请输入手机号"]').fill(E2E.userPhone)
  await pwdGroup.locator('input[placeholder="请输入密码"]').fill(E2E.userPassword)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expectLoggedIn(page, 'user_token')
  await expect(page).toHaveURL(/\/user\/home$/)

  // —— 2. 产品大厅点入 E2E测试产品详情（登录成功后 SPA 已跳转 /user/home，无需再 goto）——
  const card = page.locator('.product-card', { hasText: E2E.productName }).first()
  await expect(card).toBeVisible()
  // 点标题而非整卡：卡片中心的收藏按钮带 @click.stop，会吞掉跳转
  await card.locator('.product-title').click()
  await expect(page).toHaveURL(/\/user\/product\/e2e_product$/)
  await expect(page.locator('h2.title')).toHaveText(E2E.productName)

  // —— 3. 选中「默认」选项 → 去做单 → 填写姓名/手机号 → 确认提交 ——
  await page.locator('.van-cell', { hasText: E2E.optionLabel }).first().click()
  await page.getByRole('button', { name: '去做单' }).click()
  await page.locator('input[placeholder="请输入姓名"]').fill(E2E.userName)
  await page.locator('input[placeholder="请输入手机号"]').fill(E2E.userPhone)
  await page.getByRole('button', { name: '确认提交并做单' }).click()
  await expect(page.locator('.van-toast', { hasText: '做单成功' })).toBeVisible()

  // —— 4. 做单记录可见（我的佣金 → 做单记录，状态待审核）——
  await page.goto('/user/commissions')
  const record = page.locator('.record-card', { hasText: E2E.productName }).first()
  await expect(record).toBeVisible()
  await expect(record).toContainText(`姓名：${E2E.userName}`)
  await expect(record).toContainText('待审核')

  // —— 5. 经理端密码登录（el-tabs 两个面板同时挂载，同样锁定密码登录表单）——
  await page.goto(`${MANAGER_BASE}/manager/login`)
  const mgrForm = page.locator('.login-form', { has: page.locator('input[placeholder="请输入密码"]') })
  await mgrForm.locator('input[placeholder="请输入手机号"]').fill(E2E.managerPhone)
  await mgrForm.locator('input[placeholder="请输入密码"]').fill(E2E.managerPassword)
  await mgrForm.locator('button.login-btn').click()
  await expectLoggedIn(page, 'manager_token')
  await expect(page).toHaveURL(/\/manager\/dashboard$/)

  // —— 6. 佣金管理：找到 pending 订单并审核通过 ——
  await page.goto(`${MANAGER_BASE}/manager/commissions`)
  const row = page.locator('.el-table__row', { hasText: E2E.productName }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText(E2E.userName)
  await expect(row).toContainText('待审核')
  await row.getByRole('button', { name: '审核通过' }).click()
  await expect(page.locator('.el-message-box', { hasText: '审核确认' })).toBeVisible()
  await page.getByRole('button', { name: '通过', exact: true }).click()
  await expect(page.locator('.el-message', { hasText: '已确认记录有效' })).toBeVisible()
  await expect(row).toContainText('已通过')
})
