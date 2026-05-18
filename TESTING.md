# 测试配置说明

## 测试框架

项目使用 **Vitest** 作为测试框架，支持：

- 单元测试
- 组件测试
- E2E 测试（可选配置）

## 当前测试覆盖

### 单元测试

- ✅ `packages/shared/src/types/**` - 类型定义测试
- ✅ `packages/shared/src/utils/**` - 工具函数测试
- ✅ `apps/api/src/utils/**` - API工具函数测试

### 覆盖报告

运行覆盖率报告：

```bash
pnpm test:coverage
```

当前覆盖率：
- 总覆盖：93.44%
- 语句覆盖：93.44%
- 分支覆盖：89.65%
- 函数覆盖：92.5%
- 行覆盖：93.22%

## E2E 测试配置建议

### 选项1: Playwright

```bash
# 安装依赖
pnpm add -D @playwright/test

# 初始化
npx playwright install
```

在项目根目录创建 `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
})
```

### 选项2: Cypress

```bash
# 安装依赖
pnpm add -D cypress

# 初始化
npx cypress open
```

在 package.json 中添加:

```json
{
  "scripts": {
    "cy:open": "cypress open",
    "cy:run": "cypress run"
  }
}
```

## 未来改进建议

1. **完善 API 控制器测试**
   - 为 `apps/api/src/controllers/**` 添加单元测试
   - 测试各个端点的请求和响应

2. **添加前端组件测试**
   - 使用 Vue Test Utils 测试 Vue 组件
   - 使用 Testing Library 测试 UI

3. **集成测试**
   - 测试完整的用户流程
   - 数据库集成测试

4. **CI/CD 集成**
   - 自动运行测试
   - 查看覆盖率报告
