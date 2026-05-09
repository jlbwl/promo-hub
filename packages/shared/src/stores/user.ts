/**
 * 用户管理 Store (管理员/经理使用)
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User, Manager, PaginatedResponse, PaginationParams } from '../types'
import { get, post, put, del } from '../utils/request'

export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([])
  const managers = ref<Manager[]>([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchUsers(params: PaginationParams & { keyword?: string; status?: string }) {
    loading.value = true
    try {
      const res = await get<PaginatedResponse<User>>('/users', params)
      users.value = res.data.list
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchManagers(params: PaginationParams & { keyword?: string }) {
    loading.value = true
    try {
      const res = await get<PaginatedResponse<Manager>>('/managers', params)
      managers.value = res.data.list
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }

  async function createUser(data: Partial<User>) {
    const res = await post<User>('/users', data)
    return res.data
  }

  async function updateUser(id: string, data: Partial<User>) {
    const res = await put<User>(`/users/${id}`, data)
    return res.data
  }

  async function deleteUser(id: string) {
    await del(`/users/${id}`)
  }

  return {
    users,
    managers,
    total,
    loading,
    fetchUsers,
    fetchManagers,
    createUser,
    updateUser,
    deleteUser,
  }
})
