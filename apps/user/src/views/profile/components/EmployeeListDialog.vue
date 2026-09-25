<template>
  <!-- 员工列表弹窗 -->
  <van-popup
    :show="show"
    position="center"
    :style="{ width: '90%', maxWidth: '420px', height: '75%', borderRadius: '16px', overflow: 'hidden' }"
    @update:show="emit('update:show', $event)"
  >
    <div class="employee-list-dialog">
      <div class="dialog-header">
        <div class="header-icon">
          <van-icon
            name="users"
            size="24"
          />
        </div>
        <h3>员工子账户列表</h3>
        <van-icon
          name="cross"
          class="close-icon"
          @click="emit('update:show', false)"
        />
      </div>
      <div class="dialog-content">
        <van-loading
          v-if="loading && employees.length === 0"
          class="loading-center"
        />
        <van-list
          :loading="loading"
          :finished="finished"
          finished-text="没有更多了"
          class="employee-list"
          @update:loading="emit('update:loading', $event)"
          @load="emit('load')"
        >
          <van-cell
            v-for="emp in employees"
            :key="emp.id"
            class="employee-item"
          >
            <template #icon>
              <div class="employee-avatar">
                <van-icon
                  name="user-o"
                  size="20"
                />
              </div>
            </template>
            <template #title>
              <div class="employee-name">
                {{ emp.nickname }}
              </div>
              <div class="employee-phone">
                {{ maskPhone(emp.phone) }}
              </div>
            </template>
            <template #right-icon>
              <div class="employee-actions">
                <van-icon
                  name="edit"
                  size="18"
                  color="#1989fa"
                  @click="emit('edit', emp)"
                />
                <van-icon
                  name="delete"
                  size="18"
                  color="#ee0a24"
                  @click="handleDeleteEmployee(emp)"
                />
              </div>
            </template>
          </van-cell>
        </van-list>
        <div
          v-if="!loading && employees.length === 0"
          class="empty-tip"
        >
          <div class="empty-icon">
            <van-icon
              name="user-o"
              size="56"
            />
          </div>
          <p class="empty-text">
            暂无员工子账户
          </p>
          <p class="empty-hint">
            点击下方按钮添加员工
          </p>
        </div>
      </div>
      <div class="dialog-footer">
        <van-button
          type="primary"
          block
          class="add-employee-btn"
          @click="emit('add')"
        >
          添加员工
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { showDialog, showToast } from 'vant'
import { del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { maskPhone } from '../utils'
import type { Employee } from '@promo/shared/types'

defineProps<{
  show: boolean
  employees: Employee[]
  loading: boolean
  finished: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:loading': [value: boolean]
  load: []
  edit: [emp: Employee]
  add: []
  refresh: []
}>()

// 删除员工
const handleDeleteEmployee = async (emp: Employee) => {
  try {
    await showDialog({
      title: '确认删除',
      message: `确定要删除员工「${emp.nickname}」吗？`,
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ee0a24'
    })

    const res = await del(`/employees/${emp.id}`)
    if (res.code === 0) {
      showToast('删除成功')
      emit('refresh')
    } else {
      showToast(res.message || '删除失败')
    }
  } catch (e) {
    if ((e as { message?: unknown })?.message !== 'cancel') {
      showToast(getErrorMessage(e, '删除失败'))
    }
  }
}
</script>

<style scoped lang="scss">
// 员工列表弹窗
.employee-list-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
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
    flex: 1;
    overflow: hidden;
    padding: 16px;
    position: relative;

    .loading-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .employee-list {
      height: 100%;
      padding-bottom: 16px;
    }

    .employee-item {
      margin-bottom: 12px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      background: #fff;

      .employee-avatar {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%);
        border-radius: 50%;
        color: #1989fa;
        font-size: 18px;
      }

      .employee-name {
        font-size: 15px;
        font-weight: 600;
        color: #323233;
        margin-bottom: 4px;
      }

      .employee-phone {
        font-size: 13px;
        color: #969799;
      }

      .employee-actions {
        display: flex;
        gap: 16px;

        :deep(.van-icon) {
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;

          &:active {
            transform: scale(0.95);
            background: rgba(0, 0, 0, 0.05);
          }
        }
      }
    }

    .empty-tip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px 20px;

      .empty-icon {
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f5f7fa 0%, #e8eaed 100%);
        border-radius: 50%;
        color: #c8c9cc;
        margin-bottom: 20px;
      }

      .empty-text {
        font-size: 16px;
        color: #646566;
        margin: 0 0 8px 0;
      }

      .empty-hint {
        font-size: 13px;
        color: #969799;
        margin: 0;
      }
    }
  }

  .dialog-footer {
    padding: 0 24px 24px;

    .add-employee-btn {
      border-radius: 12px;
      height: 46px;
      font-size: 16px;
      font-weight: 500;
      background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
      border: none;
      box-shadow: 0 4px 16px rgba(25, 137, 250, 0.35);

      &:active {
        transform: scale(0.98);
      }
    }
  }
}
</style>
