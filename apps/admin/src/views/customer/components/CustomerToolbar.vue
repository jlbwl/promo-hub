<template>
  <el-card shadow="never" class="customer-toolbar">
    <div class="toolbar-row">
      <div class="filters">
        <el-input
          v-model="keyword"
          class="keyword-input"
          placeholder="搜索群号简称、对接人、卡号/备注"
          prefix-icon="Search"
          clearable
          @clear="emit('search')"
          @keyup.enter="emit('search')"
        />
        <el-select
          v-model="payMethod"
          class="filter-select"
          placeholder="收款方式"
          clearable
          @change="emit('search')"
        >
          <el-option
            v-for="item in PAY_METHOD_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="status"
          class="filter-select"
          placeholder="状态"
          clearable
          @change="emit('search')"
        >
          <el-option
            v-for="item in STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button type="primary" icon="Search" @click="emit('search')">
          搜索
        </el-button>
        <el-button @click="emit('reset')">
          重置
        </el-button>
      </div>

      <div class="actions">
        <el-radio-group v-model="viewMode" class="view-mode-switch">
          <el-radio-button value="table">
            表格
          </el-radio-button>
          <el-radio-button value="card">
            卡片
          </el-radio-button>
        </el-radio-group>
        <el-button type="primary" icon="Plus" @click="emit('add')">
          新增客户
        </el-button>
        <el-button icon="Upload" @click="emit('import')">
          批量导入
        </el-button>
        <el-button icon="PictureFilled" @click="emit('qrcode')">
          批量上传收款码
        </el-button>
        <el-button icon="Download" @click="emit('export')">
          导出
        </el-button>
        <el-button text type="primary" @click="emit('template')">
          下载模板
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { PAY_METHOD_OPTIONS, STATUS_OPTIONS, type CustomerViewMode } from '../utils'

const keyword = defineModel<string>('keyword', { default: '' })
const payMethod = defineModel<string>('payMethod', { default: '' })
const status = defineModel<string>('status', { default: '' })
const viewMode = defineModel<CustomerViewMode>('viewMode', { default: 'table' })

const emit = defineEmits<{
  search: []
  reset: []
  add: []
  import: []
  qrcode: []
  export: []
  template: []
}>()
</script>

<style lang="scss" scoped>
.customer-toolbar {
  .toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .keyword-input {
    width: 260px;
  }

  .filter-select {
    width: 120px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .view-mode-switch {
    margin-right: 4px;
  }
}

@media (max-width: 768px) {
  .customer-toolbar {
    .keyword-input,
    .filter-select {
      width: 100%;
    }

    .filters,
    .actions {
      width: 100%;
    }
  }
}
</style>
