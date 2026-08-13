import { defineConfig } from 'vitest/config'

import { scaffoldExamplesPlugin } from './build/scaffold-examples'

export default defineConfig({
  // 与 tsdown 同一个插件：测试里 import 虚拟模块时按同样规则实时扫描 examples。
  plugins: [scaffoldExamplesPlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test-d.ts'],
    typecheck: {
      enabled: true,
      include: ['tests/**/*.test-d.ts']
    }
  }
})
