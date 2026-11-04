# Composable UI 解耦重构指南

## 背景

当前项目中的 composable 直接调用 UI 框架函数（ElMessage、ElMessageBox、showToast、showConfirmDialog），导致：
1. 无法脱离 UI 框架进行单元测试
2. composable 与特定 UI 框架紧耦合
3. 难以在不同场景复用（如测试环境、SSR）

## 解决方案

### 方案一：回调参数（推荐）

为 composable 添加可选的通知回调参数：

```typescript
// shared/utils/helpers.ts
export interface NotificationCallbacks {
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
  onWarning?: (message: string) => void
  onConfirm?: (message: string, title?: string) => Promise<boolean>
}

// composables/useManagerList.ts
export function useManagerList(notifications?: NotificationCallbacks) {
  const notify = notifications || createDefaultNotifications()
  
  const loadData = async () => {
    try {
      const res = await get<Manager[]>('/managers')
      tableData.value = res.data || []
    } catch (error) {
      notify.onError?.(getErrorMessage(error, '获取数据失败'))
    }
  }
  
  const handleToggleStatus = async (row: Manager, newStatus: string) => {
    const confirmed = await notify.onConfirm?.(`确定要${action}吗？`, '提示')
    if (!confirmed) return
    
    try {
      await put(`/managers/${row.id}`, { status: newStatus })
      notify.onSuccess?.('操作成功')
    } catch (error) {
      notify.onError?.(getErrorMessage(error, '操作失败'))
    }
  }
}
```

### 方案二：组件中使用

```vue
<!-- views/ManagerListView.vue -->
<template>
  <div>...</div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { useManagerList } from '@/composables/useManagerList'

const { loadData, handleToggleStatus } = useManagerList({
  onSuccess: (msg) => ElMessage.success(msg),
  onError: (msg) => ElMessage.error(msg),
  onConfirm: async (msg, title) => {
    try {
      await ElMessageBox.confirm(msg, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      return true
    } catch {
      return false
    }
  }
})
</script>
```

### 方案三：测试中使用

```typescript
// __tests__/useManagerList.test.ts
import { useManagerList } from '@/composables/useManagerList'

describe('useManagerList', () => {
  it('should call onError when load fails', async () => {
    const onError = vi.fn()
    const { loadData } = useManagerList({ onError })
    
    mockGet.mockRejectedValue(new Error('Network error'))
    await loadData()
    
    expect(onError).toHaveBeenCalledWith('获取数据失败')
  })
})
```

## 当前状态

### 已完成
- ✅ 创建 `NotificationCallbacks` 接口（shared/utils/helpers.ts）
- ✅ 创建 `createDefaultNotifications()` 默认实现

### 待重构的 Composable

#### Admin App
- [ ] `useManagerList.ts` - 7 处 ElMessage/ElMessageBox 调用
- [ ] `useUserList.ts` - 类似模式
- [ ] `useCategoryAdmin.ts` - 待确认

#### Manager App
- [ ] `useCommissionList.ts` - 待确认
- [ ] `useProductEdit.ts` - 待确认
- [ ] `useRichEditor.ts` - 待确认

#### User App
- [ ] `useCommission.ts` - 待确认
- [ ] `useProductDetail.ts` - 待确认
- [ ] `useProductOrder.ts` - 待确认

## 重构步骤

1. **选择目标 composable**（建议从 useManagerList 开始）
2. **添加 notifications 参数**
3. **替换所有 UI 调用为 notify.xxx**
4. **更新使用该 composable 的组件**
5. **添加/更新单元测试**
6. **验证功能正常**
7. **重复步骤 1-6，逐步重构其他 composable**

## 注意事项

1. **向后兼容**：notifications 参数应为可选，提供默认值
2. **渐进式重构**：不需要一次性重构所有 composable
3. **测试覆盖**：重构后应能编写不依赖 UI 框架的单元测试
4. **类型安全**：确保 NotificationCallbacks 接口类型正确

## 收益

1. **可测试性**：composable 可以独立于 UI 框架进行测试
2. **可复用性**：同一 composable 可在不同 UI 框架中使用
3. **关注点分离**：业务逻辑与 UI 通知解耦
4. **灵活性**：不同场景可以自定义通知行为（如静默模式、日志模式）
