/** SSR 运行时公共出口，供 karin 插件胶水层在 Node 环境中使用。 */
export { createRenderer } from './renderer'
export { resolveTemplateStyle } from './style'
export { HtmlWrapper } from './html-wrapper'
export { PluginContainer } from './plugins'
export { capturedDataFileName, saveCapturedData } from './capture'
export { loadMockRegistry, loadTemplateRegistry } from './registry-loader'
export type { LoadRegistryOptions } from './registry-loader'
export { createTemplateRenderer } from './template-renderer'
export type { TemplateRendererOptions, TemplateRenderFn } from './template-renderer'

export type {
  AnyRegistry,
  DataOf,
  HtmlWrapperOptions,
  LoadedRegistry,
  PluginContext,
  ProjectRegistry,
  RenderContext,
  RenderContextInput,
  RendererOptions,
  RenderPlugin,
  RenderResult,
  TemplateDef,
  TemplateProps,
  ThemeContext,
  VersionInfo
} from '../types'
