import { createRequire } from 'node:module'
import path from 'node:path'

import type { Plugin } from 'vite'

// ESM 里没有 require.resolve，用 createRequire 定位 tailwindcss 包内 CSS 文件的绝对路径。
const require = createRequire(import.meta.url)

/** 把 Tailwind CSS 的包入口固定到浏览器可加载的 CSS 文件。 */
export const tailwindCssAlias = {
  find: /^tailwindcss$/,
  replacement: require.resolve('tailwindcss/index.css')
}

/**
 * 在 Vite 内存转换阶段关闭 Tailwind 的项目级自动扫描。
 *
 * 下游 CSS 保持标准的 `@import 'tailwindcss';`，避免编辑器把 Tailwind 专用的
 * `source(none)` import modifier 当成非法 CSS。只有入口已经声明显式 `@source`
 * 时才收紧扫描范围，用户自定义且依赖自动扫描的 CSS 不受影响。
 */
export const tailwindSourceScopePlugin = (cssEntry: string): Plugin => {
  const normalizedEntry = path.resolve(cssEntry)

  return {
    name: 'ktr-tailwind-source-scope',
    enforce: 'pre',
    transform(code, id) {
      const filePath = id.split('?', 1)[0] ?? id
      if (path.resolve(filePath) !== normalizedEntry || !/@source\s+/.test(code)) {
        return null
      }

      const scoped = code.replace(/@import\s+(['"])tailwindcss\1\s*;/, (statement) => statement.replace(/;$/, ' source(none);'))
      return scoped === code ? null : { code: scoped, map: null }
    }
  }
}
