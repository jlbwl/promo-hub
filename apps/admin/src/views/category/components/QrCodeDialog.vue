<template>
  <!-- 网址转二维码弹窗 -->
  <el-dialog
    v-model="qrCodeDialogVisible"
    title="网址转二维码"
    width="800px"
    @close="resetQrCodeForm"
  >
    <el-form
      ref="qrCodeFormRef"
      :model="qrCodeForm"
      :rules="qrCodeFormRules"
      label-width="100px"
    >
      <el-form-item
        label="网址链接"
        prop="url"
      >
        <el-input
          v-model="qrCodeForm.url"
          placeholder="请输入网址链接"
        />
      </el-form-item>
      <el-form-item
        label="上方文字"
      >
        <el-input
          v-model="qrCodeForm.topText"
          placeholder="输入二维码上方显示的文字"
        />
      </el-form-item>
      <el-form-item
        label="中心文字"
      >
        <el-input
          v-model="qrCodeForm.centerText"
          placeholder="输入二维码中心显示的文字"
        />
      </el-form-item>
    </el-form>
    <div
      v-if="qrCodeDataUrl"
      style="text-align: center; margin-top: 20px;"
    >
      <img
        :src="qrCodeDataUrl"
        alt="二维码"
        style="width: 150px; height: 150px;"
      >
      <div style="margin-top: 10px; color: #666;">
        二维码预览
      </div>
    </div>
    <div
      v-if="qrCodeList.length > 0"
      style="margin-top: 20px; overflow: hidden;"
    >
      <div style="font-weight: bold; margin-bottom: 10px;">
        已保存的二维码
      </div>
      <el-table
        :data="qrCodeList"
        size="small"
        border
        style="width: 100%;"
      >
        <el-table-column
          prop="url"
          label="网址"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          label="二维码"
          width="80"
          align="center"
        >
          <template #default="{ row }">
            <img
              :src="row.dataUrl"
              alt="二维码"
              style="width: 50px; height: 50px;"
            >
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="70"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.isDefault"
              type="success"
            >
              已应用
            </el-tag>
            <span
              v-else
              style="color: #999;"
            >
              未应用
            </span>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="140"
          align="center"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              text
              @click="applyQrCode(row)"
            >
              {{ row.isDefault ? '已应用' : '应用' }}
            </el-button>
            <el-button
              size="small"
              type="warning"
              text
              @click="editQrCode(row)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              text
              @click="deleteQrCode(row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <el-button @click="qrCodeDialogVisible = false">
        取消
      </el-button>
      <el-button
        type="success"
        :loading="qrCodeLoading"
        :disabled="!qrCodeDataUrl"
        @click="saveQrCode"
      >
        保存二维码
      </el-button>
      <el-button
        type="primary"
        :loading="qrCodeLoading"
        @click="generateQrCode"
      >
        生成二维码
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { get, post, del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import QRCode from 'qrcode'
import { addTextToQrCode } from '../utils'
import type { QrCodeItem } from '../utils'

const qrCodeDialogVisible = ref(false)
const qrCodeLoading = ref(false)
const qrCodeFormRef = ref<FormInstance>()
const qrCodeForm = reactive({
  url: '',
  centerText: '',
  topText: ''
})
const qrCodeDataUrl = ref('')
const qrCodeList = ref<QrCodeItem[]>([])

const qrCodeFormRules: FormRules = {
  url: [
    { required: true, message: '请输入网址链接', trigger: 'blur' },
    { type: 'url', message: '请输入有效的网址', trigger: 'blur' }
  ]
}

const loadQrCodeList = async () => {
  try {
    const res = await get<QrCodeItem[]>('/admin/qrcodes')
    qrCodeList.value = res.data || []
  } catch (error) {
    logger.error('加载二维码列表失败:', error)
    qrCodeList.value = []
  }
}

// 打开弹窗
const open = () => {
  loadQrCodeList()
  qrCodeDialogVisible.value = true
}

const resetQrCodeForm = () => {
  qrCodeForm.url = ''
  qrCodeDataUrl.value = ''
}

const generateQrCode = async () => {
  if (!qrCodeForm.url) {
    ElMessage.warning('请输入网址链接')
    return
  }
  qrCodeLoading.value = true
  try {
    const baseQrCode = await QRCode.toDataURL(qrCodeForm.url, {
      width: 200,
      margin: 2
    })
    qrCodeDataUrl.value = await addTextToQrCode(baseQrCode, qrCodeForm.topText, qrCodeForm.centerText)
    ElMessage.success('二维码生成成功')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '二维码生成失败'))
  } finally {
    qrCodeLoading.value = false
  }
}

const saveQrCode = async () => {
  if (!qrCodeDataUrl.value || !qrCodeForm.url) {
    ElMessage.warning('请先生成二维码')
    return
  }

  try {
    await post('/admin/qrcodes', {
      url: qrCodeForm.url,
      dataUrl: qrCodeDataUrl.value,
      centerText: qrCodeForm.centerText,
      topText: qrCodeForm.topText,
      isDefault: qrCodeList.value.length === 0
    })
    await loadQrCodeList()
    const defaultQrCode = qrCodeList.value.find(item => item.isDefault)
    if (defaultQrCode) {
      qrCodeDataUrl.value = defaultQrCode.dataUrl
    }
    ElMessage.success('二维码保存成功')
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 409) {
      ElMessage.warning('该网址的二维码已存在')
    } else {
      ElMessage.error(getErrorMessage(error, '保存失败'))
    }
  }
}

const applyQrCode = async (item: QrCodeItem) => {
  try {
    await post(`/admin/qrcodes/${item.id}/apply`)
    await loadQrCodeList()
    qrCodeDataUrl.value = item.dataUrl
    ElMessage.success('二维码已应用，一键派单将使用该二维码')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '应用失败'))
  }
}

const deleteQrCode = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除该二维码吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await del(`/admin/qrcodes/${id}`)
    await loadQrCodeList()
    const defaultQrCode = qrCodeList.value.find(item => item.isDefault)
    qrCodeDataUrl.value = defaultQrCode?.dataUrl || ''
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const editQrCode = (item: QrCodeItem) => {
  qrCodeForm.url = item.url
  qrCodeForm.topText = item.topText || ''
  qrCodeForm.centerText = item.centerText || ''
  qrCodeDataUrl.value = item.dataUrl
}

onMounted(() => {
  loadQrCodeList()
  const defaultQrCode = qrCodeList.value.find(item => item.isDefault)
  if (defaultQrCode) {
    qrCodeDataUrl.value = defaultQrCode.dataUrl
  }
})

defineExpose({ open, dataUrl: qrCodeDataUrl })
</script>
