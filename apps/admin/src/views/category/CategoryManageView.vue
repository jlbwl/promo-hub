<template>
  <div class="category-manage">
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
            @click="showAddDialog"
          >
            添加分类
          </el-button>
          <el-button
            type="success"
            icon="Download"
            style="margin-left: 12px;"
            @click="handleExportProducts"
          >
            一键派单
          </el-button>
        </el-col>
        <el-col
          :span="20"
          style="text-align: right;"
        >
          <el-button
            icon="Refresh"
            @click="loadData"
          >
            刷新
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card
      shadow="never"
      style="margin-top: 16px;"
    >
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column
          prop="name"
          label="分类名称"
          width="180"
        />
        <el-table-column
          prop="value"
          label="分类标识"
          width="200"
        />
        <el-table-column
          prop="sort"
          label="排序"
          width="100"
          align="center"
        />
        <el-table-column
          prop="status"
          label="状态"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '启用' : '已归档' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="创建时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="更新时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          min-width="240"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              type="primary"
              text
              size="small"
              @click="showEditDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              type="warning"
              text
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 'active' ? '归档' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑分类' : '添加分类'"
      width="450px"
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item
          label="分类名称"
          prop="name"
        >
          <el-input
            v-model="form.name"
            placeholder="请输入分类名称"
          />
        </el-form-item>
        <el-form-item
          label="分类标识"
          prop="value"
        >
          <el-input
            v-model="form.value"
            placeholder="请输入分类标识"
            :disabled="isEdit"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            标识用于兼容旧数据，创建后不可修改
          </div>
        </el-form-item>
        <el-form-item
          label="排序"
          prop="sort"
        >
          <el-input-number
            v-model="form.sort"
            :min="0"
            :step="1"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item
          label="状态"
          prop="status"
        >
          <el-radio-group v-model="form.status">
            <el-radio value="active">
              启用
            </el-radio>
            <el-radio value="archived">
              已归档
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saveLoading"
          @click="handleSave"
        >
          {{ isEdit ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { get, post, put } from '@promo/shared/utils/request'
import type { ProductCategory, Product } from '@promo/shared/types'
import * as XLSX from 'xlsx'

// 格式化时间（北京时区 UTC+8）
const formatTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  let day = d.getUTCDate()
  let hours = d.getUTCHours() + 8
  if (hours >= 24) {
    hours -= 24
    day += 1
  }
  return `${year}-${p(month)}-${p(day)} ${p(hours)}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

// 加载状态
const loading = ref(false)

// 表格数据
const tableData = ref<ProductCategory[]>([])

// 弹窗相关
const dialogVisible = ref(false)
const isEdit = ref(false)
const saveLoading = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<Partial<ProductCategory>>({
  name: '',
  value: '',
  sort: 0,
  status: 'active'
})
const editRow = ref<ProductCategory | null>(null)

// 表单验证规则
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 2, max: 50, message: '分类名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  value: [
    { required: true, message: '请输入分类标识', trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: '分类标识只能包含小写字母、数字和连字符', trigger: 'blur' }
  ],
  sort: [
    { required: true, message: '请输入排序', trigger: 'blur' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await get<{ list: ProductCategory[] }>('/categories', { includeArchived: 'true' })
    tableData.value = res.data?.list || []
  } catch (error: any) {
    ElMessage.error(error.message || '获取数据失败')
  } finally {
    loading.value = false
  }
}

// 显示添加弹窗
const showAddDialog = () => {
  isEdit.value = false
  dialogVisible.value = true
}

// 显示编辑弹窗
const showEditDialog = (row: ProductCategory) => {
  isEdit.value = true
  editRow.value = row
  Object.assign(form, {
    name: row.name,
    value: row.value,
    sort: row.sort,
    status: row.status
  })
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  form.name = ''
  form.value = ''
  form.sort = 0
  form.status = 'active'
  editRow.value = null
  formRef.value?.resetFields()
}

// 保存
const handleSave = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    saveLoading.value = true
    if (isEdit.value && editRow.value) {
      await put(`/categories/${editRow.value.id}`, {
        name: form.name,
        sort: form.sort,
        status: form.status
      })
      ElMessage.success('更新成功')
    } else {
      await post('/categories', {
        name: form.name,
        value: form.value,
        sort: form.sort
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saveLoading.value = false
  }
}

// 切换状态
const handleToggleStatus = async (row: ProductCategory) => {
  const newStatus = row.status === 'active' ? 'archived' : 'active'
  const action = newStatus === 'active' ? '启用' : '归档'
  try {
    await ElMessageBox.confirm(`确定要${action}分类「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (newStatus === 'archived') {
      await import('@promo/shared/utils/request').then(({ del }) => del(`/categories/${row.id}`))
    } else {
      await put(`/categories/${row.id}`, { status: newStatus })
    }
    ElMessage.success(`${action}成功`)
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 一键派单导出Excel
const handleExportProducts = async () => {
  try {
    const res = await get<{ list: Product[] }>('/products', { adminMode: 'true', status: 'published', page: '1', pageSize: '1000' })
    const products = res.data?.list || []

    if (products.length === 0) {
      ElMessage.info('暂无开放的产品')
      return
    }

    const categories = await get<{ list: ProductCategory[] }>('/categories')
    const categoryMap = new Map(categories.data?.list?.map(c => [c.value, c.name]) || [])

    const mappedProducts = products.map((product: Product) => ({
      categoryName: categoryMap.get(product.category) || product.category || '未分类',
      title: product.title,
      price: product.price,
      description: product.description || ''
    }))

    mappedProducts.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'zh-CN'))

    const headers = ['产品分类', '产品名称', '推广费', '产品描述']
    const ws = XLSX.utils.aoa_to_sheet([headers])

    mappedProducts.forEach((product, index) => {
      XLSX.utils.sheet_add_aoa(ws, [
        [product.categoryName, product.title, product.price, product.description]
      ], { origin: index + 1 })
    })

    const categoryRows: Record<string, { start: number; end: number }> = {}
    mappedProducts.forEach((product, index) => {
      const rowNum = index + 1
      if (!categoryRows[product.categoryName]) {
        categoryRows[product.categoryName] = { start: rowNum, end: rowNum }
      } else {
        categoryRows[product.categoryName].end = rowNum
      }
    })

    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
    Object.values(categoryRows).forEach(range => {
      if (range.start !== range.end) {
        merges.push({
          s: { r: range.start, c: 0 },
          e: { r: range.end, c: 0 }
        })
      }
    })
    ws['!merges'] = merges

    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 10 },
      { wch: 40 }
    ]

    const headerStyle = {
      fill: { fgColor: { rgb: 'FFD700' } },
      font: { bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    }

    Object.keys(ws).forEach(key => {
      if (/^A1|^B1|^C1|^D1$/.test(key)) {
        ws[key] = { ...ws[key], s: headerStyle }
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '派单表')

    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const fileName = `派单表_${dateStr}.xlsx`

    XLSX.writeFile(wb, fileName)

    ElMessage.success('派单表导出成功')
  } catch (error: any) {
    ElMessage.error(error.message || '导出失败')
  }
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.category-manage {
  .search-card {
    :deep(.el-card__body) {
      padding-bottom: 2px;
    }
  }
}
</style>