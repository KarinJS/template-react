/**
 * 构建期虚拟模块的类型声明。
 *
 * 内容由 build/scaffold-examples.ts 的插件从 packages/core/examples 扫描注入，
 * 构建（tsdown）和测试（vitest）都会解析到它。
 */
declare module 'virtual:ktr-scaffold-examples' {
  /** 示例模板文件清单：path 相对下游项目根目录，content 为文件全文。 */
  export const exampleTemplateFiles: Array<{ path: string; content: string }>
}
