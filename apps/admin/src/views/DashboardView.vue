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
                推广经理管理
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
import { reactive } from 'vue'
import { User, UserFilled, Goods, Money } from '@element-plus/icons-vue'

// 统计数据（实际项目中从 API 获取）
const stats = reactive({
  managerCount: 128,
  userCount: 5642,
  productCount: 356,
  totalCommission: 285630.50
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
