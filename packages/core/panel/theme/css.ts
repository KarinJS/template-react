import { darkPalette, hueShiftMax, lightPalette, semanticColors } from './palette'
import { calculateForeground, formatOklch, normalizeHue, withChroma, withHue, type OklchColor } from './oklch'
import type { ThemeKnobs } from './knobs'

/**
 * CSS 生成。
 *
 * 把旋钮展开成完整的 CSS 变量集：
 * - 明暗双调色板，每个键映射成 --kebab-case
 * - 主色及其派生色（hover / soft / foreground）
 * - 语义色（success / warning / danger）
 * - 圆角阶梯（--radius-xs ~ --radius-4xl）
 * - 字体变量（--font-sans / --font-mono）
 */

/**
 * 色块层级权重。
 *
 * base 旋钮控制"灰阶偏向主色色相的程度"；层级越深、越容易染色，
 * 这样背景和表面色在主题切换时会有微妙的呼应，同时不影响文字对比度。
 */
const layerWeights: Record<keyof typeof lightPalette, { light: number; dark: number }> = {
  background: { light: 1, dark: 1 },
  foreground: { light: 1, dark: 1 },
  surface: { light: 0.5, dark: 2 },
  surfaceSecondary: { light: 0.8, dark: 1.5 },
  surfaceTertiary: { light: 0.8, dark: 1.5 },
  overlay: { light: 0.3, dark: 2 },
  muted: { light: 2, dark: 2 },
  default: { light: 1, dark: 1 },
  defaultForeground: { light: 1, dark: 1 },
  segment: { light: 1, dark: 1 },
  border: { light: 1, dark: 1 },
  separator: { light: 1, dark: 1 },
  fieldBackground: { light: 0.5, dark: 2 },
  fieldForeground: { light: 1, dark: 1 }
}

/** camelCase 转 kebab-case（变量名规则）。 */
const toKebab = (key: string): string => `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`

/**
 * 语义色跟主色色相联动（HeroUI 原设计是固定色相，这里允许旋转）。
 */
const shiftSemanticHue = (semanticHue: number, mainHue: number): number => normalizeHue(semanticHue + (mainHue - 253.83) * hueShiftMax)

/**
 * 染色：根据 base 旋钮把调色板里的颜色偏向主色色相，彩度等比缩放。
 */
const tintColor = (color: OklchColor, mainHue: number, baseAmount: number): OklchColor => withChroma(withHue(color, mainHue), baseAmount)

/**
 * 生成单色模式的全部变量。
 *
 * 输出格式：`{ '--accent': 'oklch(...)', '--success': 'oklch(...)', ... }`
 */
const generateColorVars = (knobs: ThemeKnobs, mode: 'light' | 'dark'): Record<string, string> => {
  const mainHue = normalizeHue(knobs.hue)
  const accentColor: OklchColor = { l: knobs.lightness, c: knobs.chroma, h: mainHue }
  const accentFg = calculateForeground(accentColor)

  const palette = mode === 'light' ? lightPalette : darkPalette
  const vars: Record<string, string> = {}

  // 1. 基础调色板（染色后）
  for (const [key, color] of Object.entries(palette)) {
    const weight = layerWeights[key as keyof typeof palette]?.[mode] ?? 1
    const tinted = tintColor(color, mainHue, knobs.base * weight)
    vars[toKebab(key)] = formatOklch(tinted)
  }

  // 2. 主色及其前景
  vars['--accent'] = formatOklch(accentColor)
  vars['--accent-foreground'] = formatOklch(accentFg)
  vars['--focus'] = vars['--accent']!
  vars['--link'] = vars['--foreground']!

  // 与官方 generate-theme-colors 的 chromaBoost 一致：1 + grayChroma * 2。
  // 语义色随灰阶染色量一起微微提彩，让整套配色观感统一。
  // 注意 variables.css 里的 0.1935 等是「未提彩」的基准值，官方默认
  // 同样会放大约 1.95%，所以这里不能为了对齐那份文件而消掉 boost。
  const chromaScale = Math.min(1 + knobs.base * 2, 1.35)
  for (const [name, semantic] of Object.entries(semanticColors)) {
    // 暗色模式下语义色的基准色相与亮色不同（HeroUI 官方 variables.css 如此）。
    const baseHue = mode === 'light' ? semantic.hueLight : semantic.hueDark
    const hue = shiftSemanticHue(baseHue, mainHue)
    const l = mode === 'light' ? semantic.lightnessLight : semantic.lightnessDark
    const cBase = mode === 'light' ? semantic.chromaLight : semantic.chromaDark
    const c = Math.min(cBase * chromaScale, 0.35)
    const color: OklchColor = { l, c, h: hue }
    vars[`--${name}`] = formatOklch(color)
    vars[`--${name}-foreground`] = formatOklch(calculateForeground(color))
  }

  // 4. 表面层前景（统一指向 --foreground）
  vars['--surface-foreground'] = vars['--foreground']!
  vars['--surface-secondary-foreground'] = vars['--foreground']!
  vars['--surface-tertiary-foreground'] = vars['--foreground']!
  vars['--overlay-foreground'] = vars['--foreground']!
  vars['--segment-foreground'] = vars['--foreground']!

  // 5. 字段占位符和滚动条指向 --muted
  vars['--field-placeholder'] = vars['--muted']!
  vars['--scrollbar'] = vars['--muted']!

  // 6. 字段边框透明（HeroUI 默认无描边）
  vars['--field-border'] = 'transparent'

  // 7. 反色背景（明暗互换时用）
  vars['--background-inverse'] = vars['--foreground']!

  return vars
}

/**
 * 派生色算法（hover / soft），HeroUI 用 `color-mix(in oklab, ...)` 实现。
 *
 * 明暗模式混合比例不同：亮色模式 hover 混 10%，soft 混 15%；
 * 暗色模式分别是 10% 和 12%，避免过亮。
 */
const generateDerivedVars = (mode: 'light' | 'dark'): Record<string, string> => {
  const softMix = mode === 'light' ? 15 : 12
  const softHoverMix = mode === 'light' ? 20 : 16

  const vars: Record<string, string> = {}

  // 表面 hover
  vars['--surface-hover'] = `color-mix(in oklab, var(--surface) 92%, var(--surface-foreground) 8%)`

  // 背景多层
  vars['--background-secondary'] = `color-mix(in oklab, var(--background) 96%, var(--foreground) 4%)`
  vars['--background-tertiary'] = `color-mix(in oklab, var(--background) 92%, var(--foreground) 8%)`

  // 边框多层
  vars['--border-secondary'] = `color-mix(in oklab, var(--surface) 78%, var(--surface-foreground) 22%)`
  vars['--border-tertiary'] = `color-mix(in oklab, var(--surface) 66%, var(--surface-foreground) 34%)`

  // 分隔符多层
  vars['--separator-secondary'] = `color-mix(in oklab, var(--surface) 85%, var(--surface-foreground) 15%)`
  vars['--separator-tertiary'] = `color-mix(in oklab, var(--surface) 81%, var(--surface-foreground) 19%)`

  // 字段状态
  vars['--field-focus'] = 'var(--field-background, var(--default))'
  vars['--field-hover'] = `color-mix(in oklab, var(--field-background, var(--default)) 90%, var(--field-foreground, var(--foreground)) 2%)`
  vars['--field-border-hover'] =
    `color-mix(in oklab, var(--field-border, var(--border)) 88%, var(--field-foreground, var(--foreground)) 10%)`
  vars['--field-border-focus'] =
    `color-mix(in oklab, var(--field-border, var(--border)) 74%, var(--field-foreground, var(--foreground)) 22%)`

  // 语义色三件套的 hover / soft 用同一套比例。
  for (const key of ['accent', 'success', 'warning', 'danger']) {
    vars[`--${key}-hover`] = `color-mix(in oklab, var(--${key}) 90%, var(--${key}-foreground) 10%)`
    vars[`--${key}-soft`] = `color-mix(in oklab, var(--${key}) ${softMix}%, transparent)`
    vars[`--${key}-soft-hover`] = `color-mix(in oklab, var(--${key}) ${softHoverMix}%, transparent)`
  }

  // soft-foreground 的混合比例每种色各不相同，且亮暗有别：
  // 这些数字是官方为可读性逐个调过的，不能用一个统一公式代替。
  const softForegroundMix: Record<string, { light: string; dark: string }> = {
    accent: { light: '70%, var(--foreground) 30%', dark: '80%, var(--foreground) 30%' },
    success: { light: '80%, var(--foreground) 60%', dark: '80%, var(--foreground) 30%' },
    warning: { light: '80%, var(--foreground) 70%', dark: '80%, var(--foreground) 30%' },
    danger: { light: '70%, var(--foreground) 40%', dark: '80%, var(--foreground) 30%' }
  }
  for (const [key, mix] of Object.entries(softForegroundMix)) {
    vars[`--${key}-soft-foreground`] = `color-mix(in oklab, var(--${key}) ${mix[mode]})`
  }

  // default 是中性色，比例与语义色不同：hover 只挪 4%，soft 用 50%。
  vars['--default-hover'] = 'color-mix(in oklab, var(--default) 96%, var(--default-foreground) 4%)'
  vars['--default-soft'] = 'color-mix(in oklab, var(--default) 50%, transparent)'
  vars['--default-soft-hover'] = 'color-mix(in oklab, var(--default) 60%, transparent)'
  vars['--default-soft-foreground'] = 'var(--default-foreground)'

  // danger 的 soft 固定 15% / 20%，不随明暗变化。
  vars['--danger-soft'] = 'color-mix(in oklab, var(--danger) 15%, transparent)'
  vars['--danger-soft-hover'] = 'color-mix(in oklab, var(--danger) 20%, transparent)'

  // 焦点环直接复用 --focus。
  vars['--tw-ring-color'] = 'var(--focus)'

  return vars
}

/** 圆角阶梯，全部基于 --radius 计算。 */
const radiusVars: Record<string, string> = {
  '--radius-xs': 'calc(var(--radius) * 0.25)',
  '--radius-sm': 'calc(var(--radius) * 0.5)',
  '--radius-md': 'calc(var(--radius) * 0.75)',
  '--radius-lg': 'calc(var(--radius) * 1)',
  '--radius-xl': 'calc(var(--radius) * 1.5)',
  '--radius-2xl': 'calc(var(--radius) * 2)',
  '--radius-3xl': 'calc(var(--radius) * 3)',
  '--radius-4xl': 'calc(var(--radius) * 4)',
  '--radius-field': 'var(--field-radius, var(--radius-xl))'
}

/** 字体和基准圆角（不分明暗）。 */
const generateStaticVars = (knobs: ThemeKnobs): Record<string, string> => ({
  '--radius': knobs.radius,
  '--field-radius': 'calc(var(--radius) * 1.5)',
  '--font-sans': knobs.fontSans,
  '--font-mono': knobs.fontMono
})

/** 把变量对象格式化成 CSS 声明块（带缩进）。 */
const formatVars = (vars: Record<string, string>, indent = '  '): string =>
  Object.entries(vars)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n')

/**
 * 生成注入沙盒的 CSS：完整变量表，明暗两套一次性下发。
 *
 * 两套都写进同一段 CSS，切换明暗时只是选择器命中变化，不需要重算，
 * 所以切换是瞬时的、也不会闪一下旧颜色。
 */
export const generateSandboxCss = (knobs: ThemeKnobs): string => {
  const staticVars = generateStaticVars(knobs)
  const lightVars = { ...generateColorVars(knobs, 'light'), ...generateDerivedVars('light') }
  const darkVars = { ...generateColorVars(knobs, 'dark'), ...generateDerivedVars('dark') }

  return `:root,
.light,
[data-theme='light'] {
${formatVars({ ...staticVars, ...radiusVars, ...lightVars })}
}

.dark,
[data-theme='dark'] {
${formatVars(darkVars)}
}
`
}

/**
 * 生成导出用的 CSS，供用户复制进 `template/style.css`。
 *
 * 与沙盒版的区别：带说明注释、不含 hover/soft 派生色和圆角阶梯——
 * 那些由 `@karinjs/template-react/styles` 提供，重复写只会让用户要维护的代码变长。
 */
export const generateExportCss = (knobs: ThemeKnobs): string => {
  const staticVars = generateStaticVars(knobs)
  const lightVars = generateColorVars(knobs, 'light')
  const darkVars = generateColorVars(knobs, 'dark')

  return `/*
 * ktr 模板主题 —— 由开发面板的主题构建器生成
 * 粘贴到 template/style.css 的 @import 之后即可生效
 * 只包含需要覆盖的变量，hover / soft 等派生色由 @karinjs/template-react/styles 提供
 */

:root,
.light,
[data-theme='light'] {
${formatVars({ ...staticVars, ...lightVars })}
}

.dark,
[data-theme='dark'] {
  color-scheme: dark;
${formatVars(darkVars)}
}
`
}
