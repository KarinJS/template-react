import { defineConfig } from 'vitest/config'

import { scaffoldExamplesPlugin } from './packages/core/build/scaffold-examples'

export default defineConfig({
  // 与 packages/core 的 tsdown/vitest 同一个插件：从根目录跑测试时也要能解析示例模板虚拟模块。
  plugins: [scaffoldExamplesPlugin()],
  test: {
    environment: 'node',
    include: ['packages/core/tests/**/*.test.ts', 'packages/core/tests/**/*.test-d.ts'],
    typecheck: {
      enabled: true,
      tsconfig: 'tsconfig.json',
      include: ['packages/core/tests/**/*.test-d.ts']
    }
  }
})
