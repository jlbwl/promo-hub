import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
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
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './packages/shared/src'),
        '@promo/admin': resolve(__dirname, './apps/admin/src'),
        '@promo/manager': resolve(__dirname, './apps/manager/src'),
        '@promo/user': resolve(__dirname, './apps/user/src'),
        '@promo/shared': resolve(__dirname, './packages/shared/src')
      }
    }
  }
})
