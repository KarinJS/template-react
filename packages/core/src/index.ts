/** @karinjs/template-react 主入口，导出模板定义、配置、开发服务器和 SSR 运行时能力。 */
export { defineConfig, defineMock, defineTemplate } from './client'
export type {
  AnyRegistry,
  BuildTemplatesOptions,
  BuildTemplatesResult,
  DataOf,
  DevServerHandle,
  HtmlWrapperOptions,
  KtrConfig,
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
  TemplateDef,
  TemplateProps,
  ThemeContext
} from './client'

export { buildTemplates } from './build'
export { resolveConfig } from './config'
export { createDevServer } from './dev/server'
export { createRenderer, resolveTemplateStyle } from './runtime'
