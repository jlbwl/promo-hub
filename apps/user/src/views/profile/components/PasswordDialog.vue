<template>
  <!-- 设置密码弹窗 -->
  <van-popup
    :show="visible"
    position="center"
    :style="{ width: '90%', maxWidth: '360px' }"
    @update:show="visible = $event"
  >
    <div class="password-dialog">
      <div class="dialog-header">
        <h3>设置登录密码</h3>
        <van-icon
          name="cross"
          @click="visible = false"
        />
      </div>
      <div class="dialog-content">
        <van-cell-group inset>
          <van-cell
            title="当前手机号"
            :value="phone"
          />
          <van-field
            v-model="passwordForm.code"
            type="digit"
            label="验证码"
            placeholder="请输入验证码"
            maxlength="6"
            clearable
          >
            <template #button>
              <van-button
                size="small"
                type="primary"
                :disabled="smsCooldown > 0"
                :text="smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码'"
                style="min-width: 90px;"
                @click="handleSendPasswordSms"
              />
            </template>
          </van-field>
          <van-field
            v-model="passwordForm.password"
            type="password"
            label="新密码"
            placeholder="请设置6位以上密码"
            clearable
          />
          <van-field
            v-model="passwordForm.confirmPassword"
            type="password"
            label="确认密码"
            placeholder="请再次输入密码"
            clearable
          />
        </van-cell-group>
      </div>
      <div class="dialog-footer">
        <van-button
          plain
          type="default"
          block
          @click="visible = false"
        >
          稍后设置
        </van-button>
        <van-button
          type="primary"
          block
          @click="handleSetPassword"
        >
          确认设置
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { showToast } from 'vant'
import { post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'

const props = defineProps<{
  phone: string
}>()

// 弹窗可见性
const visible = ref(false)

// 设置密码表单
const passwordForm = reactive({
  code: '',
  password: '',
  confirmPassword: ''
})

// 短信验证码倒计时
const smsCooldown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

// 打开弹窗并重置表单
const open = () => {
  passwordForm.code = ''
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  visible.value = true
}

// 发送验证码（用于设置密码）
const handleSendPasswordSms = async () => {
  if (!props.phone) return showToast('获取手机号失败')
  if (!/^1[3-9]\d{9}$/.test(props.phone)) return showToast('手机号格式不正确')

  try {
    await post('/users/sms/send', { phone: props.phone })
    showToast('验证码已发送')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0 && smsTimer) { clearInterval(smsTimer); smsTimer = null }
    }, 1000)
  } catch (e) {
    showToast(getErrorMessage(e, '发送失败'))
  }
}

// 设置密码
const handleSetPassword = async () => {
  if (!passwordForm.code) return showToast('请输入验证码')
  if (!passwordForm.password) return showToast('请输入新密码')
  if (passwordForm.password.length < 6) return showToast('密码长度至少6位')
  if (passwordForm.password !== passwordForm.confirmPassword) return showToast('两次输入的密码不一致')

  try {
    await post('/users/password/set', {
      phone: props.phone,
      code: passwordForm.code,
      password: passwordForm.password
    })
    showToast('密码设置成功')
    visible.value = false
  } catch (e) {
    showToast(getErrorMessage(e, '设置失败'))
  }
}

defineExpose({ open })
</script>

<style scoped lang="scss">
// 设置密码弹窗
.password-dialog {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin: 0;
    }

    :deep(.van-icon) {
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

  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 24px 24px;

    :deep(.van-button) {
      border-radius: 10px;
      height: 44px;
      font-size: 15px;
    }
  }
}
</style>
