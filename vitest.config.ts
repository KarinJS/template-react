import { defineConfig } from 'vitest/config'

export default defineConfig({
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
