import type React from 'react'
import type { UserConfig as ViteUserConfig } from 'vite'

// 通过包自身子路径引用，让打包后的 d.ts 也保持外部引用；
// 这样下游 .ktr/registry-types.d.ts 的模块增强才能顺着同一个模块 ID 合并进来。
import type { ProjectRegistry } from '@karinjs/template-react/registry-types'

/** 面板传入用户模板的主题变量。 */
export interface ThemeContext {
  /** 当前明暗模式。 */
  mode: 'light' | 'dark'
  /** 用户组件库可直接消费的主色。 */
  accent: string
  /** 主色背景上的文字颜色。 */
  accentForeground: string
  /** 主色的浅色背景，适合徽标、图标底色和弱强调区域。 */
  accentSoft: string
  /** 浅色主色背景上的文字颜色。 */
  accentSoftForeground: string
  /** 模板根背景色。 */
  background: string
  /** 模板主要文字色。 */
  foreground: string
  /** 卡片、面板等承载内容的表面色。 */
  surface: string
  /** 次要文字或弱信息颜色。 */
  muted: string
  /** 边框和分割线颜色。 */
  border: string
  /**
   * 任意 CSS 变量的直通口，键必须是合法的自定义属性名（如 `--radius`、`--font-sans`）。
   *
   * 上面那些字段是常用语义色的快捷方式；开发面板的主题构建器会调整更多变量
   * （圆角、字体、状态色等），它们统一从这里下发，不必逐个加字段。
   * 同名时以本字段为准，因为它更晚写入。
   */
  vars: Record<string, string>
}

/** 渲染器注入给模板的运行时上下文，用户数据始终放在 data 中。 */
export interface RenderContext {
  /** 当前渲染比例，截图模板通常保持为 1。 */
  scale: number
  /** 调用方显式提供的主题变量；框架不发明默认值，缺省时组件库自身主题生效。 */
  theme?: Partial<ThemeContext>
}

/** 允许调用方只覆盖部分运行时上下文的输入类型。 */
export type RenderContextInput = Omit<Partial<RenderContext>, 'theme'> & {
  /** 可局部覆盖的主题变量；只注入显式提供的字段。 */
  theme?: Partial<ThemeContext>
}

/** ktr dev/build 合并到内部 Vite 配置上的扩展配置。 */
export type KtrViteConfig =
  | ViteUserConfig
  | ((context: { command: 'serve' | 'build'; mode: string; config: ResolvedKtrConfig }) => ViteUserConfig | Promise<ViteUserConfig>)

/** 每个模板组件都会收到的 props。 */
export interface TemplateProps<D> {
  /** 当前模板使用的数据，类型由 defineTemplate 的泛型决定。 */
  data: D
  /** ktr 注入的运行时上下文。 */
  ctx: RenderContext
}

/** 模板定义对象，defineTemplate 会返回这个结构。 */
export interface TemplateDef<D> {
  /** 面板侧边栏展示名称。 */
  name?: string
  /** 面板顶部和侧边栏展示的模板描述。 */
  description?: string
  /** 实际渲染用户图片模板的 React 组件。 */
  component: React.ComponentType<TemplateProps<D>>
  /** 运行时数据校验函数，校验失败时 SSR 会返回错误。 */
  validate?: (data: unknown) => data is D
  /** 仅用于让 TypeScript 保留模板数据类型，不会在运行时读取。 */
  readonly __data?: D
}

/** 从模板定义中提取 data 类型。 */
export type DataOf<T> = T extends TemplateDef<infer D> ? D : never

/** 任意模板注册表，键名是约定路由，值是模板定义。 */
export type AnyRegistry = Record<string, TemplateDef<any>>

/**
 * 约定加载（loadTemplateRegistry）返回的注册表类型。
 * ktr sync 生成的模块增强生效时，ProjectRegistry 携带逐路由精确类型；
 * 未增强（或下游未运行 ktr sync）时退化为 AnyRegistry，路由与 data 类型放宽。
 */
export type LoadedRegistry = keyof ProjectRegistry extends never ? AnyRegistry : ProjectRegistry

export type { ProjectRegistry } from '../registry-types'

/** 渲染插件钩子收到的上下文。 */
export interface PluginContext {
  /** 当前模板路由，例如 hello/card。 */
  path: string
  /** 当前模板数据。 */
  data: unknown
  /** 当前运行时上下文。 */
  ctx: RenderContext
  /** HTML 文件输出目录。 */
  outputDir: string
}

/** SSR 渲染阶段的可插拔扩展。 */
export interface RenderPlugin {
  /** 插件名称，用于日志和调试。 */
  name: string
  /** 执行顺序，pre 先执行，post 后执行。 */
  enforce?: 'pre' | 'normal' | 'post'
  /** 返回 false 时跳过当前模板。 */
  apply?: (path: string) => boolean
  /** 生成 HTML 前执行。 */
  beforeRender?: (ctx: PluginContext) => void | Promise<void>
  /** 生成模板片段后执行，可以返回修改后的 HTML。 */
  afterRender?: (ctx: PluginContext & { html: string }) => string | void | Promise<string | void>
}

/** HTML 包裹器选项，主要用于 SSR 输出文件。 */
export interface HtmlWrapperOptions {
  /** 已构建好的模板 CSS 文件路径。 */
  cssPath: string
  /** 额外注入到 HTML 中的样式文件。 */
  extraStylePaths?: string[]
  /** 追加到 head 中的原始 HTML。 */
  headExtra?: string
}

/** createRenderer 的初始化选项。 */
export interface RendererOptions {
  /** 截图模板 CSS 路径，通常来自 resolveTemplateStyle。 */
  cssPath: string
  /** SSR 生成的 HTML 输出目录。 */
  outputDir: string
  /** 额外样式文件路径。 */
  extraStylePaths?: string[]
  /** SSR 渲染插件列表。 */
  plugins?: RenderPlugin[]
  /** 开发环境下捕获真实渲染数据的目录，默认写入 template。 */
  captureDir?: string
  /**
   * 输出 HTML 文件命名方式：
   * - 'fixed'（默认）：每个模板固定一个 HTML 文件覆盖写（如 hello_card.html），不再随机堆积。
   * - 'timestamp'：保留旧的 `文件主名_${Date.now()}.html` 随机命名，并发渲染场景可选。
   * - 函数形式：完全自定义命名，接收模板路由，返回不含扩展名的文件主名。
   */
  htmlFileName?: 'fixed' | 'timestamp' | ((templatePath: string) => string)
  /** HTML 外壳配置。 */
  html?: {
    /** 追加到 head 的原始 HTML。 */
    headExtra?: string
  }
}

/** 单次 SSR 渲染的结果。 */
export interface RenderResult {
  /** 是否渲染成功。 */
  success: boolean
  /** 成功时生成的 HTML 文件路径。 */
  htmlPath: string
  /** 失败时的错误信息。 */
  error?: string
}

/**
 * `karin.template.ts` 支持的用户配置。
 *
 * 大多数情况下你只需要关心 `dev` 和 `vite`；目录全部有约定默认值，
 * 不写就是推荐布局。构建期的产物目录由 `@karinjs/template-react/plugin`
 * 的 `ktrBuildPlugin` 全权接管（跟随打包器自己的 outDir），无需在这里配置。
 *
 * @example
 * ```ts
 * import { defineConfig } from '@karinjs/template-react'
 *
 * export default defineConfig({
 *   dev: { port: 5180, open: true },
 *   // 需要自定义目录时才写 dir，例如：
 *   // dir: { template: 'src/views', assets: 'src/views/public' }
 * })
 * ```
 */
export interface KtrConfig {
  /**
   * 目录约定，全部相对于项目根目录解析。
   *
   * 默认布局（不写 `dir` 时的推荐结构）：
   *
   * ```text
   * ktr/
   * ├── template/            # 模板：目录即路由，<板块>/<模板>/index.tsx
   * │   ├── style.css        # Tailwind 入口（缺失时首次启动自动补）
   * │   └── hello/card/      # 一个模板
   * │       ├── index.tsx
   * │       ├── mock.ts
   * │       └── data/*.json
   * └── public/              # 静态资源（图片、字体文件等）
   * .ktr/                    # 框架产物缓存，类似 Next.js 的 .next，勿手动编辑
   * ```
   *
   * 两个不可配的固定位置：框架缓存强制为项目根的 `.ktr/`；构建产物目录
   * 由 `@karinjs/template-react/plugin` 的 `ktrBuildPlugin` 跟随打包器自己的 outDir。
   */
  dir?: {
    /**
     * 模板根目录。组件、mock、JSON 数据和 `style.css` 都按约定放在这里。
     * 只有 `<板块>/<模板>/index.tsx` 会被注册为路由；`components/` 和 `_` 开头的目录不参与扫描。
     * mock 数据固定在各自模板的 `data/` 子目录，与模板共置，不可单独配置。
     * @default 'ktr/template'
     */
    template?: string
    /**
     * 静态资源目录（图片等）。dev server 会把它作为 publicDir 挂在根路径上
     * （`public/image/logo.png` 在模板里以 `/image/logo.png` 引用），
     * 构建时由 `ktrBuildPlugin` 整个目录复制到 `<产物目录>/assets`。
     * @default 'ktr/public'（模板目录的同级 public）
     */
    assets?: string
    /**
     * Tailwind CSS 入口文件。默认自动探测 `<dir.template>/style.css`，
     * 缺失时首次启动由框架自动补一份三行入口（tailwindcss + ktr 样式基座 + @source）。
     * @default '<dir.template>/style.css'
     */
    cssEntry?: string
  }
  /**
   * 额外注入 SSR HTML 的样式文件列表（相对项目根目录），
   * 内容会被内联进渲染产物的 `<style>` 标签，CSS 里相对路径的 `url()` 资源会转成 data URI。
   * @example extraStylePaths: ['ktr/template/print.css']
   */
  extraStylePaths?: string[]
  /** 开发面板配置。 */
  dev?: {
    /**
     * `ktr dev` 监听端口。被占用时自动回退到下一个可用端口，
     * 并在启动详情里打印占用进程和释放命令。
     * @default 5180
     */
    port?: number
    /**
     * `ktr dev` 监听主机。`localhost` 只允许本机访问；要暴露给局域网设 `'0.0.0.0'`。
     * @default 'localhost'
     */
    host?: string
    /**
     * 启动后是否自动打开浏览器。CLI 显式传 `--open` / `--no-open` 时覆盖此项。
     * @default true
     */
    open?: boolean
  }
  /** SSR HTML 外壳配置。 */
  html?: {
    /**
     * 追加到渲染产物 `<head>` 的原始 HTML，比如额外的 `<link>` 字体、`<meta>` 标签。
     * @example headExtra: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik">'
     */
    headExtra?: string
  }
  /**
   * 透传并合并到 ktr 内部的 Vite 配置（dev server 和 CSS 构建都会用到），
   * 是下游的扩展位：加插件、改 define、调 resolve.alias 都写在这里。
   * 不会加载下游项目自己的 `vite.config.ts`（那是生产打包配置），两者互不影响。
   */
  vite?: KtrViteConfig
}

/** 合并默认值、用户配置和命令行覆盖后的最终配置。 */
export interface ResolvedKtrConfig {
  /** 项目根目录。 */
  root: string
  /** 已解析为绝对路径的模板根目录。 */
  templateDir: string
  /** 已解析为绝对路径的自动注册缓存目录，固定为项目根的 `.ktr`。 */
  cacheDir: string
  /** 已解析为绝对路径的 mock 数据目录，固定等于 templateDir（与模板共置）。 */
  mockDataDir: string
  /** 已解析为绝对路径的静态资源目录。 */
  assetsDir: string
  /** 已解析为绝对路径的构建输出目录，固定为 `dist/template`；打包时由构建插件跟随打包器 outDir 另行覆盖。 */
  outDir: string
  /** 已解析为绝对路径的 CSS 入口。 */
  cssEntry?: string
  /** 已解析为绝对路径的额外样式文件。 */
  extraStylePaths: string[]
  /** 开发面板最终配置。 */
  dev: {
    /** 监听端口。 */
    port: number
    /** 监听主机。 */
    host: string
    /** 是否自动打开浏览器。 */
    open: boolean
  }
  /** SSR HTML 外壳最终配置。 */
  html: {
    /** 追加到 head 的原始 HTML。 */
    headExtra: string
  }
  /** 用户传入的 Vite 扩展配置。 */
  vite?: KtrViteConfig
}

/** resolveConfig/loadConfig 的选项。 */
export interface ResolveConfigOptions {
  /** 指定解析配置时使用的项目根目录。 */
  cwd?: string
  /** 指定配置文件路径。 */
  configFile?: string
  /** 命令行或测试中临时覆盖的配置。 */
  overrides?: KtrConfig
}

/** 构建模板 CSS 的可选覆盖项（内部供 dev 缓存与构建插件使用）。 */
export interface BuildTemplatesOptions extends Partial<ResolvedKtrConfig> {
  /** 构建目标项目根目录。 */
  root?: string
}

/** 模板 CSS 构建的产物统计。 */
export interface BuildTemplatesResult {
  /** 构建后的 CSS 文件路径。 */
  cssPath: string
  /** 约定扫描到的模板数量。 */
  templatesCount: number
  /** CSS 文件大小，单位为字节。 */
  cssSize: number
}

/** ktr dev 返回的服务句柄。 */
export interface DevServerHandle {
  /** 面板访问地址。 */
  url: string
  /** 关闭开发服务。 */
  close: () => Promise<void>
}
