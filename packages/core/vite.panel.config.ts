import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

import { resolveConfig } from './src/config'
import { discoverTemplateRoutes, ensureConventions } from './src/conventions/registry'
import { ensureDevCss } from './src/dev/css-watch'
import { registerDataWatch } from './src/dev/data-watch'
import { registerMockApi } from './src/dev/mock-api'
import { registerSandboxMiddleware, sandboxPlugin } from './src/dev/sandbox'
import { tailwindCssAlias, tailwindSourceScopePlugin } from './src/tailwind'

/**
 * 面板源码调试时直连 examples 的完整 ktr 后端：
 * 约定扫描（.ktr 注册表）+ SSR 样式缓存 + 沙盒中间件 + mock API + 数据文件 SSE。
 * 这样 `pnpm panel` 单进程同时具备面板源码 HMR 和真实示例数据，
 * 改面板代码不再需要先 build:panel 再重启 examples 的 demo。
 */
const examplesRoot = path.resolve(import.meta.dirname, 'examples')

/** examples 后端的中间件挂载与启动初始化（仅 dev server 生效，build:panel 时不执行）。 */
const ktrExamplesBackend = (): Plugin => ({
  name: 'ktr-examples-backend',
  async configureServer(server) {
    const config = await resolveConfig({ cwd: examplesRoot })
    await ensureConventions(config)
    await ensureDevCss(config)
    // vite root 是 panel/，chokidar 默认覆盖不到 examples；
    // 显式加入模板目录，新增/删除模板才能触发 sandboxPlugin 的 full-reload。
    server.watcher.add(config.templateDir)
    registerMockApi(server, config)
    registerDataWatch(server, config)
    registerSandboxMiddleware(server)
  }
})

export default defineConfig(async () => {
  const config = await resolveConfig({ cwd: examplesRoot })

  // 沙盒里的示例组件在浏览器环境评估，必须命中包 exports 的 browser 入口（dist/client.mjs）；
  // 缺少产物时面板会一直「等待模板注册」，先跑一次 pnpm build:runtime 即可。
  const browserClientEntry = path.resolve(import.meta.dirname, 'dist/client.mjs')
  if (!fs.existsSync(browserClientEntry)) {
    console.warn('[vite.panel.config] 未找到 dist/client.mjs，请先执行 pnpm build:runtime，否则沙盒无法加载模板运行时')
  }

  // 交给 Vite 依赖扫描器的模板入口（posix 相对路径，基准是 vite root=panel）：
  // 沙盒是虚拟模块，预扫描进不去，不显式声明会在注册过程中反复触发 full-reload。
  const panelRoot = path.resolve(import.meta.dirname, 'panel')
  const toScanEntry = (absolute: string): string => path.relative(panelRoot, absolute).replace(/\\/g, '/')
  const routes = await discoverTemplateRoutes(config.templateDir)
  const templateEntries = [
    ...routes.map((route) => toScanEntry(path.join(config.templateDir, route.file))),
    ...(config.cssEntry ? [toScanEntry(config.cssEntry)] : [])
  ]

  return {
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
      // CSS 入口含 @source 时必须改写为 source(none)，否则 Tailwind 以 panel 为基准扫错目录。
      tailwindSourceScopePlugin(config.cssEntry ?? path.join(config.templateDir, 'style.css')),
      tailwindcss(),
      sandboxPlugin(config),
      ktrExamplesBackend()
    ],
    resolve: {
      alias: [tailwindCssAlias, { find: /^@karinjs\/template-react$/, replacement: browserClientEntry }]
    },
    optimizeDeps: {
      entries: templateEntries,
      // 虚拟模块自身 import 的运行时同样扫不到，必须显式声明。
      include: ['react', 'react-dom/client'],
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
