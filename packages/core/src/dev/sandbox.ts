import path from 'node:path'

import type { Plugin, ViteDevServer } from 'vite'

import { ensureCssEntry } from '../conventions/css-entry'
import { discoverTemplateRoutes } from '../conventions/registry'
import type { ResolvedKtrConfig } from '../types'

// Vite 虚拟模块约定：resolve 后的 id 加 \0 前缀，防止被其他插件当作真实文件处理。
const virtualModuleId = 'virtual:ktr-sandbox'
const resolvedVirtualModuleId = `\0${virtualModuleId}`

const normalizePath = (filePath: string): string => filePath.replace(/\\/g, '/')

// 把绝对路径包装成 Vite 的 /@fs/ 导入地址，让 sandbox 模块能引用项目任意位置的文件。
const fsImport = (filePath: string): string => `/@fs/${normalizePath(filePath)}`

/**
 * 生成 iframe sandbox 的虚拟模块代码，用户组件只在这个隔离环境里运行。
 * @param config 已解析的 ktr 配置。
 * @returns sandbox 入口模块的源码字符串。
 */
const sandboxCode = async (config: ResolvedKtrConfig): Promise<string> => {
  const cssEntry = ensureCssEntry(config)
  // 逐路由动态导入而不是整包导入 .ktr 注册表：注册表是单个模块，导入即同步拉起全部模板，
  // 无法按模块粒度上报进度。这里在 load 阶段展开约定路由，运行时一个个 await，注册完一个推一次进度。
  const routes = await discoverTemplateRoutes(config.templateDir)
  const loaderItems = routes
    .map((item) => `  ['${item.route}', () => import('${fsImport(path.join(config.templateDir, item.file))}')]`)
    .join(',\n')

  // 通过 /@fs/ 绝对路径导入模板与 CSS 入口，保证 sandbox 总能拿到最新的模板实现和样式。
  return `
import React from 'react'
import { createRoot } from 'react-dom/client'
import '${fsImport(cssEntry)}'

// 约定扫描出的模板加载器，顺序与侧边栏展示顺序一致。
const templateLoaders = [
${loaderItems}
]
// 注册完成的模板定义，键为约定路由。
const templates = {}

const source = 'ktr-sandbox'
const target = 'ktr-panel'
const rootElement = document.getElementById('root')
const root = createRoot(rootElement)
// 面板只下发显式设置的主题字段（模式 + 可选主题色），框架不发明默认色，组件库自身主题生效。
let selectedPath = ''
let selectedData = {}
let selectedCtx = { scale: 1, theme: {} }
let hasSelectedData = false
let renderToken = 0
// 数据为空或渲染失败时的占位提示，替换模板渲染位置。
// emptyReason: null 正常渲染；'no-data' 未选择数据；'load-failed' 数据加载失败；'render-failed' 组件渲染抛错。
let emptyState = null

// 占位卡：内联样式实现，不依赖下游样式，固定尺寸让面板的测量/缩放/拖拽与真实模板一致。
const Placeholder = ({ title, detail, isError }) =>
  React.createElement(
    'div',
    {
      style: {
        width: 800,
        minHeight: 420,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '48px 40px',
        border: '2px dashed rgba(128, 128, 128, 0.45)',
        borderRadius: 24,
        color: '#888',
        fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        textAlign: 'center',
        background: 'rgba(128, 128, 128, 0.06)'
      }
    },
    React.createElement('div', { style: { fontSize: 40, lineHeight: 1 } }, isError ? '⚠️' : '🗂️'),
    React.createElement('div', { style: { fontSize: 22, fontWeight: 600, color: isError ? '#dc2626' : '#999' } }, title),
    detail
      ? React.createElement(
          'div',
          { style: { fontSize: 14, color: '#aaa', maxWidth: 640, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } },
          detail
        )
      : null
  )

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
      // 渲染失败时用占位卡替换模板位置，尺寸可被面板测量，画布缩放/拖拽行为与正常模板一致。
      return React.createElement(Placeholder, {
        title: '模板渲染失败',
        detail: String(this.state.error?.message || this.state.error),
        isError: true
      })
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

// 变量名与 HeroUI 的语义色变量一一对应，覆盖它们即可换肤；
// 只注入面板显式提供的字段，其余变量移除，让组件库自身主题生效。
// 仍然同时写 html 和 body：面板里用户组件可能挂在任意一级，两边都写最省心。
const themeVarNames = [
  ['--background', 'background'],
  ['--foreground', 'foreground'],
  ['--surface', 'surface'],
  ['--muted', 'muted'],
  ['--border', 'border'],
  ['--accent', 'accent'],
  ['--accent-foreground', 'accentForeground'],
  ['--accent-soft', 'accentSoft'],
  ['--accent-soft-foreground', 'accentSoftForeground']
]

// 记录通过 vars 写入的变量名，下一轮好把已移除的键清理干净。
const appliedVarNames = new Set()

const applyTheme = () => {
  const theme = selectedCtx.theme || {}
  const mode = theme.mode === 'dark' ? 'dark' : 'light'

  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.body.classList.toggle('dark', mode === 'dark')
  document.documentElement.dataset.theme = mode
  document.body.dataset.theme = mode
  // 注意：不要在这里设置 color-scheme——它是 iframe 画布背板颜色的来源（light 时不透明白、dark 时深色），
  // 背板颜色由面板外壳主题通过 ktr:panel-theme 单独控制，与模板主题解耦。
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

  // vars 直通口：面板主题构建器调整的圆角、字体等变量从这里来。
  // 记住上一轮写过哪些键，切换主题时把不再出现的键清掉，避免残留。
  const nextVars = theme.vars || {}
  for (const name of appliedVarNames) {
    if (!(name in nextVars)) {
      document.documentElement.style.removeProperty(name)
      document.body.style.removeProperty(name)
    }
  }
  appliedVarNames.clear()
  for (const [name, value] of Object.entries(nextVars)) {
    if (!/^--[a-z0-9-]+$/i.test(name) || typeof value !== 'string' || !value) {
      continue
    }
    document.documentElement.style.setProperty(name, value)
    document.body.style.setProperty(name, value)
    appliedVarNames.add(name)
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

// 占位卡挂载时也上报尺寸：占位渲染走与真实模板相同的测量/上报路径，画布缩放与拖拽算法保持一致。
const ReportOnMount = ({ onRendered, children }) => {
  React.useLayoutEffect(() => {
    onRendered()
  }, [onRendered])
  return children
}

// 面板下发主题时整体替换：面板每次都发完整主题对象，replace 语义才能让
// 「恢复默认」（面板不再下发颜色字段）真正清掉旧的内联变量；合并语义会把上一次的颜色留在
// selectedCtx.theme 里，applyTheme 又把它写成内联样式，优先级压过组件库默认主题。
const updateTheme = (payload = {}) => {
  const rawTheme = payload && typeof payload === 'object' && payload.theme ? payload.theme : payload

  selectedCtx = {
    ...selectedCtx,
    theme: { ...rawTheme }
  }
}

const renderCurrent = () => {
  const startedAt = performance.now()
  const template = templates[selectedPath]
  renderToken += 1
  const currentToken = renderToken
  applyTheme()

  if (!template) {
    postError(selectedPath, new Error('Template is not registered: ' + selectedPath))
    return
  }

  try {
    const onRendered = () => reportRendered(startedAt, currentToken)
    // 与 SSR 外壳保持同一截图边界：包一层被动 #container，面板的测量与截图目标（#container ?? body）就和生产 HTML 一致。
    // ctx.scale 同样由外壳 zoom 施加（与 SSR 的 HtmlWrapper 对齐），面板预览到的就是生产截图的实际比例。
    // 数据为空/加载失败时渲染占位卡，替换模板位置；占位卡走同一 #container 测量，画布的缩放/拖拽行为不变。
    const ctxScale =
      typeof selectedCtx.scale === 'number' && Number.isFinite(selectedCtx.scale) && selectedCtx.scale > 0 ? selectedCtx.scale : 1
    const content = emptyState
      ? React.createElement(Placeholder, {
          title: emptyState === 'load-failed' ? '数据加载失败' : '暂无可预览的数据',
          detail: emptyState === 'load-failed' ? '数据文件读取失败，请检查文件内容或重新选择' : '在左侧数据区选择或新建一份 mock 数据',
          isError: emptyState === 'load-failed'
        })
      : React.createElement(TemplateHost, {
          template,
          data: selectedData,
          ctx: selectedCtx,
          renderId: startedAt,
          onRendered
        })
    root.render(
      React.createElement(ErrorBoundary, { key: selectedPath + ':' + Date.now() },
        React.createElement('div', { id: 'container', style: { zoom: ctxScale } },
          emptyState ? React.createElement(ReportOnMount, { onRendered }, content) : content
        )
      )
    )
  } catch (error) {
    postError(selectedPath, error)
  }
}

// 面板消息入口：select 只切换模板，data 触发渲染，theme 仅明暗切换时联动重渲染。
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.data?.source !== target) {
    return
  }

  const { type, payload } = event.data
  if (type === 'ktr:select') {
    selectedPath = payload.path
    selectedData = {}
    hasSelectedData = false
    emptyState = null
    // 切换模板时丢弃捕获快照带来的扩展字段，仅保留面板主题弹窗选择的 theme。
    selectedCtx = { scale: 1, theme: selectedCtx.theme }
  }
  if (type === 'ktr:data') {
    selectedPath = payload.path
    selectedData = payload.data ?? {}
    hasSelectedData = true
    // 数据为空或加载失败时渲染占位卡（emptyReason 由面板在加载失败时显式置 load-failed）。
    const isEmptyObject = selectedData && typeof selectedData === 'object' && Object.keys(selectedData).length === 0
    emptyState = payload.emptyReason ?? (isEmptyObject ? 'no-data' : null)
    // 捕获快照（captured.json）携带完整 ctx 时整包回放，真实还原本地渲染时的运行时上下文；
    // 普通 mock 不带 ctx，丢掉上一个快照的扩展字段，但保留面板主题弹窗选择的 theme。
    selectedCtx = payload.ctx && typeof payload.ctx === 'object' ? { scale: 1, ...payload.ctx } : { scale: 1, theme: selectedCtx.theme }
    renderCurrent()
  }
  if (type === 'ktr:panel-theme') {
    // 面板外壳明暗：只用于 iframe 画布背板（transform 合成时 UA 背板随 color-scheme 透出），与模板主题解耦。
    // 必须显式写 'light'：留空会清掉内联值，让模板 dark 类命中组件库样式表里的 color-scheme: dark，
    // UA 背板转深色后从模板圆角外侧透出，表现为浅色面板下切深色模板时整块背景发黑。
    const scheme = payload && payload.dark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = scheme
    document.body.style.colorScheme = scheme
  }
  if (type === 'ktr:theme') {
    // 只有明暗切换才重渲染：组件可能按 ctx.theme.mode 分支输出，模式变了必须重来。
    // 颜色等视觉变量走 applyTheme 直接写 CSS 变量，不碰 React 树——
    // 否则拖一次颜色滑块就整棵重挂载（root.render 的 key 带时间戳），画布肉眼可见地闪烁。
    const prevMode = (selectedCtx.theme && selectedCtx.theme.mode) === 'dark' ? 'dark' : 'light'
    updateTheme(payload)
    const nextMode = (selectedCtx.theme && selectedCtx.theme.mode) === 'dark' ? 'dark' : 'light'
    if (hasSelectedData && nextMode !== prevMode) {
      renderCurrent()
    } else {
      applyTheme()
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

// 逐个注册约定模板：每完成一个就上报一次进度，让侧边栏进度条可见地推进。
// 顺序 await 而非 Promise.all：并发下浏览器会同时拉起全部模板依赖，进度条会挤在最后一起跳完。
// 进度按「当前序号」而非「已加载数」上报：中途触发 full-reload（如 Vite 依赖优化重跑）后沙盒会重建，
// 重建的编号能对面板的进度条做「追加恢复」而不是「归零重来」，避免大板块加载到一半进度又倒转。
const registerTemplates = async () => {
  const total = templateLoaders.length
  // 序号从 1 开始：模板加载成功后同步增加，失败时也占位推进，保证进度条总能单调递增。
  let index = 0

  for (const [routePath, load] of templateLoaders) {
    index += 1
    try {
      const mod = await load()
      const def = mod.default
      if (def) {
        templates[routePath] = def
        if (!selectedPath) {
          selectedPath = routePath
        }
      }
    } catch (error) {
      // 单个模板注册失败不阻塞其余模板，错误上报面板状态栏。
      postError(routePath, error)
    }

    post('ktr:register-progress', { loaded: index, total, path: routePath })
  }

  post('ktr:ready', { templates: metadata() })
}

void registerTemplates()

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
  async load(id) {
    if (id === resolvedVirtualModuleId) {
      return await sandboxCode(config)
    }
    return undefined
  },
  configureServer(server) {
    // 约定路由清单在 load 阶段展开进虚拟模块，模板增删不会经过模块图，
    // 需要手动失效虚拟模块并整页刷新，否则新模板不会出现在侧边栏。
    const templateDir = normalizePath(config.templateDir)
    const isTemplateEntry = (file: string): boolean => {
      const normalized = normalizePath(file)
      return normalized.startsWith(`${templateDir}/`) && /\/index\.(tsx|jsx)$/.test(normalized)
    }

    const reloadSandbox = (file: string): void => {
      if (!isTemplateEntry(file)) {
        return
      }
      const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId)
      if (mod) {
        server.moduleGraph.invalidateModule(mod)
      }
      server.ws.send({ type: 'full-reload' })
    }

    server.watcher.on('add', reloadSandbox)
    server.watcher.on('unlink', reloadSandbox)
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
    /* 与 SSR 外壳一致：#container 充当绝对定位包含块，模板里的 inset-0 氛围层
       锚定在卡片矩形上而不是 iframe 视口（刷新瞬间视口尺寸未就位会导致氛围层逃逸）；
       isolation 补回旧引擎 transform 顺带的层叠上下文，负 z 层级氛围层不会逃逸。 */
    #container {
      position: relative;
      isolation: isolate;
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
