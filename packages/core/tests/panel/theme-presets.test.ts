import { describe, expect, it } from 'vitest'

import { defaultKnobs, type ThemeKnobs } from '../../panel/theme/knobs'
import { findMatchingPreset, themePresets, type ThemePreset } from '../../panel/theme/presets'

/**
 * 预设数值与 HeroUI 官方主题编辑器（apps/docs/.../themes/theme-values.ts）一一对应。
 * 这里的期望值表就是官方数据，改动预设时必须两边同步。
 */

/** 官方 radiusId 到 CSS 值的映射。 */
const radiusCss = {
  none: '0rem',
  'extra-small': '0.125rem',
  small: '0.25rem',
  medium: '0.5rem',
  large: '0.75rem',
  'extra-large': '1rem'
} as const

/** 官方 theme-values.ts 的 11 个预设（base 常量：DEFAULT_BASE=0.0015、FULL_LEFT=0、10P_LEFT=0.002、50P=0.01）。 */
const official: Record<
  string,
  { hue: number; chroma: number; lightness: number; base: number; radius: keyof typeof radiusCss; formRadius: keyof typeof radiusCss }
> = {
  default: { hue: 253.83, chroma: 0.195, lightness: 0.6204, base: 0.0015, radius: 'medium', formRadius: 'large' },
  sky: { hue: 225, chroma: 0.16, lightness: 0.78, base: 0.0015, radius: 'medium', formRadius: 'large' },
  lavender: { hue: 305, chroma: 0.13, lightness: 0.77, base: 0.0015, radius: 'medium', formRadius: 'large' },
  mint: { hue: 155, chroma: 0.12, lightness: 0.82, base: 0.0015, radius: 'medium', formRadius: 'large' },
  netflix: { hue: 27.99, chroma: 0.2349, lightness: 0.5814, base: 0, radius: 'extra-small', formRadius: 'extra-small' },
  uber: { hue: 0, chroma: 0, lightness: 0, base: 0, radius: 'small', formRadius: 'small' },
  spotify: { hue: 148.67, chroma: 0.2124, lightness: 0.7697, base: 0.002, radius: 'medium', formRadius: 'extra-small' },
  coinbase: { hue: 262.87, chroma: 0.2628, lightness: 0.5282, base: 0.002, radius: 'medium', formRadius: 'extra-small' },
  airbnb: { hue: 17.07, chroma: 0.2309, lightness: 0.6579, base: 0, radius: 'medium', formRadius: 'large' },
  discord: { hue: 273.85, chroma: 0.2091, lightness: 0.5774, base: 0.01, radius: 'small', formRadius: 'large' },
  rabbit: { hue: 36.66, chroma: 0.2232, lightness: 0.6678, base: 0.01, radius: 'medium', formRadius: 'extra-large' }
}

/** 把预设写成完整旋钮（字体/鲜艳开关沿用默认），等价于 useThemeBuilder 的 applyPreset。 */
const applyPreset = (preset: ThemePreset): ThemeKnobs => ({
  ...defaultKnobs,
  hue: preset.hue,
  chroma: preset.chroma,
  lightness: preset.lightness,
  base: preset.base,
  radius: preset.radius,
  formRadius: preset.formRadius
})

describe('themePresets', () => {
  it('11 个预设，顺序与官方 themeIds 一致', () => {
    expect(themePresets.map((preset) => preset.id)).toEqual([
      'default',
      'sky',
      'lavender',
      'mint',
      'netflix',
      'uber',
      'spotify',
      'coinbase',
      'airbnb',
      'discord',
      'rabbit'
    ])
  })

  it('每个预设的数值与官方 theme-values.ts 一致', () => {
    for (const preset of themePresets) {
      const expected = official[preset.id]!
      expect(preset.hue).toBe(expected.hue)
      expect(preset.chroma).toBe(expected.chroma)
      expect(preset.lightness).toBe(expected.lightness)
      expect(preset.base).toBe(expected.base)
      expect(preset.radius).toBe(radiusCss[expected.radius])
      expect(preset.formRadius).toBe(radiusCss[expected.formRadius])
    }
  })
})

describe('findMatchingPreset', () => {
  it('应用预设后能匹配回它自己', () => {
    for (const preset of themePresets) {
      expect(findMatchingPreset(applyPreset(preset))?.id).toBe(preset.id)
    }
  })

  it('浮点容差内的抖动仍算命中', () => {
    const preset = themePresets[0]!
    const jittered = { ...applyPreset(preset), hue: preset.hue + 1e-5 }
    expect(findMatchingPreset(jittered)?.id).toBe(preset.id)
  })

  it('无匹配时返回 undefined，表示「自定义」', () => {
    const custom = { ...applyPreset(themePresets[0]!), hue: 42 }
    expect(findMatchingPreset(custom)).toBeUndefined()
  })

  it('vibrant 不参与匹配', () => {
    const preset = themePresets[0]!
    const withVibrant = { ...applyPreset(preset), vibrant: true }
    expect(findMatchingPreset(withVibrant)?.id).toBe(preset.id)
  })
})
