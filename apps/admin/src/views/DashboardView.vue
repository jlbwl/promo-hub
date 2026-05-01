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
      <!-- 上架产品 - 可点击按钮 -->
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card clickable" @click="openProductDialog">
          <el-statistic title="上架产品" :value="stats.publishedProductCount">
            <template #prefix>
              <el-icon style="color: #e6a23c;"><Goods /></el-icon>
            </template>
          </el-statistic>
          <div v-if="stats.publishedProductCount > 0" class="card-badge">查看</div>
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
              <el-button type="primary" @click="$router.push('/managers')">系统管理后台</el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="success" @click="$router.push('/users')">用户管理</el-button>
            </el-col>
            <el-col :span="6">
              <el-button type="warning" @click="$router.push('/settings')">系统设置</el-button>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <!-- ====== 上架产品模态框 ====== -->
    <el-dialog v-model="productDialogVisible" title="上架产品列表" width="800px" destroy-on-close>
      <div class="product-dialog-content">
        <div class="payment-summary">
          <span>当前上架 <strong>{{ publishedProducts.length }}</strong> 个产品</span>
        </div>

        <el-table v-loading="productLoading" :data="publishedProducts" border size="small" max-height="450">
          <el-table-column type="index" label="#" width="40" />
          <el-table-column prop="coverImage" label="封面" width="70" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.coverImage"
                :src="row.coverImage"
                style="width: 48px; height: 48px; border-radius: 4px;"
                fit="cover"
                :preview-src-list="[row.coverImage]"
                preview-teleported
              />
              <span v-else style="color: #ccc;">无图</span>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="产品名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="price" label="售价" width="80" align="right">
            <template #default="{ row }">
              <span style="font-weight: 600;">¥{{ row.price }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="stock" label="库存" width="70" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.stock > 0 ? '#e6a23c' : '#67c23a' }">
                {{ row.stock > 0 ? row.stock : '不限' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="100" show-overflow-tooltip>
            <template #default="{ row }">
              <el-tag size="small">{{ getCategoryName(row.category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="managerId" label="所属经理" width="100" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ getManagerName(row.managerId) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="publishedAt" label="上架时间" width="150" align="center">
            <template #default="{ row }">
              <span>{{ formatTime(row.publishedAt || row.createdAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="danger" text size="small" @click="handleOffline(row)">下架</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="payment-actions">
          <el-button @click="productDialogVisible = false">关闭</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- ====== 下架整改建议模态框 ====== -->
    <el-dialog v-model="offlineResultVisible" title="整改建议" width="500px">
      <div class="offline-result">
        <el-result icon="warning" title="产品已下架" sub-title="请通知所属经理进行以下整改后重新上架">
        </el-result>
        <div class="suggestion-card">
          <h4>📋 整改建议</h4>
          <ul>
            <li>检查产品信息是否完整、准确</li>
            <li>确认产品售价和库存设置合理</li>
            <li>核实产品分类是否正确</li>
            <li>确保产品封面图片清晰有效</li>
            <li>检查产品描述是否包含违规内容</li>
            <li>确认产品推广链接有效可访问</li>
          </ul>
        </div>
        <div v-if="offlineProduct" class="offline-info">
          <p><strong>下架产品：</strong>{{ offlineProduct.title }}</p>
          <p><strong>所属经理：</strong>{{ getManagerName(offlineProduct.managerId) }}</p>
          <p><strong>下架时间：</strong>{{ formatTime(new Date().toISOString()) }}</p>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="offlineResultVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { User, UserFilled, Goods, Money } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put } from '@promo/shared/utils/request'

// 统计数据
const stats = reactive({
  managerCount: 0,
  userCount: 0,
  publishedProductCount: 0,
  totalCommission: 0
})

// 上架产品弹窗
const productDialogVisible = ref(false)
const productLoading = ref(false)
const publishedProducts = ref<any[]>([])

// 下架结果弹窗
const offlineResultVisible = ref(false)
const offlineProduct = ref<any>(null)

// 分类映射
const getCategoryName = (category: string) => {
  const map: Record<string, string> = {
    'comprehensive-instant': '综合-立返',
    'comprehensive-data': '综合-数据',
    'personal-insurance': '个养和加挂',
    'limit3-instant': '限三-立返',
    'limit3-data': '限三-数据',
    'no-limit3-instant': '不限三-立返',
    'no-limit3-data': '不限三-数据',
    'third-party-instant': '三方-立返',
    'third-party-data': '三方-数据',
    'other': '其它',
  }
  return map[category] || category || '--'
}

// 获取经理名称
const getManagerName = (managerId: string) => {
  if (!managerId) return '--'
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    if (info.id === managerId) return info.name || managerId
  } catch {}
  return managerId.slice(0, 8)
}

// 格式化时间
const formatTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 获取全局统计数据
const fetchStats = async () => {
  try {
    const res = await get<any>('/admin/stats')
    if (res.data) {
      stats.managerCount = res.data.managerCount || 0
      stats.userCount = res.data.userCount || 0
      stats.publishedProductCount = res.data.publishedProductCount || 0
      stats.totalCommission = res.data.totalCommission || 0
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 打开上架产品弹窗
const openProductDialog = async () => {
  if (stats.publishedProductCount === 0) {
    ElMessage.info('当前没有上架产品')
    return
  }
  productDialogVisible.value = true
  productLoading.value = true
  try {
    const res = await get<any>('/products', { status: 'published', pageSize: 999 })
    publishedProducts.value = res.data?.list || []
  } catch {
    ElMessage.error('获取产品列表失败')
  } finally {
    productLoading.value = false
  }
}

// 下架产品
const handleOffline = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要下架「${row.title}」吗？下架后用户端将不再显示该产品。`,
      '下架确认',
      { confirmButtonText: '确认下架', cancelButtonText: '取消', type: 'warning' }
    )
    await put(`/admin/products/${row.id}/offline`)
    ElMessage.success('已下架')
    // 刷新列表和统计
    publishedProducts.value = publishedProducts.value.filter((p: any) => p.id !== row.id)
    stats.publishedProductCount = publishedProducts.value.length
    // 显示整改建议
    offlineProduct.value = row
    offlineResultVisible.value = true
  } catch (e: any) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
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
      position: relative;
      cursor: default;

      :deep(.el-statistic__head) {
        font-size: 14px;
        color: #909399;
      }

      :deep(.el-statistic__content) {
        font-size: 28px;
        font-weight: 600;
      }

      &.clickable {
        cursor: pointer;
        transition: all 0.3s;
        border: 2px solid transparent;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(230, 162, 60, 0.3);
          border-color: #e6a23c;
        }
      }

      .card-badge {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        color: #fff;
        background: linear-gradient(135deg, #e6a23c, #f5c77e);
      }
    }
  }
}

.product-dialog-content {
  .payment-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #606266;
  }

  .payment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
  }
}

.offline-result {
  .suggestion-card {
    background: #fdf6ec;
    border: 1px solid #faecd8;
    border-radius: 8px;
    padding: 16px;
    margin: 16px 0;

    h4 {
      margin-bottom: 12px;
      color: #e6a23c;
    }

    ul {
      padding-left: 20px;
      margin: 0;

      li {
        font-size: 14px;
        color: #606266;
        line-height: 2;
      }
    }
  }

  .offline-info {
    background: #f5f7fa;
    border-radius: 8px;
    padding: 12px 16px;

    p {
      font-size: 13px;
      color: #909399;
      margin: 4px 0;

      strong {
        color: #606266;
      }
    }
  }
}
</style>
