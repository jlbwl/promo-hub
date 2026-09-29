/**
 * 线上只读冒烟：三端页面可达 + 登录表单渲染 + API 健康
 * 约束：不登录、不提交任何表单、不产生数据副作用
 */
import { expect, test } from '@playwright/test'

test('API 健康检查返回 ok', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.message).toBe('ok')
})

test('根路径重定向到用户端', async ({ request }) => {
  const res = await request.get('/', { maxRedirects: 0 })
  expect(res.status()).toBe(302)
  expect(res.headers().location).toContain('/user/')
})

test('用户端页面挂载渲染', async ({ page }) => {
  await page.goto('/user/')
  await expect(page.locator('#app')).toBeAttached()
  await expect(page).toHaveTitle(/.+/)
})

test('经理端登录表单渲染', async ({ page }) => {
  await page.goto('/manager/')
  await expect(page.locator('#app')).toBeAttached()
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 })
})

test('管理端登录表单渲染', async ({ page }) => {
  await page.goto('/admin/')
  await expect(page.locator('#app')).toBeAttached()
  await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 })
})
