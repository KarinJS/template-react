import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createServer, mergeConfig, type InlineConfig } from 'vite'

import { resolveKtrViteConfig } from '../config/vite'
import { discoverTemplateRoutes, ensureConventions } from '../conventions/registry'
import { tailwindCssAlias, tailwindSourceScopePlugin } from '../tailwind'
import type { DevServerHandle, ResolvedKtrConfig } from '../types'
import { clearScreen, printStartupDetail } from './banner'
import { ensureDevCss } from './css-watch'
import { registerDataWatch } from './data-watch'
import { registerMockApi } from './mock-api'
import { registerPanelMiddleware } from './panel-middleware'
import { findPortHolders, isPortInUse, killCommands, type PortHolder } from './port'
import { registerSandboxMiddleware, sandboxPlugin } from './sandbox'

/**
 * 解析 ktr 浏览器端入口（dist/client.mjs）的绝对路径。
 * sandbox 里的用户组件在浏览器环境评估，必须命中包 exports 的 browser 入口；
 * 部分 vite 版本的依赖预打包不应用 browser 条件，会把 node 入口（tsx/node:os 等）打进浏览器包，
 * 模块求值即崩溃（面板表现为一直「等待模板注册」）。这里在 dev server 内部用 alias 显式钉住，下游零处理。
 * @returns 浏览器端入口文件的绝对路径。
 */
const resolveBrowserClientEntry = (): string => {
  // 打包产物 dist/ 内 chunk 平铺，client.mjs 与当前 chunk 同级
  const bundled = fileURLToPath(new URL('./client.mjs', import.meta.url))
  if (fs.existsSync(bundled)) {
    return bundled
  }
  // ktr 自身开发/测试直跑源码时的兜底：向上找包根再拼 dist/client.mjs
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        if (JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).name === '@karinjs/template-react') {
          return path.join(dir, 'dist', 'client.mjs')
        }
      } catch {
        // package.json 解析失败时继续向上找
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return bundled
}

/**
 * 创建 ktr 开发服务：先同步约定产物，再挂载面板、sandbox 和 mock API。
 * @param config 已解析的 ktr 配置。
 * @returns 开发服务句柄，包含面板地址和关闭方法。
 */
export const createDevServer = async (config: ResolvedKtrConfig): Promise<DevServerHandle> => {
  const startedAt = Date.now()
  await ensureConventions(config)
  await ensureDevCss(config)

  // 端口占用要在 listen 之前查：Vite 回退到新端口后，原端口的占用进程信息就问不出来了。
  const requestedPort = config.dev.port
  const portBusy = await isPortInUse(requestedPort, config.dev.host)
  const holders: PortHolder[] = portBusy ? await findPortHolders(requestedPort) : []

  // 交给 Vite 依赖扫描器的模板入口，用 posix 相对路径（tinyglobby 不接受 Windows 反斜杠）。
  // 同时带上 CSS 入口，模板样式里 @import 的第三方包也能在启动阶段一并发现。
  const routes = await discoverTemplateRoutes(config.templateDir)
  const toScanEntry = (absolute: string): string => path.relative(config.root, absolute).replace(/\\/g, '/')
  const templateEntries = [
    ...routes.map((route) => toScanEntry(path.join(config.templateDir, route.file))),
    ...(config.cssEntry ? [toScanEntry(config.cssEntry)] : [])
  ]

  const baseConfig: InlineConfig = {
    root: config.root,
    appType: 'custom',
    // 静态资源目录即 vite 的 publicDir：/image/* 这类根路径引用直接从这里出。
    publicDir: config.assetsDir,
    // 不加载下游项目自己的 vite.config.ts（那是生产打包配置），扩展统一走 karin.template.ts 的 vite 字段。
    configFile: false,
    clearScreen: false,
    // 内部插件分工：code-inspector 源码定位、React JSX 编译、Tailwind v4 编译、iframe 沙盒虚拟模块。
    plugins: [
      // code-inspector 必须放在最前（在 react 之前）：它为 JSX 注入 data-insp-path 源码定位属性。
      // showSwitch 关闭页面角落的悬浮图标——下游统一走面板工具栏的「定位」开关进入检查模式；
      // hideConsole 关掉它打印的热键提示（热键由面板桥接接管，原提示会误导）。
      // 注意：面板自身开发（vite.panel.config.ts）仍保留悬浮图标，方便直接点选面板组件。
      codeInspectorPlugin({ bundler: 'vite', showSwitch: false, hideConsole: true, hotKeys: ['shiftKey', 'altKey'] }),
      react(),
      tailwindSourceScopePlugin(config.cssEntry ?? path.join(config.templateDir, 'style.css')),
      tailwindcss(),
      sandboxPlugin(config)
    ],
    resolve: {
      alias: [tailwindCssAlias, { find: /^@karinjs\/template-react$/, replacement: resolveBrowserClientEntry() }]
    },
    optimizeDeps: {
      // 沙盒是虚拟模块，Vite 的依赖预扫描进不去，模板依赖只能等运行时逐个 import 时才被发现。
      // 那样每注册几个模板就触发一次「optimized dependencies changed → full-reload」，
      // 沙盒被整页刷掉，registerTemplates 从头再来，表现为侧边栏进度条反复倒转回零。
      // 这里把模板入口显式交给扫描器，启动时一次性把依赖打包完，注册过程中不再有 reload。
      entries: templateEntries,
      // 虚拟模块自身 import 的运行时同样扫不到，必须显式声明，否则沙盒首次加载就会触发一次 reload。
      include: ['react', 'react-dom/client'],
      // Tailwind oxide 是原生二进制，预打包会破坏其加载路径，直接排除。
      exclude: [
        '@tailwindcss/oxide',
        '@tailwindcss/oxide-win32-arm64-msvc',
        '@tailwindcss/oxide-win32-ia32-msvc',
        '@tailwindcss/oxide-win32-x64-msvc'
      ]
    },
    server: {
      host: config.dev.host,
      port: config.dev.port,
      open: config.dev.open ? '/__ktr/panel/' : false
    }
  }

  // 用户 karin.template.ts 的 vite 字段在这里合并进内部配置，是下游的扩展位。
  const server = await createServer(mergeConfig(baseConfig, await resolveKtrViteConfig(config, 'serve', 'development')))

  registerMockApi(server, config)
  // 监听 mock 数据文件变更，通过 WebSocket 推送面板自动刷新。
  registerDataWatch(server, config)
  registerSandboxMiddleware(server)
  registerPanelMiddleware(server)

  await server.listen()
  const urls = server.resolvedUrls?.local ?? []
  const baseUrl = urls[0] ?? `http://${config.dev.host}:${config.dev.port}/`
  const url = new URL('/__ktr/panel/', baseUrl).toString()
  // 端口回退后 server.config.server.port 仍是期望值，实际端口只能从 resolvedUrls 解析。
  const actualPort = Number(new URL(baseUrl).port) || requestedPort

  // 清屏放在 listen 之后：依赖预打包、CSS 构建的进度输出都发生在这之前，
  // 先清掉再打印详情，用户一眼看到的就是地址而不是几十行 optimizer 日志。
  clearScreen()
  printStartupDetail({
    panelUrl: url,
    networkUrls: (server.resolvedUrls?.network ?? []).map((item) => new URL('/__ktr/panel/', item).toString()),
    templateCount: routes.length,
    port: actualPort,
    requestedPort,
    elapsed: Date.now() - startedAt,
    // 端口没被占用时不展示冲突块；被占用但查不到进程时仍给出通用查杀命令。
    ...(portBusy
      ? {
          portConflict: {
            holders: holders.map((holder) => (holder.name ? `${holder.name}(${holder.pid})` : `PID ${holder.pid}`)),
            commands: killCommands(requestedPort, holders)
          }
        }
      : {})
  })

  return {
    url,
    close: () => server.close()
  }
}
