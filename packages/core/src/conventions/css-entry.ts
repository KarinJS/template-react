import fs from 'node:fs'
import path from 'node:path'

import type { ResolvedKtrConfig } from '../types'

/**
 * 下游模板样式入口的标准内容。
 *
 * 关键是不再写 `@theme { --color-accent: var(--accent); ... }` 这类颜色映射块：
 * HeroUI 的 themes/shared/theme.css 已经用 `@theme inline` 把全套语义色桥到 Tailwind token 了，
 * 这里再写一遍**普通** `@theme` 会把 inline 桥接盖掉——普通 @theme 会把变量真的产出到 `:root`，
 * 于是 `bg-accent` 编译成 `var(--color-accent)`，主题色只能在 :root 层级改；
 * 而 inline 桥接编译出的是 `var(--accent)`，元素级 style 就能覆盖，SSR 只写 body 即可生效。
 * @param withThemeOverrides 是否附带 :root / .dark 换肤覆盖块。
 * @returns style.css 的完整文本。
 */
export const templateCssEntryContent = (withThemeOverrides = false): string => {
  const base = `@import 'tailwindcss';
@import '@karinjs/template-react/styles';
@source './**/*.{ts,tsx}';
`
  if (!withThemeOverrides) return base
  return `${base}
/* 改这里就能换肤，变量名见 https://heroui.com/cn/docs/react/getting-started/theming */
:root {
  /* --accent: oklch(0.62 0.19 254); */
  /* --radius: 0.5rem; */
}

.dark,
[data-theme='dark'] {
  /* --accent: oklch(0.72 0.16 254); */
}
`
}

/**
 * 确保模板样式入口存在，让零配置项目也能直接启动。
 * dev（sandbox 导入）和 build（Tailwind 编译入口）共用这一份实现，避免两处兜底内容漂移。
 * @param config 已解析的 ktr 配置。
 * @returns CSS 入口的绝对路径。
 */
export const ensureCssEntry = (config: ResolvedKtrConfig): string => {
  const cssEntry = config.cssEntry ?? path.join(config.templateDir, 'style.css')
  if (!fs.existsSync(cssEntry)) {
    fs.mkdirSync(path.dirname(cssEntry), { recursive: true })
    fs.writeFileSync(cssEntry, templateCssEntryContent(), 'utf-8')
  }
  return cssEntry
}
