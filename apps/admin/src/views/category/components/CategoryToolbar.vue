<template>
  <!-- 搜索栏 -->
  <el-card
    shadow="never"
    class="search-card"
  >
    <el-row
      :gutter="20"
      align="middle"
    >
      <el-col :span="8">
        <el-button
          type="primary"
          icon="Plus"
          @click="emit('add')"
        >
          添加分类
        </el-button>
        <el-button
          type="success"
          icon="Download"
          style="margin-left: 12px;"
          @click="emit('export-products')"
        >
          一键派单
        </el-button>
        <el-button
          type="info"
          icon="Scan"
          style="margin-left: 12px;"
          @click="emit('show-qr')"
        >
          网址转二维码
        </el-button>
      </el-col>
      <el-col
        :span="20"
        style="text-align: right;"
      >
        <el-button
          icon="Refresh"
          @click="emit('refresh')"
        >
          刷新
        </el-button>
      </el-col>
    </el-row>
  </el-card>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  add: []
  'export-products': []
  'show-qr': []
  refresh: []
}>()
</script>

<style lang="scss" scoped>
.search-card {
  :deep(.el-card__body) {
    padding-bottom: 2px;
  }
}

@media (max-width: 768px) {
  .search-card {
    :deep(.el-card__body) {
      padding: 12px;
    }

    :deep(.el-row) {
      flex-direction: column;
      gap: 12px;

      :deep(.el-col) {
        width: 100%;
        text-align: left !important;
      }
    }

    :deep(.el-button) {
      margin-left: 0 !important;
      margin-right: 8px;
      margin-bottom: 8px;
    }
  }
}
</style>
