import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { createServer, mergeConfig, type UserConfig } from 'vite'

import { resolveKtrViteConfig } from '../config/vite'
import { ensureConventions } from '../conventions/registry'
import { tailwindCssAlias } from '../tailwind'
import type { DevServerHandle, ResolvedKtrConfig } from '../types'
import { ensureDevCss } from './css-watch'
import { registerDataWatch } from './data-watch'
import { registerMockApi } from './mock-api'
import { registerPanelMiddleware } from './panel-middleware'
import { registerSandboxMiddleware, sandboxPlugin } from './sandbox'

/**
 * 创建 ktr 开发服务：先同步约定产物，再挂载面板、sandbox 和 mock API。
 * @param config 已解析的 ktr 配置。
 * @returns 开发服务句柄，包含面板地址和关闭方法。
 */
export const createDevServer = async (config: ResolvedKtrConfig): Promise<DevServerHandle> => {
  await ensureConventions(config)
  await ensureDevCss(config)

  const baseConfig: UserConfig = {
    root: config.root,
    appType: 'custom',
    clearScreen: false,
    // 内部插件分工：code-inspector 源码定位、React JSX 编译、Tailwind v4 编译、iframe 沙盒虚拟模块。
    plugins: [
      // code-inspector 必须放在最前（在 react 之前）：它为 JSX 注入 data-insp-path 源码定位属性。
      // showSwitch 关闭页面角落的悬浮图标——下游统一走面板工具栏的「定位」开关进入检查模式；
      // hideConsole 关掉它打印的热键提示（热键由面板桥接接管，原提示会误导）。
      // 注意：面板自身开发（vite.panel.config.ts）仍保留悬浮图标，方便直接点选面板组件。
      codeInspectorPlugin({ bundler: 'vite', showSwitch: false, hideConsole: true, hotKeys: ['shiftKey', 'altKey'] }),
      react(),
      tailwindcss(),
      sandboxPlugin(config)
    ],
    resolve: {
      alias: [tailwindCssAlias]
    },
    optimizeDeps: {
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

  return {
    url,
    close: () => server.close()
  }
}
