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
                  color="#8A5222"
                  @click="emit('edit', emp)"
                />
                <van-icon
                  name="delete"
                  size="18"
                  color="#9C382D"
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
      confirmButtonColor: '#9C382D'
    })

    const res = await del(`/employees/${emp.id}`)
    if (res.code === 0) {
      showToast('删除成功')
      emit('refresh')
    } else {
      showToast(res.message || '删除失败')
    }
  } catch (e) {
    // Vant showDialog 取消时以字符串 'cancel' reject，不属于错误
    if (e !== 'cancel') {
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
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-pop);

  .dialog-header {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    background: var(--mast);

    .header-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(216, 176, 122, 0.18);
      border-radius: 50%;
      margin-right: 12px;
      color: var(--tabbar-active);
    }

    h3 {
      flex: 1;
      font-size: 18px;
      font-weight: 650;
      color: var(--on-dark);
      margin: 0;
    }

    .close-icon {
      font-size: 20px;
      color: rgba(247, 235, 216, 0.8);
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;

      &:hover {
        color: var(--on-dark);
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
      margin-bottom: 10px;
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: none;
      background: var(--surface-2);

      .employee-avatar {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(234, 214, 176, 0.4);
        border-radius: 50%;
        color: var(--brand);
        font-size: 18px;
      }

      .employee-name {
        font-size: 15px;
        font-weight: 650;
        color: var(--ink);
        margin-bottom: 4px;
      }

      .employee-phone {
        font-size: 13px;
        color: var(--muted);
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
        background: var(--surface-2);
        border-radius: 50%;
        color: var(--faint);
        margin-bottom: 20px;
      }

      .empty-text {
        font-size: 16px;
        color: var(--ink-2);
        margin: 0 0 8px 0;
      }

      .empty-hint {
        font-size: 13px;
        color: var(--muted);
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
      background: var(--brand);
      border: none;
      box-shadow: 0 4px 16px rgba(138, 82, 34, 0.28);

      &:active {
        transform: scale(0.98);
      }
    }
  }
}
</style>
