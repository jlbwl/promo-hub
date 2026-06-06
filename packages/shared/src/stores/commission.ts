/**
 * 佣金 Store
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Commission, CommissionSummary, PaginatedResponse, PaginationParams } from '../types/index.js'
import { get, post } from '../utils/request.js'

export const useCommissionStore = defineStore('commission', () => {
  const commissions = ref<Commission[]>([])
  const summary = ref<CommissionSummary>({ total: 0, pending: 0, approved: 0, paid: 0 })
  const total = ref(0)
  const loading = ref(false)

  async function fetchCommissions(params: PaginationParams & { status?: string }) {
    loading.value = true
    try {
      const res = await get<PaginatedResponse<Commission>>('/commissions', params)
      commissions.value = res.data.list
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchSummary() {
    const res = await get<CommissionSummary>('/commissions/summary')
    summary.value = res.data
    return res.data
  }

  async function approveCommission(id: string) {
    await post(`/commissions/${id}/approve`)
  }

  async function rejectCommission(id: string, reason: string) {
    await post(`/commissions/${id}/reject`, { reason })
  }

  async function claimCommission(id: string) {
    await post(`/commissions/${id}/claim`)
  }

  return {
    commissions,
    summary,
    total,
    loading,
    fetchCommissions,
    fetchSummary,
    approveCommission,
    rejectCommission,
    claimCommission,
  }
})
