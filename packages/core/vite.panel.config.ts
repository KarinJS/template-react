import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { defineConfig } from 'vite'

import { tailwindCssAlias } from './src/tailwind'

export default defineConfig({
  root: 'panel',
  // launch.json 的 Test Panel 写死 5173：端口被占用（通常是强杀 pnpm 后残留的僵尸 vite）
  // 时直接报错，避免悄悄顺延到 5174 之后浏览器打开 5173 打到僵尸进程上一直白屏。
  server: {
    port: 5173,
    strictPort: true
  },
  plugins: [
    // code-inspector 必须放在最前（在 react 之前）：为面板自身开发注入 data-insp-path 源码定位属性，
    // Shift+Alt+点击面板组件即可跳转 IDE 对应源码；仅 dev 生效，构建产物不受影响。
    codeInspectorPlugin({ bundler: 'vite', showSwitch: true, hotKeys: ['shiftKey', 'altKey'] }),
    react(),
    tailwindcss()
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
})
