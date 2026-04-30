/**
 * 用户认证 Store
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, LoginParams, LoginResult } from '../types'
import { post } from '../utils/request'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const userRole = computed(() => user.value?.role)

  async function login(params: LoginParams) {
    const res = await post<LoginResult>('/auth/login', params)
    token.value = res.data.token
    user.value = res.data.user
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('refreshToken', res.data.refreshToken)
    return res.data
  }

  async function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }

  async function fetchCurrentUser() {
    const res = await post<User>('/auth/me')
    user.value = res.data
    return res.data
  }

  return {
    token,
    user,
    isLoggedIn,
    userRole,
    login,
    logout,
    fetchCurrentUser,
  }
})
