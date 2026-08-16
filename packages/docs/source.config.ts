import { defineConfig } from 'fumadocs-mdx/config'
import { transformerTwoslash } from 'fumadocs-twoslash'
import ts from 'typescript'

// Twoslash：代码块带类型悬浮提示。工作区包 @karinjs/template-react 的类型来自其 dist 产物，
// 因此 docs 构建前需保证 packages/core 已构建（docs 的 prebuild 脚本已自动处理）。
export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      // fumadocs 默认的明暗双主题，自定义 transformers 时需要显式补全
      themes: { light: 'github-light', dark: 'github-dark' },
      // twoslash 悬浮弹窗里的 Markdown 代码示例只会用预加载的语言高亮，缺了会告警；
      // 显式给出全量语言并给 console 注册 shellsession 别名
      langs: ['ts', 'tsx', 'js', 'jsx', 'json', 'jsonc', 'bash', 'shellsession', 'http', 'css', 'yaml', 'mdx'],
      langAlias: { console: 'shellsession' },
      transformers: [
        transformerTwoslash({
          twoslashOptions: {
            compilerOptions: {
              // 与下游模板的 tsconfig 一致：JSX 走自动运行时，组件里不需要 import React
              jsx: ts.JsxEmit.ReactJSX,
              // twoslash 的 vfs 不会自动包含 @types 全局包，显式引入需要的类型，
              // 否则示例里的 node:path / process / import.meta.hot 等会报错
              types: ['node', 'vite/client'],
              // 展示 .ktr 生成物时需要：导入路径带 .tsx 扩展名、import JSON 文件
              allowImportingTsExtensions: true,
              noEmit: true,
              resolveJsonModule: true,
              esModuleInterop: true
            }
          }
        })
      ]
    }
  }
})
