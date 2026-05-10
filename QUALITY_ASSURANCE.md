# 质量保障体系文档

## 📋 概述

本文档描述了项目的质量保障体系，包括测试框架、代码规范、CI/CD流程等内容，确保代码质量和迭代安全。

## 🧪 测试框架

### 技术选型

- **测试框架**: [Vitest](https://vitest.dev/) - 基于 Vite 的现代快速测试框架
- **组件测试**: [Vue Test Utils](https://test-utils.vuejs.org/) + [Testing Library](https://testing-library.com/)
- **DOM 环境**: [Happy DOM](https://github.com/capricorn86/happy-dom) - 轻量级的 DOM 环境

### 测试命令

```bash
# 运行所有测试（单次执行）
pnpm test

# 运行测试并监听文件变化
pnpm test:watch

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 打开测试 UI 界面
pnpm test:ui
```

### 目录结构

测试文件应该位于 `__tests__` 目录下，与被测试文件同级：

```
src/
  utils/
    helpers.ts
    __tests__/
      helpers.test.ts
  components/
    MyComponent.vue
    __tests__/
      MyComponent.test.ts
```

### 测试类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **单元测试** | 测试独立的函数或模块 | `helpers.test.ts` |
| **组件测试** | 测试 Vue 组件 | `MyComponent.test.ts` |
| **集成测试** | 测试多个模块的交互 | 待添加 |
| **E2E测试** | 端到端测试 | 待添加 |

## ✅ 代码规范

### TypeScript 类型检查

```bash
# 运行类型检查
pnpm type-check
```

### ESLint 代码规范

```bash
# 运行代码规范检查
pnpm lint
```

## 🔄 CI/CD 流程

### 工作流程

#### 1. CI 质量检查 (`ci.yml`)

- **触发条件**: `push` 或 `pull_request` 到 `main` 分支
- **执行内容**:
  1. 类型检查 (`pnpm type-check`)
  2. 代码规范检查 (`pnpm lint`)
  3. 单元测试 (`pnpm test`)

#### 2. 部署流程 (`deploy.yml`)

- **触发条件**: `push` 到 `main` 分支 或 手动触发
- **执行内容**:
  1. **质量检查** (需要 CI 通过)
     - 类型检查
     - ESLint 检查
     - 单元测试
  2. **构建应用**
     - Admin 应用
     - Manager 应用
     - User 应用
     - API 服务
  3. **部署到服务器**
     - 上传构建产物
     - 重启服务
     - 重载 Nginx

### CI 检查徽章

可在 GitHub README 中添加 CI 状态徽章：

```markdown
![CI](https://github.com/{username}/{repo}/actions/workflows/ci.yml/badge.svg)
```

## 📊 测试覆盖

### 生成覆盖率报告

```bash
pnpm test:coverage
```

报告将生成为以下格式：
- 终端文本输出
- JSON 格式
- HTML 格式（可在浏览器中打开）

### 覆盖率目标

建议的最低覆盖率标准（逐步达成）：
- **语句覆盖率**: 80%
- **分支覆盖率**: 70%
- **函数覆盖率**: 80%
- **行覆盖率**: 80%

## 🛠️ 开发规范

### 编写测试的最佳实践

1. **测试命名**: 使用 `should [预期结果] when [场景]` 的命名方式
2. **测试隔离**: 每个测试应该独立，不依赖其他测试
3. **Arrange-Act-Assert**: 遵循 AAA 模式组织测试
4. **快速反馈**: 测试应该快速执行，以便频繁运行

### 示例：单元测试

```typescript
import { describe, it, expect } from 'vitest'
import { formatMoney } from '../helpers'

describe('formatMoney', () => {
  it('should format number as CNY currency', () => {
    expect(formatMoney(100)).toBe('¥100.00')
  })
})
```

### 示例：组件测试

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  it('renders properly', () => {
    const wrapper = mount(MyComponent, {
      props: {
        title: 'Test Title'
      }
    })
    expect(wrapper.text()).toContain('Test Title')
  })
})
```

## 🚀 快速开始

### 新开发者

```bash
# 1. 安装依赖
pnpm install

# 2. 运行类型检查（确保配置正确）
pnpm type-check

# 3. 运行测试
pnpm test

# 4. 开始开发
pnpm dev:admin
```

### 添加新测试

1. 在 `__tests__` 目录下创建对应测试文件
2. 导入被测试的模块或组件
3. 编写测试用例
4. 运行测试验证

```bash
pnpm test:watch  # 开发时使用，监听文件变化
```

## 📖 参考资料

- [Vitest 文档](https://vitest.dev/)
- [Vue Test Utils 文档](https://test-utils.vuejs.org/)
- [Testing Library 文档](https://testing-library.com/)
- [ESLint 文档](https://eslint.org/)

## 🔮 下一步计划

- [ ] 添加更多测试用例，提高测试覆盖率
- [ ] 引入 E2E 测试（Playwright 或 Cypress）
- [ ] 添加预提交钩子（husky + lint-staged）
- [ ] 集成性能测试
- [ ] 添加测试覆盖率徽章
