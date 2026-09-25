const js = require('@eslint/js')
const globals = require('globals')
const pluginVue = require('eslint-plugin-vue')
const tseslint = require('@typescript-eslint/eslint-plugin')
const tsparser = require('@typescript-eslint/parser')
const vueParser = require('vue-eslint-parser')

module.exports = [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        WorkerGlobalScope: 'readonly',
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // 通用规则 - 宽松一些，避免过多检查
      // 渐进治理：禁止新增 console 调用，统一使用 @promo/shared/utils/logger（logger.ts 内部已豁免）
      'no-console': 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-setter-return': 'off',

      // TypeScript规则
      '@typescript-eslint/no-unused-vars': 'off',
      // 渐进类型治理：新代码禁 any（warning 提示存量逐步收敛，不阻塞 CI）
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        WorkerGlobalScope: 'readonly',
      },
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tsparser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // 通用规则 - 宽松一些，避免过多检查
      // 渐进治理：禁止新增 console 调用，统一使用 @promo/shared/utils/logger
      'no-console': 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-cond-assign': 'off',
      'no-useless-escape': 'off',
      'no-control-regex': 'off',
      'no-setter-return': 'off',

      // TypeScript规则
      '@typescript-eslint/no-unused-vars': 'off',
      // 渐进类型治理：新代码禁 any（warning 提示存量逐步收敛，不阻塞 CI）
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // Vue规则
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'dist_*/',
      '**/*.d.ts',
      'coverage/',
      '.turbo/',
      '.git/',
      'apps/**/dist/',
      'apps/**/dist_*/',
      'packages/**/dist/',
      'scripts/',
      'upload-cert.exp',
      'upload-cert.py',
    ],
  },
]
