import { describe, expect, it } from 'vitest'

import {
  defaultKnobs,
  fontMonoOptions,
  fontSansOptions,
  isDefaultKnobs,
  presetFontCdnUrls,
  radiusOptions,
  sanitizeKnobs
} from '../../panel/theme/knobs'

describe('radiusOptions', () => {
  it('只到 L，不提供 XL', () => {
    // HeroUI 主题构建器的全局圆角同样止步 0.75rem：
    // 更大的值会把徽标、输入框这类小控件挤成胶囊。
    expect(radiusOptions.map((option) => option.id)).toEqual(['none', 'xs', 'sm', 'md', 'lg'])
    expect(radiusOptions.at(-1)?.value).toBe('0.75rem')
  })

  it('每项都带缩写，供网格卡片预览', () => {
    for (const option of radiusOptions) {
      expect(option.abbr).toBeTruthy()
    }
  })
})

describe('字体候选', () => {
  it('首项是系统字体栈且不需要联网', () => {
    expect(fontSansOptions[0]?.cdnUrl).toBeUndefined()
    expect(fontMonoOptions[0]?.cdnUrl).toBeUndefined()
  })

  it('除系统栈外全部走 CDN，不打包字体文件', () => {
    for (const option of [...fontSansOptions, ...fontMonoOptions].slice(1)) {
      if (option.id === 'system') continue
      expect(option.cdnUrl).toMatch(/^https:\/\//)
    }
  })

  it('presetFontCdnUrls 汇总所有 CDN 地址且不含 undefined', () => {
    expect(presetFontCdnUrls.length).toBeGreaterThan(0)
    for (const url of presetFontCdnUrls) {
      expect(url).toMatch(/^https:\/\//)
    }
  })
})

describe('isDefaultKnobs', () => {
  it('默认值判定为默认', () => {
    expect(isDefaultKnobs(defaultKnobs)).toBe(true)
  })

  it('浮点往返产生的极小误差仍算默认', () => {
    // 滑块经 toFixed 往返后可能差 1e-15，严格相等会让「恢复默认」按钮
    // 在视觉毫无变化时仍可点击。
    expect(isDefaultKnobs({ ...defaultKnobs, hue: defaultKnobs.hue + 1e-9 })).toBe(true)
  })

  it('可感知的改动判定为非默认', () => {
    expect(isDefaultKnobs({ ...defaultKnobs, hue: defaultKnobs.hue + 1 })).toBe(false)
    expect(isDefaultKnobs({ ...defaultKnobs, radius: '0rem' })).toBe(false)
  })
})

describe('sanitizeKnobs', () => {
  it('非对象输入回落到默认值', () => {
    expect(sanitizeKnobs(null)).toEqual(defaultKnobs)
    expect(sanitizeKnobs('nope')).toEqual(defaultKnobs)
    expect(sanitizeKnobs(undefined)).toEqual(defaultKnobs)
  })

  it('数值超界被夹到合法区间', () => {
    const result = sanitizeKnobs({ hue: 999, chroma: 5, lightness: -1, base: 9 })
    expect(result.hue).toBe(360)
    expect(result.chroma).toBe(0.4)
    expect(result.lightness).toBe(0)
    expect(result.base).toBe(0.02)
  })

  it('NaN 与 Infinity 视为数据损坏，回落默认值而非夹到边界', () => {
    // 漏过去会生成 oklch(NaN ...)，整块画布直接刷白。
    // 非有限值代表存储已损坏，不能当成「用户想要极值」去夹取。
    const result = sanitizeKnobs({
      hue: Number.NaN,
      chroma: Number.POSITIVE_INFINITY,
      lightness: Number.NEGATIVE_INFINITY
    })
    expect(result.hue).toBe(defaultKnobs.hue)
    expect(result.chroma).toBe(defaultKnobs.chroma)
    expect(result.lightness).toBe(defaultKnobs.lightness)
  })

  it('空串或非字符串的字体、圆角回落到默认', () => {
    const result = sanitizeKnobs({ radius: '', fontSans: 123, fontMono: null })
    expect(result.radius).toBe(defaultKnobs.radius)
    expect(result.fontSans).toBe(defaultKnobs.fontSans)
    expect(result.fontMono).toBe(defaultKnobs.fontMono)
  })

  it('合法值原样保留', () => {
    const result = sanitizeKnobs({ hue: 120, radius: '0.25rem' })
    expect(result.hue).toBe(120)
    expect(result.radius).toBe('0.25rem')
  })
})
