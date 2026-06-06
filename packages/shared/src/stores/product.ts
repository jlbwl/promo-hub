/**
 * 产品 Store
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Product, PaginatedResponse, PaginationParams } from '../types/index.js'
import { get, post, put, del } from '../utils/request.js'

export const useProductStore = defineStore('product', () => {
  const products = ref<Product[]>([])
  const currentProduct = ref<Product | null>(null)
  const total = ref(0)
  const loading = ref(false)

  async function fetchProducts(params: PaginationParams & { status?: string; keyword?: string }) {
    loading.value = true
    try {
      const res = await get<PaginatedResponse<Product>>('/products', params)
      products.value = res.data.list
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchProduct(id: string) {
    const res = await get<Product>(`/products/${id}`)
    currentProduct.value = res.data
    return res.data
  }

  async function createProduct(data: Partial<Product>) {
    const res = await post<Product>('/products', data)
    return res.data
  }

  async function updateProduct(id: string, data: Partial<Product>) {
    const res = await put<Product>(`/products/${id}`, data)
    return res.data
  }

  async function deleteProduct(id: string) {
    await del(`/products/${id}`)
  }

  return {
    products,
    currentProduct,
    total,
    loading,
    fetchProducts,
    fetchProduct,
    createProduct,
    updateProduct,
    deleteProduct,
  }
})
