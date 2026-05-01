<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="推广经理总数" :value="stats.managerCount">
            <template #prefix>
              <el-icon style="color: #409eff;"><User /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="用户总数" :value="stats.userCount">
            <template #prefix>
              <el-icon style="color: #67c23a;"><UserFilled /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="产品总数" :value="stats.productCount">
            <template #prefix>
              <el-icon style="color: #e6a23c;"><Goods /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="佣金总额" :value="stats.totalCommission" :precision="2" prefix="¥">
            <template #prefix>
              <el-icon style="color: #f56c6c;"><Money /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快捷操作 -->
    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header>
            <span>快捷操作</span>
          </template>
          <el-row :gutter="20">
            <el-col :span="6">
              <el-button type="primary" @click="$router.push('/managers')">
                系统管理后台
              </el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="success" @click="$router.push('/users')">
                用户管理
              </el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="warning" @click="$router.push('/settings')">
                系统设置
              </el-button>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { User, UserFilled, Goods, Money } from '@element-plus/icons-vue'
import { get } from '@promo/shared/utils/request'

// 统计数据
const stats = reactive({
  managerCount: 0,
  userCount: 0,
  productCount: 0,
  totalCommission: 0
})

// 获取全局统计数据
const fetchStats = async () => {
  try {
    const res = await get<any>('/admin/stats')
    if (res.data) {
      stats.managerCount = res.data.managerCount || 0
      stats.userCount = res.data.userCount || 0
      stats.productCount = res.data.productCount || 0
      stats.totalCommission = res.data.totalCommission || 0
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
.dashboard {
  .stat-row {
    .stat-card {
      text-align: center;

      :deep(.el-statistic__head) {
        font-size: 14px;
        color: #909399;
      }

      :deep(.el-statistic__content) {
        font-size: 28px;
        font-weight: 600;
      }
    }
  }
}
</style>
