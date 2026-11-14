<template>
  <!-- 统一移动端底部操作区：按钮均分宽度、44px 触控高度、固定栏统一安全区 -->
  <div
    class="bottom-action-bar"
    :class="[`is-${align}`, { 'is-fixed': fixed, 'is-inset': inset }]"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
// 桌面端不加任何样式，保持各页面原有视觉；移动端由下方媒体查询统一收敛
withDefaults(defineProps<{
  /** 按钮排列：stretch 均分整行，end 右对齐，center 居中 */
  align?: 'stretch' | 'end' | 'center'
  /** 是否为贴底操作栏：铺白底并预留底部安全区（弹窗/抽屉底部使用） */
  fixed?: boolean
  /** 容器本身无左右内边距时（如底部抽屉），由操作栏补 16px */
  inset?: boolean
}>(), {
  align: 'stretch',
  fixed: false,
  inset: false
})
</script>

<style lang="scss" scoped>
@media (max-width: 768px) {
  .bottom-action-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f2f5;

    :deep(.el-button) {
      flex: 1;
      min-width: 0;
      min-height: 44px;
      margin-left: 0;
    }
  }

  /* 贴底操作栏：占据容器底部，滚动区之上，统一处理底部安全区 */
  .bottom-action-bar.is-fixed {
    flex: none;
    margin-top: 0;
    padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
    background-color: #ffffff;
  }

  .bottom-action-bar.is-fixed.is-inset {
    padding-left: 16px;
    padding-right: 16px;
  }

  .bottom-action-bar.is-end {
    justify-content: flex-end;

    :deep(.el-button) {
      flex: none;
      min-width: 88px;
    }
  }

  .bottom-action-bar.is-center {
    justify-content: center;

    :deep(.el-button) {
      flex: none;
      min-width: 120px;
    }
  }
}
</style>
