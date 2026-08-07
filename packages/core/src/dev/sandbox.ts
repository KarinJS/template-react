import fs from 'node:fs'
import path from 'node:path'

import type { Plugin, ViteDevServer } from 'vite'

import { templateRegistryPath } from '../conventions/registry'
import type { ResolvedKtrConfig } from '../types'

// Vite 虚拟模块约定：resolve 后的 id 加 \0 前缀，防止被其他插件当作真实文件处理。
const virtualModuleId = 'virtual:ktr-sandbox'
const resolvedVirtualModuleId = `\0${virtualModuleId}`

const normalizePath = (filePath: string): string => filePath.replace(/\\/g, '/')

// 把绝对路径包装成 Vite 的 /@fs/ 导入地址，让 sandbox 模块能引用项目任意位置的文件。
const fsImport = (filePath: string): string => `/@fs/${normalizePath(filePath)}`

/**
 * 确保 sandbox 能独立加载用户模板样式。
 * @param config 已解析的 ktr 配置。
 * @returns CSS 入口的绝对路径，缺失时会写入默认入口。
 */
const ensureCssEntry = (config: ResolvedKtrConfig): string => {
  const cssEntry = config.cssEntry ?? path.join(config.templateDir, 'style.css')
  // 零配置兜底：用户没有 style.css 时写一份带主题 token 映射的默认入口。
  if (!fs.existsSync(cssEntry)) {
    fs.mkdirSync(path.dirname(cssEntry), { recursive: true })
    fs.writeFileSync(
      cssEntry,
      `@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-soft: var(--accent-soft);
  --color-accent-soft-foreground: var(--accent-soft-foreground);
}
`,
      'utf-8'
    )
  }
  return cssEntry
}

/**
 * 生成 iframe sandbox 的虚拟模块代码，用户组件只在这个隔离环境里运行。
 * @param config 已解析的 ktr 配置。
 * @returns sandbox 入口模块的源码字符串。
 */
const sandboxCode = (config: ResolvedKtrConfig): string => {
  const registryPath = templateRegistryPath(config)
  const cssEntry = ensureCssEntry(config)

  // 通过 /@fs/ 绝对路径导入 .ktr 注册表和 CSS 入口，保证 sandbox 总能拿到最新的模板清单和样式。
  return `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { templates } from '${fsImport(registryPath)}'
import '${fsImport(cssEntry)}'

const source = 'ktr-sandbox'
const target = 'ktr-panel'
const rootElement = document.getElementById('root')
const root = createRoot(rootElement)
// 面板只下发显式设置的主题字段（模式 + 可选主题色），框架不发明默认色，组件库自身主题生效。
let selectedPath = Object.keys(templates)[0]
let selectedData = {}
let selectedCtx = { scale: 1, theme: {} }
let hasSelectedData = false
let renderToken = 0

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    postError(selectedPath, error)
  }

  render() {
    if (this.state.error) {
      return React.createElement('pre', { style: { color: '#dc2626', whiteSpace: 'pre-wrap', padding: 24 } }, String(this.state.error?.stack || this.state.error))
    }

    return this.props.children
  }
}

const post = (type, payload) => {
  window.parent.postMessage({ source, type, payload }, window.location.origin)
}

const postError = (path, error) => {
  post('ktr:error', {
    path,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  })
}

const metadata = () => Object.entries(templates).map(([path, def]) => ({
  path,
  name: def.name,
  description: def.description
}))

const isAsyncComponent = (component) => component?.constructor?.name === 'AsyncFunction'

// 主题变量和 dark 类名同时写到 html、body 上，用户组件从哪一级读取都能生效；
// 只注入面板显式提供的字段，其余变量移除，让组件库自身主题生效。
const themeVarNames = [
  ['--background', 'background'],
  ['--foreground', 'foreground'],
  ['--surface', 'surface'],
  ['--muted', 'muted'],
  ['--border', 'border'],
  ['--accent', 'accent'],
  ['--accent-foreground', 'accentForeground'],
  ['--accent-soft', 'accentSoft'],
  ['--accent-soft-foreground', 'accentSoftForeground'],
  ['--ktr-theme-accent', 'accent'],
  ['--ktr-theme-accent-foreground', 'accentForeground'],
  ['--ktr-theme-background', 'background'],
  ['--ktr-theme-foreground', 'foreground'],
  ['--ktr-theme-surface', 'surface'],
  ['--ktr-theme-muted', 'muted'],
  ['--ktr-theme-border', 'border']
]

const applyTheme = () => {
  const theme = selectedCtx.theme || {}
  const mode = theme.mode === 'dark' ? 'dark' : 'light'

  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.body.classList.toggle('dark', mode === 'dark')
  document.documentElement.dataset.theme = mode
  document.body.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
  document.body.style.colorScheme = mode
  for (const [name, key] of themeVarNames) {
    const value = theme[key]
    if (typeof value === 'string' && value) {
      document.documentElement.style.setProperty(name, value)
      document.body.style.setProperty(name, value)
    } else {
      document.documentElement.style.removeProperty(name)
      document.body.style.removeProperty(name)
    }
  }
}

const reportRendered = (startedAt, token) => {
  let lastWidth = 0
  let lastHeight = 0
  let stableFrames = 0
  let frames = 0

  const tick = () => {
    if (token !== renderToken) {
      return
    }

    const container = document.querySelector('#container') || rootElement.firstElementChild || rootElement
    const rect = container.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(rect.width))
    const height = Math.max(1, Math.ceil(rect.height))

    if (width === lastWidth && height === lastHeight) {
      stableFrames += 1
    } else {
      stableFrames = 0
      lastWidth = width
      lastHeight = height
    }

    frames += 1
    // 等待连续几帧尺寸稳定，避免 React/组件库刚切换时把半截高度上报给面板。
    if (stableFrames < 3 && frames < 30) {
      requestAnimationFrame(tick)
      return
    }

    post('ktr:rendered', {
      path: selectedPath,
      elapsed: Math.round(performance.now() - startedAt),
      size: {
        width,
        height
      }
    })
  }

  requestAnimationFrame(tick)
}

const TemplateHost = ({ template, data, ctx, renderId, onRendered }) => {
  const Component = template.component
  const [node, setNode] = React.useState(null)

  React.useLayoutEffect(() => {
    if (isAsyncComponent(Component) && !node) {
      return
    }

    onRendered()
  }, [Component, node, renderId, onRendered])

  React.useEffect(() => {
    if (!isAsyncComponent(Component)) {
      return undefined
    }

    let disposed = false
    setNode(null)
    Promise.resolve(Component({ data, ctx }))
      .then((nextNode) => {
        if (disposed) {
          return
        }
        setNode(nextNode)
      })
      .catch((error) => postError(selectedPath, error))

    return () => {
      disposed = true
    }
  }, [Component, data, ctx, renderId, onRendered])

  if (isAsyncComponent(Component)) {
    return node
  }

  return React.createElement(Component, { data, ctx })
}

// 面板下发主题时整体合并：以 theme.mode 为唯一明暗依据；颜色字段以面板显式下发为准。
const updateTheme = (payload = {}) => {
  const rawTheme = payload && typeof payload === 'object' && payload.theme ? payload.theme : payload
  const theme = {
    ...selectedCtx.theme,
    ...rawTheme
  }

  selectedCtx = {
    ...selectedCtx,
    theme
  }
}

const renderCurrent = () => {
  const startedAt = performance.now()
  const template = templates[selectedPath]
  renderToken += 1
  const currentToken = renderToken
  applyTheme()
  document.documentElement.style.setProperty('--ktr-scale', '1')

  if (!template) {
    postError(selectedPath, new Error('Template is not registered: ' + selectedPath))
    return
  }

  try {
    const onRendered = () => reportRendered(startedAt, currentToken)
    root.render(
      React.createElement(ErrorBoundary, { key: selectedPath + ':' + Date.now() },
        React.createElement(TemplateHost, {
          template,
          data: selectedData,
          ctx: selectedCtx,
          renderId: startedAt,
          onRendered
        })
      )
    )
  } catch (error) {
    postError(selectedPath, error)
  }
}

// 面板消息入口：select 只切换模板，data 触发渲染，theme 在有数据时联动重渲染。
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.data?.source !== target) {
    return
  }

  const { type, payload } = event.data
  if (type === 'ktr:select') {
    selectedPath = payload.path
    selectedData = {}
    hasSelectedData = false
    // 切换模板时丢弃捕获快照带来的扩展字段，仅保留面板主题弹窗选择的 theme。
    selectedCtx = { scale: 1, theme: selectedCtx.theme }
  }
  if (type === 'ktr:data') {
    selectedPath = payload.path
    selectedData = payload.data ?? {}
    hasSelectedData = true
    // 捕获快照（captured.json）携带完整 ctx 时整包回放，真实还原本地渲染时的运行时上下文；
    // 普通 mock 不带 ctx，丢掉上一个快照的扩展字段，但保留面板主题弹窗选择的 theme。
    selectedCtx = payload.ctx && typeof payload.ctx === 'object' ? { scale: 1, ...payload.ctx } : { scale: 1, theme: selectedCtx.theme }
    renderCurrent()
  }
  if (type === 'ktr:theme') {
    updateTheme(payload)
    if (hasSelectedData) {
      renderCurrent()
    }
  }
  if (type === 'ktr:inspect') {
    // 面板桥接过来的检查模式开关：直接拨 code-inspector 客户端的持久检查态，
    // 沙盒内无需再按修饰键（iframe 焦点场景下修饰键事件不一定落在本文档）。
    const inspector = document.querySelector('code-inspector-component')
    if (inspector) {
      inspector.open = Boolean(payload.enabled)
      if (payload.enabled) {
        // v1 客户端点选成功后会 autoToggle 自动退出（open 翻 false），但没有对外事件可监听，
        // 只能轮询同步给面板，避免「客户端已退出、面板还开着」的状态脱节。
        if (inspectPollTimer === null) {
          inspectPollTimer = window.setInterval(() => {
            if (!inspector.open) {
              window.clearInterval(inspectPollTimer)
              inspectPollTimer = null
              inspectHeld = false
              post('ktr:inspect-hold', { held: false })
            }
          }, 250)
        }
      } else {
        if (inspectPollTimer !== null) {
          window.clearInterval(inspectPollTimer)
          inspectPollTimer = null
        }
        if (typeof inspector.removeCover === 'function') {
          inspector.removeCover()
        }
      }
    }
  }
})

// 沙盒侧也跟踪 Shift+Alt：键盘焦点落在 iframe 内时面板顶层监听收不到按键，
// 由这里把按住/松开状态上行同步给面板，保证热键路径在两个文档下都可用。
let inspectHeld = false
/** 检查模式开启期间轮询客户端 open 态的定时器（autoToggle 退出同步用）。 */
let inspectPollTimer = null
const postInspectHeld = (held) => {
  if (held !== inspectHeld) {
    inspectHeld = held
    post('ktr:inspect-hold', { held })
  }
}
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    // Esc 总是上行一次退出信号：面板侧无论是按住还是常驻检查模式都应退出。
    inspectHeld = false
    post('ktr:inspect-hold', { held: false })
    return
  }
  if (event.shiftKey && event.altKey) {
    postInspectHeld(true)
  }
})
window.addEventListener('keyup', (event) => {
  if (event.key === 'Shift' || event.key === 'Alt') {
    postInspectHeld(false)
  }
})

post('ktr:ready', { templates: metadata() })

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    post('ktr:hmr', { path: selectedPath })
    if (hasSelectedData) {
      renderCurrent()
    }
  })
}
`
}

/**
 * 提供 virtual:ktr-sandbox 虚拟模块的 Vite 插件。
 * @param config 已解析的 ktr 配置。
 * @returns Vite 插件。
 */
export const sandboxPlugin = (config: ResolvedKtrConfig): Plugin => ({
  name: 'ktr-sandbox',
  resolveId(id) {
    if (id === virtualModuleId) {
      return resolvedVirtualModuleId
    }
    return undefined
  },
  load(id) {
    if (id === resolvedVirtualModuleId) {
      return sandboxCode(config)
    }
    return undefined
  }
})

/**
 * 注册 /__ktr/sandbox HTML，由 Vite 注入虚拟模块和 HMR 客户端。
 * @param server Vite 开发服务器。
 * @returns 无返回值。
 */
export const registerSandboxMiddleware = (server: ViteDevServer): void => {
  server.middlewares.use('/__ktr/sandbox', async (_req, res) => {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KTR Sandbox</title>
  <style>
    html,
    body,
    #root {
      margin: 0;
      padding: 0;
      width: max-content;
      height: max-content;
      min-width: max-content;
      min-height: max-content;
      background: transparent;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">import '${virtualModuleId}'</script>
</body>
</html>`
    const transformed = await server.transformIndexHtml('/__ktr/sandbox', html)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(transformed)
  })
}
