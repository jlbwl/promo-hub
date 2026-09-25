<template>
  <!-- 创建员工子账户弹窗 -->
  <van-popup
    :show="visible"
    position="center"
    :style="{ width: '90%', maxWidth: '420px', borderRadius: '16px', overflow: 'hidden' }"
    @update:show="visible = $event"
  >
    <div class="employee-dialog">
      <div class="dialog-header">
        <div class="header-icon">
          <van-icon
            name="user-o"
            size="24"
          />
        </div>
        <h3>{{ editingEmployee ? '编辑员工' : '创建员工子账户' }}</h3>
        <van-icon
          name="cross"
          class="close-icon"
          @click="close"
        />
      </div>
      <div class="dialog-content">
        <van-cell-group
          inset
          class="form-group"
        >
          <van-field
            v-model="employeeForm.phone"
            type="tel"
            label="员工手机号"
            placeholder="请输入员工手机号"
            maxlength="11"
            class="form-field"
            :readonly="!!editingEmployee"
            :disabled="!!editingEmployee"
          >
            <template #left-icon>
              <van-icon
                name="phone"
                size="16"
                color="#1989fa"
              />
            </template>
            <template
              v-if="editingEmployee"
              #right-icon
            >
              <span class="readonly-tip">不可修改</span>
            </template>
          </van-field>
          <van-field
            v-model="employeeForm.password"
            type="password"
            label="登录密码"
            placeholder="请设置6位以上密码"
            class="form-field"
          >
            <template #left-icon>
              <van-icon
                name="lock"
                size="16"
                color="#1989fa"
              />
            </template>
          </van-field>
          <van-field
            v-model="employeeForm.nickname"
            type="text"
            label="员工昵称"
            placeholder="默认为员工+手机号后四位"
            class="form-field"
          >
            <template #left-icon>
              <van-icon
                name="user-o"
                size="16"
                color="#1989fa"
              />
            </template>
          </van-field>
          <van-field
            v-model="employeeForm.expiresHours"
            type="digit"
            label="登录有效期"
            placeholder="请输入有效期，至少1小时"
            class="form-field"
          >
            <template #left-icon>
              <van-icon
                name="clock-o"
                size="16"
                color="#1989fa"
              />
            </template>
            <template #right-icon>
              <span class="unit">小时</span>
            </template>
          </van-field>
        </van-cell-group>
        <div class="expire-tips">
          <van-icon
            name="info-o"
            size="16"
            color="#1989fa"
          />
          <div class="tips-content">
            <p>员工账户有效期到期后将自动失效</p>
            <p>员工做单业绩将归属于您的账户</p>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <van-button
          plain
          type="default"
          block
          class="btn-cancel"
          @click="close"
        >
          取消
        </van-button>
        <van-button
          type="primary"
          block
          class="btn-confirm"
          @click="handleCreateEmployee"
        >
          {{ editingEmployee ? '保存修改' : '创建账户' }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { showToast } from 'vant'
import { post, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { ApiResponse, Employee } from '@promo/shared/types'

const props = defineProps<{
  userId: string
}>()

const emit = defineEmits<{
  success: []
}>()

// 弹窗可见性
const visible = ref(false)
const editingEmployee = ref<Employee | null>(null)

// 员工表单
const employeeForm = reactive({
  phone: '',
  password: '',
  nickname: '',
  expiresHours: '24'
})

// 打开弹窗（传入员工则为编辑模式）
const open = (emp?: Employee) => {
  editingEmployee.value = emp ?? null
  employeeForm.phone = emp?.phone || ''
  employeeForm.password = ''
  employeeForm.nickname = emp?.nickname || ''
  employeeForm.expiresHours = '24'
  visible.value = true
}

// 关闭弹窗并重置表单
const close = () => {
  visible.value = false
  editingEmployee.value = null
  employeeForm.phone = ''
  employeeForm.password = ''
  employeeForm.nickname = ''
  employeeForm.expiresHours = '24'
}

// 创建或更新员工子账户
const handleCreateEmployee = async () => {
  // 创建时验证手机号
  if (!editingEmployee.value) {
    if (!employeeForm.phone || !/^1[3-9]\d{9}$/.test(employeeForm.phone)) {
      return showToast('请输入正确的手机号')
    }
    if (!employeeForm.password || employeeForm.password.length < 6) {
      return showToast('密码至少6位')
    }
  }

  // 编辑时密码可选，但如果填写了必须至少6位
  if (editingEmployee.value && employeeForm.password && employeeForm.password.length < 6) {
    return showToast('密码至少6位')
  }

  if (!employeeForm.expiresHours || parseInt(employeeForm.expiresHours) < 1) {
    return showToast('有效期至少1小时')
  }

  try {
    let res: ApiResponse<unknown>

    if (editingEmployee.value) {
      // 编辑模式：调用PUT更新，不包含手机号
      res = await put(`/employees/${editingEmployee.value.id}`, {
        password: employeeForm.password,
        nickname: employeeForm.nickname,
        expiresHours: parseInt(employeeForm.expiresHours)
      })
    } else {
      // 创建模式：调用POST
      res = await post('/employees', {
        userId: props.userId,
        phone: employeeForm.phone,
        password: employeeForm.password,
        nickname: employeeForm.nickname,
        expiresHours: parseInt(employeeForm.expiresHours)
      })
    }

    if (res.code === 0) {
      showToast(editingEmployee.value ? '更新成功' : '创建成功')
      close()
      emit('success')
    } else {
      showToast(res.message || (editingEmployee.value ? '更新失败' : '创建失败'))
    }
  } catch (e) {
    showToast(getErrorMessage(e, editingEmployee.value ? '更新失败' : '创建失败'))
  }
}

defineExpose({ open })
</script>

<style scoped lang="scss">
// 创建员工子账户弹窗
.employee-dialog {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);

  .dialog-header {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);

    .header-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      margin-right: 12px;
      color: #fff;
    }

    h3 {
      flex: 1;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin: 0;
    }

    .close-icon {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;

      &:hover {
        color: #fff;
        transform: rotate(90deg);
      }
    }
  }

  .dialog-content {
    padding: 24px;
  }

  .form-group {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 8px 0;
    margin-bottom: 16px;

    .form-field {
      border-bottom: 1px solid #e8e8e8;

      &:last-child {
        border-bottom: none;
      }

      :deep(.van-field__label) {
        font-size: 14px;
        color: #646566;
        width: 72px;
      }

      :deep(.van-field__value) {
        font-size: 14px;
      }

      :deep(.van-field__control) {
        font-size: 14px;
      }
    }
  }

  .expire-tips {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 16px;
    background: #e8f4fd;
    border-radius: 8px;
    border-left: 4px solid #1989fa;

    .tips-content {
      flex: 1;

      p {
        font-size: 12px;
        color: #646566;
        margin: 4px 0;
        line-height: 1.5;
      }
    }
  }

  .unit {
    font-size: 13px;
    color: #969799;
  }

  .readonly-tip {
    font-size: 12px;
    color: #969799;
  }

  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 24px 24px;

    .btn-cancel {
      border-radius: 10px;
      height: 44px;
      font-size: 15px;
      color: #646566;
      background: #f5f5f5;
      border: none;

      &:active {
        background: #e8e8e8;
      }
    }

    .btn-confirm {
      border-radius: 10px;
      height: 44px;
      font-size: 15px;
      font-weight: 500;
      background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
      border: none;
      box-shadow: 0 4px 12px rgba(25, 137, 250, 0.3);

      &:active {
        transform: scale(0.98);
      }
    }
  }
}
</style>
