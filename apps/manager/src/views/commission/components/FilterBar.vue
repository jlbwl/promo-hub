<template>
  <!-- 移动端：搜索框 + 筛选入口，具体条件收进底部抽屉 -->
  <div
    v-if="isMobile"
    class="search-bar is-mobile"
  >
    <el-input
      :model-value="keyword"
      class="keyword-input"
      placeholder="搜索产品、用户姓名、手机号"
      prefix-icon="Search"
      clearable
      @update:model-value="emit('update:keyword', $event)"
      @clear="emit('change')"
      @keyup.enter="emit('change')"
    />
    <el-button
      class="filter-entry"
      :class="{ 'has-filter': activeFilterCount > 0 }"
      @click="openFilterSheet"
    >
      <el-icon><Filter /></el-icon>
      筛选
      <span
        v-if="activeFilterCount > 0"
        class="filter-count"
      >{{ activeFilterCount }}</span>
    </el-button>
  </div>

  <!-- 桌面端：保持原有平铺筛选栏 -->
  <div
    v-else
    class="search-bar"
  >
    <el-input
      :model-value="keyword"
      class="keyword-input"
      placeholder="搜索产品名称、用户姓名、手机号"
      prefix-icon="Search"
      clearable
      @update:model-value="emit('update:keyword', $event)"
      @clear="emit('change')"
      @keyup.enter="emit('change')"
    />
    <el-select
      :model-value="status"
      class="status-select"
      placeholder="订单状态"
      clearable
      @update:model-value="emit('update:status', $event)"
      @change="emit('change')"
    >
      <el-option
        label="全部"
        value=""
      />
      <el-option
        label="待审核"
        value="pending"
      />
      <el-option
        label="已通过"
        value="approved"
      />
      <el-option
        label="待发放"
        value="pending_payment"
      />
      <el-option
        label="已发放"
        value="settled"
      />
    </el-select>
    <!-- 审核日期：自然日范围，选同一天即单日；审核通过与驳回都算当天审核 -->
    <span class="filter-label">审核日期</span>
    <el-date-picker
      :model-value="reviewDateRange"
      class="date-range-picker"
      type="daterange"
      value-format="YYYY-MM-DD"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      @update:model-value="(v: string[] | null) => emit('update:reviewDateRange', v)"
      @change="emit('change')"
    />
    <!-- 只看重单：服务端筛选，与状态/关键词叠加 -->
    <el-checkbox
      :model-value="onlyDuplicate"
      style="margin-left: 4px;"
      @update:model-value="(v: boolean | string | number) => emit('update:onlyDuplicate', Boolean(v))"
      @change="emit('change')"
    >
      只看重单
    </el-checkbox>
    <span class="duplicate-hint">同客户同产品 ≥2 笔有效订单（已驳回/已删除不计）</span>
    <el-button
      icon="Refresh"
      @click="emit('reset')"
    >
      重置
    </el-button>
  </div>

  <!-- 移动端筛选底部抽屉：条件先编辑、点「应用」再生效 -->
  <el-drawer
    v-model="filterDrawerVisible"
    direction="btt"
    size="auto"
    :with-header="false"
    body-class="filter-sheet-body"
    class="filter-drawer"
  >
    <div class="filter-sheet">
      <div class="sheet-head">
        <span class="sheet-title">筛选</span>
        <button
          type="button"
          class="sheet-close"
          aria-label="关闭筛选"
          @click="filterDrawerVisible = false"
        >
          <el-icon :size="18">
            <Close />
          </el-icon>
        </button>
      </div>

      <div class="sheet-content">
        <div class="sheet-field">
          <span class="field-label">订单状态</span>
          <el-select
            v-model="draftStatus"
            placeholder="全部"
            class="field-control"
          >
            <el-option
              label="全部"
              value=""
            />
            <el-option
              label="待审核"
              value="pending"
            />
            <el-option
              label="已通过"
              value="approved"
            />
            <el-option
              label="待发放"
              value="pending_payment"
            />
            <el-option
              label="已发放"
              value="settled"
            />
          </el-select>
        </div>

        <div class="sheet-field">
          <span class="field-label">审核日期</span>
          <div class="date-fields">
            <el-date-picker
              v-model="draftStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="开始日期"
              class="date-field"
            />
            <span class="date-sep">至</span>
            <el-date-picker
              v-model="draftEndDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="结束日期"
              class="date-field"
            />
          </div>
        </div>

        <div class="sheet-field switch-field">
          <div class="switch-text">
            <span class="field-label">只看重单</span>
            <p class="field-hint">
              同客户同产品 ≥2 笔有效订单（已驳回/已删除不计）
            </p>
          </div>
          <el-switch v-model="draftOnlyDuplicate" />
        </div>
      </div>

      <BottomActionBar
        fixed
        inset
      >
        <el-button @click="handleSheetReset">
          重置
        </el-button>
        <el-button
          type="primary"
          @click="handleSheetApply"
        >
          应用
        </el-button>
      </BottomActionBar>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
// 筛选栏：关键词、订单状态（移动端收进底部抽屉）
import { computed, ref } from 'vue'
import { Filter, Close } from '@element-plus/icons-vue'
import { useIsMobile } from '@/composables/useIsMobile'
import BottomActionBar from '@/components/BottomActionBar.vue'

const props = defineProps<{
  keyword: string
  status: string
  reviewDateRange: string[] | null
  onlyDuplicate: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: string]
  'update:reviewDateRange': [value: string[] | null]
  'update:onlyDuplicate': [value: boolean]
  change: []
  reset: []
}>()

const { isMobile } = useIsMobile()

const filterDrawerVisible = ref(false)
// 抽屉内的草稿条件：点「应用」才回传，避免每次选择都触发请求
const draftStatus = ref('')
const draftStartDate = ref('')
const draftEndDate = ref('')
const draftOnlyDuplicate = ref(false)

// 生效中的筛选条件数量，用于筛选按钮角标
const activeFilterCount = computed(() => {
  let count = 0
  if (props.status) count += 1
  if (props.reviewDateRange?.length === 2) count += 1
  if (props.onlyDuplicate) count += 1
  return count
})

const openFilterSheet = () => {
  draftStatus.value = props.status
  draftStartDate.value = props.reviewDateRange?.[0] || ''
  draftEndDate.value = props.reviewDateRange?.[1] || ''
  draftOnlyDuplicate.value = props.onlyDuplicate
  filterDrawerVisible.value = true
}

const handleSheetApply = () => {
  // 只填开始日期时按单日处理
  const start = draftStartDate.value
  const end = draftEndDate.value || draftStartDate.value
  emit('update:status', draftStatus.value)
  emit('update:reviewDateRange', start ? [start, end] : null)
  emit('update:onlyDuplicate', draftOnlyDuplicate.value)
  emit('change')
  filterDrawerVisible.value = false
}

const handleSheetReset = () => {
  draftStatus.value = ''
  draftStartDate.value = ''
  draftEndDate.value = ''
  draftOnlyDuplicate.value = false
  emit('reset')
  filterDrawerVisible.value = false
}
</script>

<style lang="scss" scoped>
.search-bar {
  &.is-mobile {
    flex-wrap: nowrap;
    gap: 8px;
    margin-bottom: 12px;

    .keyword-input {
      flex: 1;
      min-width: 0;
    }

    .filter-entry {
      flex: none;
      min-height: 44px;
      margin-left: 0;
      color: #606266;
      border-color: #dcdfe6;
    }

    .filter-entry.has-filter {
      color: #409eff;
      border-color: #409eff;
      background-color: #ecf5ff;
    }
  }
}

.keyword-input {
  width: 300px;
}

.status-select {
  width: 140px;
}

.date-range-picker {
  width: 240px;
}

.filter-label {
  margin-left: 6px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.duplicate-hint {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 11px;
  color: #ffffff;
  background-color: #409eff;
}

/* ===== 移动端底部筛选抽屉 ===== */
.filter-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #ffffff;
}

.sheet-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 8px 16px;
  border-bottom: 1px solid #f0f2f5;

  .sheet-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .sheet-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: #909399;
  }
}

.sheet-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 16px;
}

.sheet-field {
  padding: 12px 0;
  border-bottom: 1px solid #f5f7fa;

  &:last-child {
    border-bottom: none;
  }
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.field-control {
  width: 100%;
}

.date-fields {
  display: flex;
  align-items: center;
  gap: 8px;

  .date-field {
    flex: 1;
    min-width: 0;
  }

  .date-sep {
    flex: none;
    font-size: 13px;
    color: #909399;
  }
}

.switch-field {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  .switch-text {
    flex: 1;
    min-width: 0;
  }

  .field-label {
    margin-bottom: 4px;
  }

  .field-hint {
    font-size: 12px;
    line-height: 1.5;
    color: #909399;
  }
}

// 手机：审核日期起止改为上下两行，避免两个日期框互相挤压
@media (max-width: 767px) {
  .date-fields {
    flex-direction: column;
    align-items: stretch;

    .date-sep {
      display: none;
    }
  }
}
</style>

<style lang="scss">
/* 抽屉由 teleport 渲染，内部容器用全局样式控制内边距 */
.filter-drawer {
  max-height: 90%;
  border-radius: 16px 16px 0 0;
  overflow: hidden;

  .filter-sheet-body {
    height: 100%;
    padding: 0;
  }
}
</style>
