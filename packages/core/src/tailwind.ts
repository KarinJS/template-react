import { createRequire } from 'node:module'

// ESM 里没有 require.resolve，用 createRequire 定位 tailwindcss 包内 CSS 文件的绝对路径。
const require = createRequire(import.meta.url)

/** 把 Tailwind CSS 的包入口固定到浏览器可加载的 CSS 文件。 */
export const tailwindCssAlias = {
  find: /^tailwindcss$/,
  replacement: require.resolve('tailwindcss/index.css')
}
