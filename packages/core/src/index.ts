/** @karinjs/template-react 主入口，导出模板定义、配置和 SSR 运行时能力。 */
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

// 注意：不要从这里再导出 dev server / build 等依赖 Vite 的能力（CLI 内部走相对路径引用），
// 否则下游 tsdown 打包模板组件时会把 Vite 的动态导入子树发成死 chunk 落进产物目录。
export { resolveConfig } from './config'
export {
  HtmlWrapper,
  PluginContainer,
  capturedDataFileName,
  createRenderer,
  createTemplateRenderer,
  loadMockRegistry,
  loadTemplateRegistry,
  resolveTemplateStyle,
  saveCapturedData
} from './runtime'
