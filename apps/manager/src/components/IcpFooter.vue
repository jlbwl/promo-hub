<template>
  <div class="icp-footer">
    <div class="icp-info">
      <a
        v-if="icpNumber"
        href="http://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        class="icp-link"
      >
        {{ icpNumber }}
      </a>
      <span v-else class="icp-placeholder">
        请在备案成功后配置备案号
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ICP 备案信息底部组件
 * 备案成功后需要在环境变量中配置 VITE_ICP_NUMBER
 */
defineProps<{
  icpNumber?: string
}>()
</script>

<style scoped lang="scss">
.icp-footer {
  padding: 12px 0;
  text-align: center;
  background-color: #f5f7fa;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.icp-info {
  font-size: 12px;
  color: #909399;
}

.icp-link {
  color: #909399;
  text-decoration: none;
  transition: color 0.3s;

  &:hover {
    color: #409eff;
  }
}

.icp-placeholder {
  color: #c0c4cc;
}
</style>
