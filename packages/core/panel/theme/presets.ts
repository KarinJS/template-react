import type { ThemeKnobs } from './knobs'

/**
 * 主题预设。
 *
 * 数值一比一移植自 HeroUI 官方文档主题编辑器（apps/docs/src/app/[lang]/themes/theme-values.ts），
 * 只取配色基调 + 圆角：hue / chroma / lightness / base / radius / formRadius。
 * 官方各预设的 semanticOverrides（Netflix 红等品牌语义色）不移植——
 * ktr 的语义色走色相联动公式，逐预设覆盖会让模型复杂一倍。
 *
 * 字体也不进预设：官方预设的 fontFamily 清一色是 inter，对中文模板没有参考意义。
 */

/** 一个主题预设。 */
export interface ThemePreset {
  /** 稳定标识。 */
  id: string
  /** 预设名称（品牌名保持英文原文）。 */
  label: string
  /** 强调色色相（度）。 */
  hue: number
  /** 强调色彩度。 */
  chroma: number
  /** 强调色明度。 */
  lightness: number
  /** 中性色染色量。 */
  base: number
  /** 全局圆角基准值。 */
  radius: string
  /** 表单元素圆角。 */
  formRadius: string
}

/** 官方 base 常量：默认灰阶染色量与两个离散档。 */
const baseDefault = 0.0015
const baseFullLeft = 0
const base10pLeft = 0.002
const base50p = 0.01

/** 圆角档位的 CSS 值，与 knobs.ts 的 radiusOptions / formRadiusOptions 对齐。 */
const radiusValues = {
  none: '0rem',
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem'
} as const

/** 全部预设，顺序与官方 themeIds 一致。 */
export const themePresets: readonly ThemePreset[] = [
  {
    id: 'default',
    label: 'Default',
    hue: 253.83,
    chroma: 0.195,
    lightness: 0.6204,
    base: baseDefault,
    radius: radiusValues.md,
    formRadius: radiusValues.lg
  },
  {
    id: 'sky',
    label: 'Sky',
    hue: 225,
    chroma: 0.16,
    lightness: 0.78,
    base: baseDefault,
    radius: radiusValues.md,
    formRadius: radiusValues.lg
  },
  {
    id: 'lavender',
    label: 'Lavender',
    hue: 305,
    chroma: 0.13,
    lightness: 0.77,
    base: baseDefault,
    radius: radiusValues.md,
    formRadius: radiusValues.lg
  },
  {
    id: 'mint',
    label: 'Mint',
    hue: 155,
    chroma: 0.12,
    lightness: 0.82,
    base: baseDefault,
    radius: radiusValues.md,
    formRadius: radiusValues.lg
  },
  {
    id: 'netflix',
    label: 'Netflix',
    hue: 27.99,
    chroma: 0.2349,
    lightness: 0.5814,
    base: baseFullLeft,
    radius: radiusValues.xs,
    formRadius: radiusValues.xs
  },
  { id: 'uber', label: 'Uber', hue: 0, chroma: 0, lightness: 0, base: baseFullLeft, radius: radiusValues.sm, formRadius: radiusValues.sm },
  {
    id: 'spotify',
    label: 'Spotify',
    hue: 148.67,
    chroma: 0.2124,
    lightness: 0.7697,
    base: base10pLeft,
    radius: radiusValues.md,
    formRadius: radiusValues.xs
  },
  {
    id: 'coinbase',
    label: 'Coinbase',
    hue: 262.87,
    chroma: 0.2628,
    lightness: 0.5282,
    base: base10pLeft,
    radius: radiusValues.md,
    formRadius: radiusValues.xs
  },
  {
    id: 'airbnb',
    label: 'Airbnb',
    hue: 17.07,
    chroma: 0.2309,
    lightness: 0.6579,
    base: baseFullLeft,
    radius: radiusValues.md,
    formRadius: radiusValues.lg
  },
  {
    id: 'discord',
    label: 'Discord',
    hue: 273.85,
    chroma: 0.2091,
    lightness: 0.5774,
    base: base50p,
    radius: radiusValues.sm,
    formRadius: radiusValues.lg
  },
  {
    id: 'rabbit',
    label: 'Rabbit',
    hue: 36.66,
    chroma: 0.2232,
    lightness: 0.6678,
    base: base50p,
    radius: radiusValues.md,
    formRadius: radiusValues.xl
  }
]

/** 参与预设匹配的旋钮键，对应官方 themeComparisonKeys（去掉 fontFamily）。 */
const presetComparisonKeys = ['hue', 'chroma', 'lightness', 'base', 'radius', 'formRadius'] as const

/** 浮点容差，与官方 findMatchingTheme 一致。 */
const tolerance = 1e-4

/**
 * 找出与当前旋钮匹配的预设。
 *
 * 返回 undefined 表示没有命中任何预设，即「自定义」主题。
 * vibrant 不参与匹配：它是叠加在任意预设之上的修饰开关。
 */
export const findMatchingPreset = (knobs: Pick<ThemeKnobs, (typeof presetComparisonKeys)[number]>): ThemePreset | undefined => {
  for (const preset of themePresets) {
    const matches = presetComparisonKeys.every((key) => {
      const current = knobs[key]
      const expected = preset[key]

      if (typeof current === 'number' && typeof expected === 'number') {
        return Math.abs(current - expected) < tolerance
      }

      return current === expected
    })

    if (matches) {
      return preset
    }
  }

  return undefined
}
