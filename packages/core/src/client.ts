import type { KtrConfig, TemplateDef } from './types'

/**
 * 定义一个截图模板，并把数据类型保留给注册表推导。
 * 组件 props 已标注 TemplateProps<D> 时泛型 D 可省略（从 component 自动推断）；
 * 内联匿名组件或需要显式声明时再写 defineTemplate<D>(...)。
 * @param def 模板定义对象。
 * @returns 原样返回的模板定义。
 */
export const defineTemplate = <D>(def: Omit<TemplateDef<D>, '__data'>): TemplateDef<D> => def

/**
 * 定义一份类型安全的 mock 数据，适合在模板的 mock.ts 中复用。
 * @param data mock 数据对象。
 * @returns 原样返回的 mock 数据。
 */
export const defineMock = <D>(data: D): D => data

/**
 * 定义 karin.template.ts 配置，主要用于获得完整的类型提示。
 * @param config 用户配置对象。
 * @returns 原样返回的配置对象。
 */
export const defineConfig = (config: KtrConfig): KtrConfig => config

export type {
  AnyRegistry,
  BuildTemplatesOptions,
  BuildTemplatesResult,
  DataOf,
  DevServerHandle,
  HtmlWrapperOptions,
  KtrConfig,
  KtrStandaloneConfig,
  KtrViteConfig,
  LoadedRegistry,
  PluginContext,
  ProjectRegistry,
  RenderContext,
  RenderContextInput,
  RendererOptions,
  RenderPlugin,
  RenderResult,
  ResolvedKtrConfig,
  ResolveConfigOptions,
  StandaloneBuildResult,
  TemplateDef,
  TemplateProps,
  ThemeContext
} from './types'
