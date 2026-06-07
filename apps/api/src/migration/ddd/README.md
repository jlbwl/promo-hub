# DDD 架构迁移模块

这个目录包含完整的 DDD (领域驱动设计) 架构实现，用于逐步将现有 Service 层迁移到 DDD 架构。

## 📦 架构概览

```
ddd/
├── domain/          # 领域层（纯业务逻辑）
├── application/     # 应用层（用例编排）
├── infrastructure/  # 基础设施层（技术实现）
└── adapters/        # 适配器层（向后兼容）
```

## 🚀 快速开始

详细的迁移指南请查看项目根目录下的 [COMPLETE_MIGRATION_GUIDE.md](../../../COMPLETE_MIGRATION_GUIDE.md)。

## 📝 文档

- **COMPLETE_MIGRATION_GUIDE.md** - 完整的迁移指南（项目根目录）
- **DDD_PROGRESSIVE_MIGRATION_GUIDE.md** - 渐进式迁移策略（项目根目录）
- **DDD_MIGRATION_GUIDE.md** - 初步迁移方案（项目根目录）
- **DDD_IMPLEMENTATION_GUIDE.md** - 架构实现指南（项目根目录）

## 💡 核心特性

✅ **零风险迁移**：新旧架构可以共存
✅ **Adapter 模式**：保持向后兼容
✅ **CQRS 模式**：Command/Query 分离
✅ **充血模型**：业务逻辑封装在聚合根中
✅ **事件驱动**：支持领域事件
✅ **易测试**：领域模型可以独立测试

## 📞 注意事项

此代码当前放在 `migration/` 目录下，作为示例和参考。如需实际使用：

1. 将代码移动到正式的源代码目录
2. 更新 TypeScript 配置
3. 集成到 DI 容器
4. 进行完整的测试

详细步骤请查看完整的迁移指南。
