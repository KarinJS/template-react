import { describe, expect, it } from 'vitest'

import { calculateForeground, formatOklch, normalizeHue, withChroma, withHue } from '../../panel/theme/oklch'

describe('formatOklch', () => {
  it('明度写成百分比，彩度 4 位、色相 2 位', () => {
    expect(formatOklch({ l: 0.6204, c: 0.195, h: 253.83 })).toBe('oklch(62.04% 0.1950 253.83)')
  })

  it('数值按位数四舍五入，不产生长尾小数', () => {
    expect(formatOklch({ l: 1 / 3, c: 1 / 7, h: 1 / 9 })).toBe('oklch(33.33% 0.1429 0.11)')
  })

  it('纯黑纯白不退化成非法值', () => {
    expect(formatOklch({ l: 0, c: 0, h: 0 })).toBe('oklch(0.00% 0.0000 0.00)')
    expect(formatOklch({ l: 1, c: 0, h: 0 })).toBe('oklch(100.00% 0.0000 0.00)')
  })
})

describe('normalizeHue', () => {
  it('负角度折回正区间', () => {
    expect(normalizeHue(-30)).toBe(330)
  })

  it('超过一圈取模', () => {
    expect(normalizeHue(400)).toBe(40)
  })

  it('360 归零，保证首尾衔接', () => {
    expect(normalizeHue(360)).toBe(0)
  })
})

describe('withHue / withChroma', () => {
  const base = { l: 0.5, c: 0.1, h: 100 }

  it('换色相不动明度彩度', () => {
    expect(withHue(base, 200)).toEqual({ l: 0.5, c: 0.1, h: 200 })
  })

  it('换彩度不动明度色相', () => {
    expect(withChroma(base, 0.2)).toEqual({ l: 0.5, c: 0.2, h: 100 })
  })

  it('彩度负值截到 0，避免生成非法颜色', () => {
    expect(withChroma(base, -1).c).toBe(0)
  })
})

describe('calculateForeground', () => {
  it('亮背景配深色前景', () => {
    const fg = calculateForeground({ l: 0.9, c: 0.2, h: 253 })
    expect(fg.l).toBe(0.15)
  })

  it('暗背景配浅色前景', () => {
    const fg = calculateForeground({ l: 0.3, c: 0.2, h: 253 })
    expect(fg.l).toBe(0.98)
  })

  it('前景保留背景色相，彩度收敏避免显脏', () => {
    const fg = calculateForeground({ l: 0.9, c: 0.4, h: 42 })
    expect(fg.h).toBe(42)
    expect(fg.c).toBeLessThanOrEqual(0.05)
  })

  it('0.7 是分界点，恰好等于时仍算暗背景', () => {
    expect(calculateForeground({ l: 0.7, c: 0, h: 0 }).l).toBe(0.98)
    expect(calculateForeground({ l: 0.71, c: 0, h: 0 }).l).toBe(0.15)
  })
})
