import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ViteDevServer } from 'vite'

import { resolveConfig } from './src/config'
import { registerMockApi } from './src/dev/mock-api'
import { registerSandboxMiddleware, sandboxPlugin } from './src/dev/sandbox'
import { tailwindCssAlias } from './src/tailwind'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureRoot = path.resolve(currentDir, '../karin-plugin-ts')

export default defineConfig(async () => {
  const fixtureConfig = await resolveConfig({ cwd: fixtureRoot })

  return {
    root: 'panel',
    plugins: [
      react(),
      tailwindcss(),
      sandboxPlugin(fixtureConfig),
      {
        name: 'ktr-panel-fixture-dev',
        configureServer(server: ViteDevServer) {
          registerMockApi(server, fixtureConfig)
          registerSandboxMiddleware(server)
        }
      }
    ],
    resolve: {
      alias: [tailwindCssAlias]
    },
    optimizeDeps: {
      exclude: [
        '@tailwindcss/oxide',
        '@tailwindcss/oxide-win32-arm64-msvc',
        '@tailwindcss/oxide-win32-ia32-msvc',
        '@tailwindcss/oxide-win32-x64-msvc'
      ]
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false
    }
  }
})
