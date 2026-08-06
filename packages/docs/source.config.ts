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
      transformers: [
        transformerTwoslash({
          twoslashOptions: {
            compilerOptions: {
              // 与下游模板的 tsconfig 一致：JSX 走自动运行时，组件里不需要 import React
              jsx: ts.JsxEmit.ReactJSX
            }
          }
        })
      ]
    }
  }
})
