import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // user 端源码存在 `@/composables/*` 自引用，需在 shared 之前精确映射，否则测试无法加载
      '@/composables/useLocalStorage': resolve(__dirname, './apps/user/src/composables/useLocalStorage'),
      '@': resolve(__dirname, './packages/shared/src'),
      '@promo/admin': resolve(__dirname, './apps/admin/src'),
      '@promo/manager': resolve(__dirname, './apps/manager/src'),
      '@promo/user': resolve(__dirname, './apps/user/src'),
      '@promo/shared': resolve(__dirname, './packages/shared/src')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    setupFiles: ['./test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'packages/shared/src/types/**/*.ts',
        'packages/shared/src/utils/**/*.ts',
        'apps/api/src/utils/**/*.ts',
        'apps/api/src/services/**/*.ts'
      ],
      exclude: [
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.{js,ts,tsx}',
        '**/__tests__/**'
      ]
    }
  }
})
