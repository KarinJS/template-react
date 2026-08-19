import { ScrollShadow, Toast, toast } from '@heroui/react'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Group, Panel, Separator, type GroupImperativeHandle } from 'react-resizable-panels'
import { useLocation, useNavigate } from 'react-router-dom'
import { duration, ease, prefersReducedMotion } from './animation/tokens'
import { DeleteDataConfirmModal, SaveDataAsModal } from './components/DataFileModals'
import { DataFileSelector } from './components/DataFileSelector'
import { MockDataEditorModal } from './components/MockDataEditorModal'
import { PanelHeader } from './components/PanelHeader'
import { PlatformSelector } from './components/PlatformSelector'
import { PreviewPanel, type PreviewPanelRef } from './components/PreviewPanel'
import { PreviewToolbar } from './components/PreviewToolbar'
import { ScreenshotPreviewModal } from './components/ScreenshotPreviewModal'
import { ThemeBuilderPanel } from './components/ThemeBuilderPanel'
import { useSandboxBridge } from './hooks/useSandboxBridge'
import { calculateForeground, formatOklch } from './theme/oklch'
import { usePanelTheme } from './theme/usePanelTheme'
import { useSandboxThemeSync } from './theme/useSandboxThemeSync'
import { useThemeBuilder } from './theme/useThemeBuilder'
import type { DataEntry, SandboxMessage, TemplateMeta } from './types'
import { useDataFileSync } from './useDataFileSync'

const templateDarkStorageKey = 'ktr-template-dark'

/** 捕获数据文件名，与 src/runtime/capture.ts 的 capturedDataFileName 保持一致（面板走浏览器包，不能直接 import node 侧源码）。 */
const capturedDataFileName = 'captured.json'

/** 允许在 React style 对象里直接写 CSS 变量。 */
type CSSVariableStyle = CSSProperties & Partial<Record<`--${string}`, string>>
type TemplateThemeMode = 'light' | 'dark'

/** 面板传给用户组件沙盒的主题 token。 */
interface TemplateTheme {
  /** 明暗模式，跟随面板外壳主题。 */
  mode: TemplateThemeMode
  /** 用户在模板主题色中显式选择的主色；未选择时不下发，组件库自身主题生效。 */
  accent?: string
  /** 主色之上的前景文字色，按亮度自动选取。 */
  accentForeground?: string
  /** 主色的柔和变体，用于徽标等浅底色场景。 */
  accentSoft?: string
  /** 柔和主色之上的前景色。 */
  accentSoftForeground?: string
}

const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2)

const routePrefix = 'templates'

/** 从浏览器地址解析当前模板路由和 mock 数据文件。 */
const parsePanelRoute = (pathname: string, search: string) => {
  const segments = pathname.split('/').filter(Boolean)
  const templateSegments = segments[0] === routePrefix ? segments.slice(1) : []
  const templatePath = templateSegments.map((segment) => decodeURIComponent(segment)).join('/')
  const dataName = new URLSearchParams(search).get('data') ?? ''

  return { dataName, templatePath }
}

/** 根据模板路由和数据文件生成可分享、可刷新的面板地址。 */
const toPanelRoute = (templatePath: string, dataName?: string) => {
  const pathname = templatePath ? `/${routePrefix}/${templatePath.split('/').map(encodeURIComponent).join('/')}` : '/'
  const search = dataName ? `?data=${encodeURIComponent(dataName)}` : ''

  return `${pathname}${search}`
}

/** 优先按 URL 指定的数据文件选择，其次回落到 default.json 或第一个可用数据。 */
const chooseDataEntry = (entries: DataEntry[], preferredName?: string) => {
  if (preferredName) {
    const preferredJsonName = preferredName.endsWith('.json') ? preferredName : `${preferredName}.json`
    const preferredJson = entries.find((entry) => entry.source === 'json' && entry.name === preferredJsonName)
    if (preferredJson) {
      return preferredJson
    }

    const preferred = entries.find((entry) => entry.name === preferredName)
    if (preferred) {
      return preferred
    }
  }

  return entries.find((entry) => entry.name === 'default.json') ?? entries[0]
}

/** 规范化主题色输入，保证下游组件库拿到稳定的十六进制颜色。 */
const normalizeHexColor = (value: string) => {
  const normalized = value.trim().replace('#', '')

  if (normalized.length === 3) {
    return `#${normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase()
  }

  return `#${normalized.slice(0, 6)}`.toLowerCase()
}

/** 根据主色亮度自动选择前景色，避免主题按钮或徽标不可读。 */
const getContrastTextColor = (hexColor: string) => {
  const hex = normalizeHexColor(hexColor).replace('#', '')
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000

  return luminance >= 150 ? '#09090b' : '#fafafa'
}

/** 把面板偏好存进 localStorage，刷新后保持用户的开发环境设置。 */
const useStoredBoolean = (key: string, defaultValue: boolean) => {
  const [value, setValue] = useState(() => {
    const stored = window.localStorage.getItem(key)
    return stored ? stored === 'true' : defaultValue
  })

  useEffect(() => {
    window.localStorage.setItem(key, String(value))
  }, [key, value])

  return [value, setValue] as const
}

/** 开发面板主组件：维护模板、数据文件和主题状态，并通过 postMessage 驱动 iframe 沙盒渲染。 */
const App = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const previewPanelRef = useRef<PreviewPanelRef | null>(null)
  const [templates, setTemplates] = useState<TemplateMeta[]>([])
  // 约定模板注册进度：沙盒逐个 import 时上报，模板清单到位前用于渲染侧边栏骨架屏。
  const [registerProgress, setRegisterProgress] = useState<{ loaded: number; total: number; path: string } | null>(null)
  const [selectedPath, setSelectedPath] = useState('')
  const [entries, setEntries] = useState<DataEntry[]>([])
  const [selectedDataName, setSelectedDataName] = useState('')
  const [jsonText, setJsonText] = useState(pretty({}))
  const [readonly, setReadonly] = useState(false)
  // 面板外壳主题：三态偏好（浅色/深色/跟随系统），解析出的明暗只用于面板自身配色。
  const { preference: panelThemePreference, isDark: panelDark, setPreference: setPanelThemePreference } = usePanelTheme()
  // 模板主题与面板主题完全独立：模板明暗单独持久化，配色由主题构建器管理。
  const [templateDark, setTemplateDark] = useStoredBoolean(templateDarkStorageKey, false)
  const themeBuilder = useThemeBuilder()
  const [scale, setScale] = useState(1)
  const [fitRequest, setFitRequest] = useState(0)
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 1 })
  const [status, setStatus] = useState('Ready')
  const [editorOpen, setEditorOpen] = useState(false)
  /** 「另存为数据文件」弹窗开关。 */
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  /** 删除数据文件的二次确认弹窗开关。 */
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  /** 右侧主题构建器面板是否展开。默认收起，避免一进面板就挤占画布宽度。 */
  const [themeBuilderOpen, setThemeBuilderOpen] = useState(false)
  /** 抽屉是否挂载：开关动画期间保持挂载，动画结束才卸载。 */
  const [drawerMounted, setDrawerMounted] = useState(false)
  /** 开关动画进行中：此时放宽主题面板的 minSize，setLayout 才能写到 0。 */
  const [drawerAnimating, setDrawerAnimating] = useState(false)
  const groupRef = useRef<GroupImperativeHandle | null>(null)
  const drawerTweenRef = useRef<gsap.core.Tween | null>(null)

  /** 主题抽屉的目标宽度（%），与打开动画的终点一致。 */
  const drawerTargetSize = 22

  /**
   * 开关主题抽屉：GSAP 逐帧写布局百分比，抽屉从屏幕右缘挤入/挤出，
   * 预览区和左侧栏随每帧 setLayout 同步让位，三者严格同帧。
   * 减少动态效果偏好下不做逐帧动画，直接写终态布局并翻标志位。
   */
  const toggleThemeBuilder = () => {
    const group = groupRef.current
    // 拿不到 imperative handle 时退化成直接开关（理论上有 DOM 就有）。
    if (!group) {
      setThemeBuilderOpen((open) => !open)
      setDrawerMounted((open) => !open)
      return
    }

    drawerTweenRef.current?.kill()
    const layout = group.getLayout()
    const sidebar = layout.sidebar ?? 18

    if (prefersReducedMotion()) {
      // 瞬时开合：卸载交给 react-resizable-panels 自动让位；打开则等 Panel 挂载后写目标宽度，避免闪一帧。
      if (themeBuilderOpen) {
        setThemeBuilderOpen(false)
        setDrawerMounted(false)
      } else {
        setDrawerMounted(true)
        setThemeBuilderOpen(true)
        requestAnimationFrame(() => {
          group.setLayout({ sidebar, preview: 100 - sidebar - drawerTargetSize, 'theme-builder': drawerTargetSize })
        })
      }
      return
    }

    if (themeBuilderOpen) {
      // 关闭：挤出到 0 宽后卸载。
      const state = { size: layout['theme-builder'] ?? drawerTargetSize }
      setDrawerAnimating(true)
      drawerTweenRef.current = gsap.to(state, {
        size: 0,
        duration: duration.settle,
        ease: ease.exit,
        onUpdate: () => group.setLayout({ sidebar, preview: 100 - sidebar - state.size, 'theme-builder': state.size }),
        onComplete: () => {
          setThemeBuilderOpen(false)
          setDrawerMounted(false)
          setDrawerAnimating(false)
        }
      })
      return
    }

    // 打开：先以 0 宽挂载，再挤入目标宽度。
    const state = { size: layout['theme-builder'] ?? 0 }
    setDrawerAnimating(true)
    setDrawerMounted(true)
    setThemeBuilderOpen(true)
    // 等 Panel 挂载后再从当前宽度起跳，避免闪一帧目标宽度。
    requestAnimationFrame(() => {
      group.setLayout({ sidebar, preview: 100 - sidebar - state.size, 'theme-builder': state.size })
      drawerTweenRef.current = gsap.to(state, {
        size: drawerTargetSize,
        duration: duration.layout,
        ease: ease.out,
        onUpdate: () => group.setLayout({ sidebar, preview: 100 - sidebar - state.size, 'theme-builder': state.size }),
        onComplete: () => setDrawerAnimating(false)
      })
    })
  }
  const [screenshotUrl, setScreenshotUrl] = useState<string>()
  /** 截图弹窗的独立开关：关闭只翻标志位、不销毁截图内容，退出动画才能完整播放。 */
  const [screenshotOpen, setScreenshotOpen] = useState(false)
  /** 当前截图内容的明暗主题，决定弹窗里水印文字深浅和重截开关初始位置。 */
  const [screenshotTheme, setScreenshotTheme] = useState<TemplateThemeMode>('light')
  // 检查模式（code-inspector 源码定位）：sticky 来自工具栏开关，hold 来自 Shift+Alt 按住。
  const [inspectSticky, setInspectSticky] = useState(false)
  const [inspectHold, setInspectHold] = useState(false)
  const inspectMode = inspectSticky || inspectHold
  const shouldAutoFitRef = useRef(false)
  const routeRequestRef = useRef(0)
  // WebSocket 回调里通过 ref 读取最新模板路由，避免闭包捕获旧的 selectedPath。
  const selectedPathRef = useRef('')

  // 面板与沙盒的通信桥：下行 postSandbox 发指令，上行消息分发到各状态回调。
  const { postSandbox, sandboxReadyTick } = useSandboxBridge({
    iframeRef,
    onReady: setTemplates,
    onRegisterProgress: (next) => {
      // 约定模板逐个注册的进度，侧边栏据此渲染骨架屏替代「等待模板注册」。
      // 只接受前进：沙盒可能因 Vite 依赖优化重跑而整页刷新并从头注册，
      // 此时直接覆盖会让进度计数肉眼可见地倒转回零。总数变化（模板增删）才允许重置。
      setRegisterProgress((prev) => {
        if (prev && prev.total === next.total && next.loaded < prev.loaded) {
          return prev
        }
        return next
      })
    },
    onRendered: ({ path, elapsed, size }) => {
      // 沙盒渲染完成后回报实际内容尺寸，画布据此决定居中和适应比例。
      setStatus(`${path} · ${elapsed}ms`)
      if (size) {
        setPreviewSize(size)
      }
      if (shouldAutoFitRef.current) {
        setFitRequest((request) => request + 1)
        shouldAutoFitRef.current = false
      }
    },
    onError: ({ message }) => setStatus(message),
    onHmr: ({ path }) => {
      // 用户组件热更新后重新适应画布，避免旧尺寸让内容漂移出屏。
      setStatus(`${path} updated`)
      shouldAutoFitRef.current = true
    },
    onInspectHold: (held) => {
      // 沙盒上行的检查状态同步：held 为 true 表示沙盒内按住了 Shift+Alt；
      // 为 false（松开热键 / Esc / 点选成功）时两个来源一起退出，保证面板和客户端不脱节。
      if (held) {
        setInspectHold(true)
      } else {
        setInspectHold(false)
        setInspectSticky(false)
      }
    }
  })

  // URL 是面板状态的单一来源，切换板块、模板和数据文件都先写入路由。
  const routeSelection = useMemo(() => parsePanelRoute(location.pathname, location.search), [location.pathname, location.search])
  const selectedTemplate = useMemo(() => templates.find((template) => template.path === selectedPath), [selectedPath, templates])
  const selectedEntry = useMemo(() => entries.find((entry) => entry.name === selectedDataName), [entries, selectedDataName])
  const templateParts = selectedPath ? selectedPath.split('/') : []
  const shellTheme: TemplateThemeMode = panelDark ? 'dark' : 'light'
  // 面板外壳固定 Next.js 风格的黑白基底：它是开发工具，不该和用户正在调的模板配色抢注意力。
  const resolvedPanelAccent = panelDark ? '#fafafa' : '#111111'
  const resolvedPanelAccentForeground = getContrastTextColor(resolvedPanelAccent)
  const resolvedPanelAccentHover = `color-mix(in oklab, ${resolvedPanelAccent} 88%, ${panelDark ? '#09090b' : '#fafafa'} 12%)`
  const resolvedPanelAccentSoft = `color-mix(in oklab, ${resolvedPanelAccent} 14%, transparent)`
  const resolvedPanelAccentSoftHover = `color-mix(in oklab, ${resolvedPanelAccent} 20%, transparent)`
  // 控件底色刻意比卡片（--surface）更亮一档：下拉、次要按钮、选中态都用 --default，
  // 和卡片同色就会糊成一片、看不出层级。深色下往上提，浅色下往下压。
  const resolvedPanelDefault = panelDark ? '#2a2a30' : '#e6e6ea'
  const resolvedPanelDefaultHover = panelDark ? '#33333a' : '#dcdce2'

  // 面板自己的 HeroUI 主题变量，与传给用户组件的模板主题变量分开维护。
  const panelThemeStyle = useMemo<CSSVariableStyle>(
    () => ({
      // 明确的四层灰阶：页面底 < 卡片 < 控件 < hover。
      // 相邻两层至少差一档，否则卡片里的下拉和按钮会和卡片本身同色。
      '--background': panelDark ? '#09090b' : '#f4f4f5',
      '--foreground': panelDark ? '#fafafa' : '#09090b',
      '--surface': panelDark ? '#16161a' : '#ffffff',
      '--surface-foreground': panelDark ? '#fafafa' : '#09090b',
      '--surface-secondary': panelDark ? '#1e1e22' : '#f7f7f8',
      '--surface-secondary-foreground': panelDark ? '#fafafa' : '#09090b',
      '--surface-tertiary': panelDark ? '#26262b' : '#efeff1',
      '--surface-tertiary-foreground': panelDark ? '#fafafa' : '#09090b',
      // 浮层比卡片再亮一档：弹层盖在卡片上，同色会失去边界感。
      '--overlay': panelDark ? '#1e1e22' : '#ffffff',
      '--overlay-foreground': panelDark ? '#fafafa' : '#09090b',
      '--muted': panelDark ? '#a1a1aa' : '#6b6b74',
      '--scrollbar': panelDark ? '#3f3f46' : '#c9c9d0',
      '--default': resolvedPanelDefault,
      '--default-hover': resolvedPanelDefaultHover,
      '--default-foreground': panelDark ? '#fafafa' : '#09090b',
      '--segment': panelDark ? '#2e2e33' : '#ffffff',
      '--segment-foreground': panelDark ? '#fafafa' : '#09090b',
      '--border': panelDark ? '#2b2b31' : '#e0e0e4',
      '--separator': panelDark ? '#26262b' : '#e7e7ea',
      '--accent': resolvedPanelAccent,
      '--accent-foreground': resolvedPanelAccentForeground,
      '--accent-soft': resolvedPanelAccentSoft,
      '--accent-soft-foreground': resolvedPanelAccent,
      '--backdrop': panelDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(250, 250, 250, 0.82)',
      '--focus': resolvedPanelAccent,
      '--link': resolvedPanelAccent,
      '--field-background': panelDark ? '#1e1e22' : '#ffffff',
      '--field-foreground': panelDark ? '#fafafa' : '#09090b',
      '--field-placeholder': panelDark ? '#71717a' : '#a1a1aa',
      '--field-border': panelDark ? '#33333a' : '#d8d8de',
      '--field-border-width': '1px',
      '--color-accent': resolvedPanelAccent,
      '--color-accent-hover': resolvedPanelAccentHover,
      '--color-accent-foreground': resolvedPanelAccentForeground,
      '--color-accent-soft': resolvedPanelAccentSoft,
      '--color-accent-soft-hover': resolvedPanelAccentSoftHover,
      '--color-accent-soft-foreground': resolvedPanelAccent,
      '--color-default': resolvedPanelDefault,
      '--color-default-hover': resolvedPanelDefaultHover,
      '--color-default-foreground': panelDark ? '#fafafa' : '#09090b',
      // 卡片不投影（面板是密集布局，投影会显脏），但浮层需要投影来脱离卡片。
      '--surface-shadow': 'none',
      '--overlay-shadow': panelDark
        ? '0 10px 30px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06)'
        : '0 10px 30px -12px rgba(9, 9, 11, 0.18), 0 0 0 1px rgba(9, 9, 11, 0.05)',
      '--field-shadow': 'none'
    }),
    [
      panelDark,
      resolvedPanelAccent,
      resolvedPanelAccentForeground,
      resolvedPanelAccentHover,
      resolvedPanelAccentSoft,
      resolvedPanelAccentSoftHover,
      resolvedPanelDefault,
      resolvedPanelDefaultHover
    ]
  )

  // 用户组件通过 ctx.theme 消费明暗和主色；视觉变量走另一条路（CSS 注入沙盒，见 useSandboxThemeSync）。
  // 这里只在用户动过构建器时才下发颜色：保持「不设置就用组件库默认主题」的语义。
  const templateTheme = useMemo<TemplateTheme>(() => {
    const theme: TemplateTheme = { mode: templateDark ? 'dark' : 'light' }
    if (!themeBuilder.isDefault) {
      const accent = formatOklch({ l: themeBuilder.knobs.lightness, c: themeBuilder.knobs.chroma, h: themeBuilder.knobs.hue })
      theme.accent = accent
      theme.accentForeground = formatOklch(
        calculateForeground({ l: themeBuilder.knobs.lightness, c: themeBuilder.knobs.chroma, h: themeBuilder.knobs.hue })
      )
      theme.accentSoft = `color-mix(in oklab, ${accent} 15%, transparent)`
      theme.accentSoftForeground = accent
    }
    return theme
  }, [templateDark, themeBuilder.isDefault, themeBuilder.knobs])

  // 主题 CSS 注入 iframe：与上面的 ctx.theme 并行的第二条路，负责全部视觉变量。
  useSandboxThemeSync(iframeRef, themeBuilder.sandboxCss, sandboxReadyTick, themeBuilder.customFonts)

  /** 通过 react-router 切换当前开发板块，确保刷新和直接访问都能复现状态。 */
  const navigatePanel = useCallback(
    (path: string, dataName?: string, replace = false) => {
      const nextRoute = toPanelRoute(path, dataName)
      if (`${location.pathname}${location.search}` !== nextRoute) {
        navigate(nextRoute, { replace })
      }
    },
    [location.pathname, location.search, navigate]
  )

  /** 读取当前模板可用的数据文件列表。 */
  const loadEntries = useCallback(async (path: string, preferredName?: string) => {
    const response = await fetch(`/__ktr/api/data?path=${encodeURIComponent(path)}`)
    const body = (await response.json()) as { entries: DataEntry[] }
    const preferred = chooseDataEntry(body.entries, preferredName)
    setEntries(body.entries)
    setSelectedDataName(preferred?.name ?? '')
    return preferred
  }, [])

  /** 加载某个数据文件，并把真实数据推送给沙盒重新渲染。 */
  const loadData = useCallback(
    async (path: string, name: string, autoFit = false) => {
      if (!path) {
        return
      }

      if (autoFit) {
        shouldAutoFitRef.current = true
      }

      if (!name) {
        setJsonText(pretty({}))
        setReadonly(false)
        postSandbox('ktr:data', { path, data: {} })
        return
      }

      const response = await fetch(`/__ktr/api/data?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}`)
      if (!response.ok) {
        setStatus(`Data ${response.status}`)
        // 加载失败时用占位卡替换沙盒中的模板渲染位置。
        postSandbox('ktr:data', { path, data: {}, emptyReason: 'load-failed' })
        return
      }

      const body = (await response.json()) as { data: unknown; readonly: boolean; ctx?: Record<string, unknown> }
      // 捕获快照（captured.json）带 ctx：编辑器展示完整的 { data, ctx } 快照，写回时也保持完整形状。
      setJsonText(pretty(body.ctx !== undefined ? { data: body.data, ctx: body.ctx } : body.data))
      setReadonly(body.readonly)
      // 快照自带明暗时以数据为准回显「模板主题」：否则面板会拿上次持久化的选择覆盖数据，
      // 出现「数据是 light、控件显示 dark」的状态脱节。
      const capturedMode = (body.ctx?.theme as { mode?: unknown } | undefined)?.mode
      if (capturedMode === 'dark' || capturedMode === 'light') {
        setTemplateDark(capturedMode === 'dark')
      }
      // 捕获快照（captured.json）会带 ctx：版本页脚、取色、缩放等运行时上下文一并回放。
      postSandbox('ktr:data', { path, data: body.data, ...(body.ctx ? { ctx: body.ctx } : {}) })
    },
    [postSandbox, setTemplateDark]
  )

  // 让 WebSocket 回调始终能读到最新的模板路由。
  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  // 订阅 dev server 的数据文件变更推送：刷新当前模板的数据下拉，捕获数据更新时自动切换并重渲染。
  useDataFileSync((payload) => {
    const currentPath = selectedPathRef.current
    if (!currentPath || payload.templatePath !== currentPath) {
      return
    }

    // 先刷新数据文件下拉，新增或删除的文件立即可见，同时尽量保持当前选择。
    void loadEntries(currentPath, routeSelection.dataName || selectedDataName)

    if (payload.file === capturedDataFileName) {
      if (routeSelection.dataName === capturedDataFileName) {
        // 已经停留在捕获数据时路由不会变化，直接重载数据让沙盒重渲染。
        void loadData(currentPath, capturedDataFileName, true)
        return
      }
      // 切到 captured.json，走既有路由副作用自动 loadData 并重渲染沙盒。
      navigatePanel(currentPath, capturedDataFileName)
    }
  })

  // 路由是模板切换和数据加载的唯一入口：地址变化时同步选择状态并拉取数据。
  useEffect(() => {
    if (templates.length === 0) {
      return
    }

    const routePath = routeSelection.templatePath
    const validTemplatePath = routePath && templates.some((template) => template.path === routePath) ? routePath : ''

    // 路由没有指向有效模板时，不再自动选中第一个模板：
    // 清空选择并让画布停在空状态，等用户从列表里主动点击后才渲染。
    if (!validTemplatePath) {
      routeRequestRef.current += 1
      if (routePath) {
        // 地址里的模板已不存在（如热更新后被删除）：清掉无效地址，用 replace 避免污染浏览历史。
        navigatePanel('', undefined, true)
      }
      if (selectedPath) {
        setSelectedPath('')
        setEntries([])
        setSelectedDataName('')
        setJsonText(pretty({}))
        setPreviewSize({ width: 1, height: 1 })
      }
      return
    }

    const templateChanged = selectedPath !== validTemplatePath
    const requestId = routeRequestRef.current + 1
    routeRequestRef.current = requestId

    if (templateChanged) {
      // 模板切换时先清空旧尺寸，等沙盒回报新尺寸后再适应画布。
      shouldAutoFitRef.current = true
      setPreviewSize({ width: 1, height: 1 })
      setSelectedPath(validTemplatePath)
      postSandbox('ktr:select', { path: validTemplatePath })
    }

    void loadEntries(validTemplatePath, routeSelection.dataName).then((entry) => {
      if (routeRequestRef.current !== requestId) {
        // 避免快速切换模板时，较慢的旧请求覆盖新模板的数据选择。
        return
      }

      const dataName = entry?.name ?? ''
      if (dataName !== routeSelection.dataName) {
        navigatePanel(validTemplatePath, dataName, true)
        return
      }

      void loadData(validTemplatePath, dataName, true)
    })
  }, [
    loadData,
    loadEntries,
    navigatePanel,
    postSandbox,
    routeSelection.dataName,
    routeSelection.templatePath,
    sandboxReadyTick,
    selectedPath,
    templates
  ])

  // 面板明暗模式写入 html/body 的 class 与 colorScheme，HeroUI 外壳据此换肤。
  useEffect(() => {
    const nextTheme = panelDark ? 'dark' : 'light'
    const root = document.documentElement
    const body = document.body

    root.classList.remove('light', 'dark')
    body.classList.remove('light', 'dark')
    root.classList.add(nextTheme)
    body.classList.add(nextTheme)
    root.dataset.theme = nextTheme
    body.dataset.theme = nextTheme
    root.style.colorScheme = nextTheme
    body.style.colorScheme = nextTheme
  }, [panelDark])

  // 全局屏蔽空格键：捕获阶段拦截，防止画布聚焦时误触按钮切换；
  // 输入框、Monaco 编辑器和 contentEditable 区域正常放行。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') {
        return
      }

      const target = event.target as HTMLElement | null
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable) ||
        Boolean(target?.closest('.monaco-editor'))
      if (!isEditable) {
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    // sandbox ready 和面板主题变化时都同步一次，保证用户组件库主题色即时生效。
    postSandbox('ktr:theme', { theme: templateTheme })
  }, [postSandbox, sandboxReadyTick, templateTheme])

  useEffect(() => {
    // 面板外壳明暗同步给沙盒：决定 iframe 画布背板（UA 背板随 color-scheme 透出），
    // 深色面板下圆角海报的四角不再透出默认白背板。与模板主题完全解耦。
    postSandbox('ktr:panel-theme', { dark: panelDark })
  }, [postSandbox, sandboxReadyTick, panelDark])

  useEffect(() => {
    // 检查模式开关同步给沙盒，由沙盒拨 code-inspector 客户端的持久检查态。
    postSandbox('ktr:inspect', { enabled: inspectMode })
  }, [postSandbox, sandboxReadyTick, inspectMode])

  // 顶层的 Shift+Alt 按住跟踪：按住即进入检查模式，松开任意键或 Esc 退出；
  // 焦点在 iframe 内时由沙盒上行的 ktr:inspect-hold 接管同一份 inspectHold 状态。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInspectHold(false)
        setInspectSticky(false)
        return
      }
      if (event.shiftKey && event.altKey) {
        setInspectHold(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Alt') {
        setInspectHold(false)
      }
    }
    const onBlur = () => setInspectHold(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  /** 侧边栏选择模板：只写路由，由路由副作用统一驱动切换。 */
  const selectTemplate = (path: string) => {
    navigatePanel(path)
  }

  /** 切换数据文件：同样只写路由，保持 URL 为唯一状态源。 */
  const selectData = (name: string) => {
    navigatePanel(selectedPath, name)
  }

  /** 重新拉取当前模板的数据文件列表，并尽量保持当前选择。 */
  const refreshDataFiles = async () => {
    if (!selectedPath) {
      return
    }
    const preferred = await loadEntries(selectedPath, routeSelection.dataName || selectedDataName)
    const nextDataName = preferred?.name ?? ''
    if (nextDataName !== routeSelection.dataName) {
      navigatePanel(selectedPath, nextDataName, true)
      return
    }
    await loadData(selectedPath, nextDataName, true)
  }

  /** 把编辑器草稿写回 JSON mock 文件，成功后推送沙盒重渲染并刷新列表。 */
  const saveData = async (nextJsonText: string) => {
    if (!selectedPath || readonly) {
      return
    }

    const data = JSON.parse(nextJsonText)
    const name = selectedDataName || 'default.json'
    const response = await fetch(`/__ktr/api/data?path=${encodeURIComponent(selectedPath)}&name=${encodeURIComponent(name)}`, {
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT'
    })

    if (response.ok) {
      setJsonText(pretty(data))
      setStatus(`${name} saved`)
      toast.success('保存成功', { description: `${name} 已写回数据文件` })
      // 数据内容变化可能改变组件尺寸，标记下次渲染完成后自动适应画布。
      shouldAutoFitRef.current = true
      // 编辑器里若是捕获快照的完整 { data, ctx } 形状，推给沙盒时拆包下发。
      const isSnapshot = data !== null && typeof data === 'object' && 'data' in data && 'ctx' in data
      postSandbox('ktr:data', {
        path: selectedPath,
        data: isSnapshot ? (data as { data: unknown }).data : data,
        ...(isSnapshot ? { ctx: (data as { ctx: Record<string, unknown> }).ctx } : {})
      })
      await loadEntries(selectedPath, name)
      navigatePanel(selectedPath, name, true)
    } else {
      setStatus(`Save ${response.status}`)
      toast.danger('保存失败', { description: `接口返回 ${response.status}，请检查开发服务器` })
    }
  }

  /**
   * 把当前正在渲染的数据另存为同级目录下的新 JSON 文件，并立即切换过去。
   * 保存内容取当前编辑器文本（加载/保存后始终与沙盒渲染保持一致）；
   * 捕获快照的完整 { data, ctx } 形状原样保留。
   */
  const saveDataAs = async (filename: string) => {
    if (!selectedPath) {
      return
    }

    let data: unknown
    try {
      data = JSON.parse(jsonText)
    } catch {
      toast.danger('另存为失败', { description: '当前数据不是合法 JSON，请先在编辑器中修正' })
      return
    }

    const response = await fetch(`/__ktr/api/data?path=${encodeURIComponent(selectedPath)}&name=${encodeURIComponent(filename)}`, {
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT'
    })

    if (response.ok) {
      setSaveAsOpen(false)
      setStatus(`${filename} saved`)
      toast.success('另存为成功', { description: `${filename} 已写入数据目录` })
      await loadEntries(selectedPath, filename)
      navigatePanel(selectedPath, filename)
    } else {
      setStatus(`Save ${response.status}`)
      toast.danger('另存为失败', { description: `接口返回 ${response.status}，请检查开发服务器` })
    }
  }

  /** 删除当前选中的 JSON mock 文件，并回落到默认数据。 */
  const deleteData = async () => {
    if (!selectedPath || !selectedDataName || readonly) {
      return
    }

    await fetch(`/__ktr/api/data?path=${encodeURIComponent(selectedPath)}&name=${encodeURIComponent(selectedDataName)}`, {
      method: 'DELETE'
    })
    setDeleteConfirmOpen(false)
    navigatePanel(selectedPath, undefined, true)
  }

  /** 截取预览画布中的用户模板，生成 Object URL 后打开截图预览弹窗。 */
  const captureScreenshot = async () => {
    try {
      const blob = await previewPanelRef.current?.captureScreenshot()
      if (blob) {
        // 替换前回收上一张截图的 Object URL，避免多次截图后内存堆积。
        if (screenshotUrl) {
          URL.revokeObjectURL(screenshotUrl)
        }
        setScreenshotTheme(templateTheme.mode)
        setScreenshotUrl(URL.createObjectURL(blob))
        setScreenshotOpen(true)
      }
    } catch (error) {
      console.error('截图失败:', error)
      toast.danger('截图失败', { description: '请重试或检查浏览器控制台', timeout: 3000 })
    }
  }

  /**
   * 用指定主题重新截图：先把沙盒主题临时切成目标模式，等渲染完成后截图，再恢复原主题。
   * @param theme 目标明暗模式。
   * @returns 截图和主题恢复完成后 resolve。
   */
  const onRecaptureWithTheme = useCallback(
    async (theme: TemplateThemeMode) => {
      if (!iframeRef.current?.contentWindow) {
        return
      }

      // 等沙盒下一次 ktr:rendered 再截图；400ms 兜底，消息丢失时也不会卡住弹窗。
      const waitRendered = new Promise<void>((resolve) => {
        let timer = 0
        const cleanup = () => {
          window.clearTimeout(timer)
          window.removeEventListener('message', onMessage)
          resolve()
        }
        const onMessage = (event: MessageEvent<SandboxMessage>) => {
          if (event.origin !== window.location.origin || event.data?.source !== 'ktr-sandbox') {
            return
          }
          if (event.data.type === 'ktr:rendered') {
            cleanup()
          }
        }
        window.addEventListener('message', onMessage)
        timer = window.setTimeout(cleanup, 400)
      })

      // 只临时替换 mode，其余主题 token 沿用当前模板主题设置。
      postSandbox('ktr:theme', { theme: { ...templateTheme, mode: theme } })
      await waitRendered

      const blob = await previewPanelRef.current?.captureScreenshot()
      if (blob) {
        if (screenshotUrl) {
          URL.revokeObjectURL(screenshotUrl)
        }
        setScreenshotTheme(theme)
        setScreenshotUrl(URL.createObjectURL(blob))
      }

      // 截图完成后恢复模板当前主题，画布回到用户实际选择的外观。
      postSandbox('ktr:theme', { theme: templateTheme })
    },
    [postSandbox, templateTheme, screenshotUrl]
  )

  // 预览顶栏状态行：模板描述（或最近渲染状态）+ 数据文件 + 面板/模板主题摘要。
  const statusLine = [
    selectedTemplate?.description ?? status,
    `数据：${selectedDataName || 'none'}`,
    `面板：${
      panelThemePreference === 'system' ? `跟随系统（${shellTheme === 'dark' ? '深色' : '浅色'}）` : shellTheme === 'dark' ? '深色' : '浅色'
    }`,
    `模板：${templateDark ? '深色' : '浅色'}`,
    `模板主题：${themeBuilder.isDefault ? '组件库默认' : '已自定义'}`
  ].join(' · ')

  return (
    <div className={shellTheme} data-theme={shellTheme} style={panelThemeStyle}>
      {/* Toast 挂在根布局 div 上，跟随面板主题换肤；从顶部向下弹出。 */}
      <Toast.Provider placement="top" />
      <div className="h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
        <Group className="h-full w-full" groupRef={groupRef} orientation="horizontal">
          <Panel defaultSize="18%" id="sidebar" maxSize="28%" minSize="16%">
            <aside className="flex h-full min-w-0 flex-col border-r border-border">
              <PanelHeader
                panelTheme={shellTheme}
                panelThemePreference={panelThemePreference}
                panelThemeStyle={panelThemeStyle}
                onPanelThemePreferenceChange={setPanelThemePreference}
              />

              <ScrollShadow className="min-h-0 flex-1 px-3 py-4" hideScrollBar size={56}>
                {/* 扁平分区：不套卡片，分区之间只用发丝分割线隔开。 */}
                <div className="flex flex-col pb-6">
                  <PlatformSelector
                    selectedPath={selectedPath}
                    templates={templates}
                    registerProgress={registerProgress}
                    onSelect={selectTemplate}
                  />

                  <div className="mx-1 my-5 border-t border-border" />

                  <DataFileSelector
                    entries={entries}
                    panelTheme={shellTheme}
                    panelThemeStyle={panelThemeStyle}
                    readonly={Boolean(selectedEntry?.readonly)}
                    value={selectedDataName}
                    onChange={selectData}
                    onDelete={() => setDeleteConfirmOpen(true)}
                    onEdit={() => setEditorOpen(true)}
                    onRefresh={refreshDataFiles}
                    onSaveAs={() => setSaveAsOpen(true)}
                  />
                </div>
              </ScrollShadow>
            </aside>
          </Panel>

          <Separator className="ktr-resize-handle" />

          {/* minSize 按三面板布局定：主题构建器展开时画布要让出空间，
              64% 那种按两面板算的下限会把侧边栏压到它自己的下限。 */}
          <Panel defaultSize="82%" id="preview" minSize="44%">
            <section className="flex h-full min-w-0 flex-col bg-background">
              <PreviewToolbar
                inspectMode={inspectMode}
                statusLine={statusLine}
                templateParts={templateParts}
                themeBuilderOpen={themeBuilderOpen}
                onCaptureScreenshot={() => void captureScreenshot()}
                onFit={() => previewPanelRef.current?.fitToCanvas()}
                onReload={() => void loadData(selectedPath, selectedDataName, true)}
                onToggleInspect={() => setInspectSticky((sticky) => !sticky)}
                onToggleThemeBuilder={toggleThemeBuilder}
              />

              <div className="min-h-0 flex-1">
                <PreviewPanel
                  ref={previewPanelRef}
                  contentSize={previewSize}
                  fitRequest={fitRequest}
                  hasTemplate={Boolean(selectedPath)}
                  iframeRef={iframeRef}
                  inspectMode={inspectMode}
                  panelDark={panelDark}
                  scale={scale}
                  onCaptureScreenshot={() => void captureScreenshot()}
                  onScaleChange={setScale}
                />
              </div>
            </section>
          </Panel>

          {drawerMounted && (
            <>
              <Separator className="ktr-resize-handle" />

              {/*
                overflow 覆盖成 visible：主题抽屉的代码弹窗是绝对定位在抽屉左缘之外的
                （absolute right-full），Panel 内层默认 overflow: auto 会把它裁掉。
                抽屉自身的滚动由内部 ScrollShadow 承担，放开外层不会引入页面级滚动条。
                开关动画期间 minSize 放宽到 0，GSAP 才能把宽度写到 0。
              */}
              <Panel
                defaultSize="0%"
                id="theme-builder"
                maxSize="34%"
                minSize={drawerAnimating ? '0%' : '18%'}
                style={{ overflow: 'visible' }}
              >
                <ThemeBuilderPanel
                  getExportCss={themeBuilder.getExportCss}
                  isDark={templateDark}
                  isDefault={themeBuilder.isDefault}
                  knobs={themeBuilder.knobs}
                  customFonts={themeBuilder.customFonts}
                  lockedKnobs={themeBuilder.lockedKnobs}
                  matchingPreset={themeBuilder.matchingPreset}
                  panelTheme={shellTheme}
                  panelThemeStyle={panelThemeStyle}
                  onApplyPreset={themeBuilder.applyPreset}
                  onClose={toggleThemeBuilder}
                  onDarkChange={setTemplateDark}
                  onImportFont={themeBuilder.importFont}
                  onKnobsChange={themeBuilder.setKnobs}
                  onRandomize={themeBuilder.randomize}
                  onRemoveFont={themeBuilder.removeFont}
                  onReset={themeBuilder.reset}
                  onToggleLock={themeBuilder.toggleLock}
                />
              </Panel>
            </>
          )}
        </Group>
      </div>

      <MockDataEditorModal
        isOpen={editorOpen}
        jsonText={jsonText}
        panelTheme={shellTheme}
        panelThemeStyle={panelThemeStyle}
        readonly={Boolean(readonly)}
        selectedDataName={selectedDataName}
        onClose={() => setEditorOpen(false)}
        onJsonTextChange={setJsonText}
        onSave={saveData}
      />

      <SaveDataAsModal
        currentName={selectedDataName}
        existingNames={entries.map((entry) => entry.name)}
        isOpen={saveAsOpen}
        panelTheme={shellTheme}
        panelThemeStyle={panelThemeStyle}
        onClose={() => setSaveAsOpen(false)}
        onSave={(filename) => void saveDataAs(filename)}
      />

      <DeleteDataConfirmModal
        isOpen={deleteConfirmOpen}
        name={selectedDataName}
        panelTheme={shellTheme}
        panelThemeStyle={panelThemeStyle}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void deleteData()}
      />

      <ScreenshotPreviewModal
        contentTheme={screenshotTheme}
        imageUrl={screenshotUrl}
        open={screenshotOpen}
        panelTheme={shellTheme}
        panelThemeStyle={panelThemeStyle}
        onClose={() => setScreenshotOpen(false)}
        onRecaptureWithTheme={onRecaptureWithTheme}
      />
    </div>
  )
}

export default App
