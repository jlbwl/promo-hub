<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuth } from './composables/useAuth'

// 初始化认证状态
const { checkAuth } = useAuth()

// 页面加载时检查认证状态
onMounted(async () => {
  console.log('[App] 初始化，检查认证状态...')
  await checkAuth()
  console.log('[App] 认证状态检查完成')
})
</script>

<style>
/* 根组件无需额外样式，全局样式在 global.scss 中定义 */
</style>
