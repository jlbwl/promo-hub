<template>
  <div class="dashboard-page">
    <!-- 统计卡片 -->
    <el-row
      :gutter="20"
      class="stat-cards"
    >
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card
          shadow="hover"
          class="stat-card"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">产品总数</span>
              <el-statistic :value="stats.totalProducts" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #409eff; background: #ecf5ff;"
            >
              <Goods />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card
          shadow="hover"
          class="stat-card"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已发布产品</span>
              <el-statistic :value="stats.publishedProducts" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #67c23a; background: #f0f9eb;"
            >
              <CircleCheck />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card
          shadow="hover"
          class="stat-card"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待审核佣金</span>
              <el-statistic :value="stats.pendingCommissions" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #e6a23c; background: #fdf6ec;"
            >
              <Clock />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="6"
      >
        <el-card
          shadow="hover"
          class="stat-card"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">累计佣金</span>
              <el-statistic :value="stats.totalCommissions" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #f56c6c; background: #fef0f0;"
            >
              <Money />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷操作 -->
    <el-row
      :gutter="20"
      class="quick-actions"
    >
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <span>快捷操作</span>
          </template>
          <div class="action-buttons">
            <el-button
              type="primary"
              @click="$router.push('/products/create')"
            >
              <el-icon><Plus /></el-icon>
              新建产品
            </el-button>
            <el-button
              type="success"
              @click="$router.push('/products')"
            >
              <el-icon><Goods /></el-icon>
              产品管理
            </el-button>
            <el-button
              type="warning"
              @click="$router.push('/commissions')"
            >
              <el-icon><Money /></el-icon>
              佣金管理
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { Goods, CircleCheck, Clock, Money, Plus } from '@element-plus/icons-vue'
import { get } from '@promo/shared/utils/request'

// 获取当前经理 ID
const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 统计数据
const stats = reactive({
  totalProducts: 0,
  publishedProducts: 0,
  pendingCommissions: 0,
  totalCommissions: 0
})

// 获取统计数据
const fetchStats = async () => {
  try {
    const res = await get<any>('/stats/dashboard', {
      managerId: getManagerId() || undefined,
    })
    if (res.data) {
      stats.totalProducts = res.data.totalProducts || 0
      stats.publishedProducts = res.data.publishedProducts || 0
      stats.pendingCommissions = res.data.pendingCommissions || 0
      stats.totalCommissions = res.data.totalCommissions || 0
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style lang="scss" scoped>
.dashboard-page {
  .stat-cards {
    margin-bottom: 20px;
  }

  .stat-card {
    margin-bottom: 16px;

    .stat-content {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .stat-info {
        .stat-label {
          display: block;
          font-size: 14px;
          color: #909399;
          margin-bottom: 8px;
        }
      }

      .stat-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
      }
    }
  }

  .quick-actions {
    .action-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
  }
}
</style>
