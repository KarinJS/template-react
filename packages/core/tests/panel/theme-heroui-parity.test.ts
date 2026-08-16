import { describe, expect, it } from 'vitest'

import { generateSandboxCss } from '../../panel/theme/css'
import { defaultKnobs } from '../../panel/theme/knobs'

/**
 * 这些期望值直接取自 @heroui/styles 的 themes/default/variables.css。
 *
 * 主题编辑器的调色板是从压缩产物逆向出来的，必须与组件库官方值一致：
 * 默认旋钮下生成的 CSS 就该等于「组件库默认主题」，否则用户一打开面板
 * 画布就悄悄变色了。
 */
const css = generateSandboxCss(defaultKnobs)
const darkIndex = css.search(/\.dark\b/)
const lightBlock = css.slice(0, darkIndex)
const darkBlock = css.slice(darkIndex)

const readVar = (block: string, name: string): string | null => {
  const matched = block.match(new RegExp(`--${name}:\\s*([^;]+);`))

  return matched ? matched[1]!.trim() : null
}

describe('默认旋钮生成的调色板对齐 HeroUI 官方值', () => {
  // 中性色是刻意「染色」的：base 旋钮把灰阶偏向强调色色相，
  // 所以色相/彩度不会等于官方值，但明度阶梯必须逐字对齐——
  // 那才是决定层级观感的部分。
  it('亮色中性色明度阶梯与官方一致', () => {
    expect(readVar(lightBlock, 'background')).toMatch(/^oklch\(97\.02%/)
    expect(readVar(lightBlock, 'surface-secondary')).toMatch(/^oklch\(95\.24%/)
    expect(readVar(lightBlock, 'surface-tertiary')).toMatch(/^oklch\(93\.73%/)
    expect(readVar(lightBlock, 'muted')).toMatch(/^oklch\(55\.17%/)
  })

  it('暗色中性色明度阶梯与官方一致', () => {
    expect(readVar(darkBlock, 'background')).toMatch(/^oklch\(12\.00%/)
    expect(readVar(darkBlock, 'surface')).toMatch(/^oklch\(21\.03%/)
    expect(readVar(darkBlock, 'surface-secondary')).toMatch(/^oklch\(25\.70%/)
    expect(readVar(darkBlock, 'surface-tertiary')).toMatch(/^oklch\(27\.21%/)
    expect(readVar(darkBlock, 'segment')).toMatch(/^oklch\(39\.64%/)
  })

  it('中性色染色朝向强调色色相（base 旋钮的设计意图）', () => {
    // 默认强调色色相 253.83：灰阶应被拉向它，而非停留在官方的 285.xx。
    expect(readVar(darkBlock, 'background')).toContain('253.83')
    expect(readVar(lightBlock, 'muted')).toContain('253.83')
  })

  it('默认强调色就是 HeroUI 的蓝紫色', () => {
    expect(readVar(lightBlock, 'accent')).toBe('oklch(62.04% 0.1950 253.83)')
  })

  // 语义色会按 chromaBoost = 1 + base * 2 微微提彩（官方同样如此）。
  // 默认 base = min(0.195 * 0.05, 0.015) = 0.00975，boost = 1.0195，
  // 所以这里的期望值是 variables.css 基准值乘以 1.0195 后的结果。
  it('语义色在亮色下等于官方基准值提彩后的结果', () => {
    expect(readVar(lightBlock, 'success')).toBe('oklch(73.29% 0.1973 150.81)')
    expect(readVar(lightBlock, 'warning')).toBe('oklch(78.19% 0.1616 72.33)')
    expect(readVar(lightBlock, 'danger')).toBe('oklch(65.32% 0.2373 25.74)')
  })

  it('语义色在暗色下带官方的色相偏移', () => {
    // 官方在暗色把 warning 往黄偏到 76.34、danger 回正到 24.63；
    // 逆向时若只存一个 hue 就会丢掉这个偏移。success 没有 hueDark。
    expect(readVar(darkBlock, 'warning')).toBe('oklch(82.03% 0.1415 76.34)')
    expect(readVar(darkBlock, 'danger')).toBe('oklch(59.40% 0.2005 24.63)')
    expect(readVar(darkBlock, 'success')).toBe('oklch(73.29% 0.1973 150.81)')
  })

  it('base 为 0 时语义色回到 variables.css 的原始基准值', () => {
    // boost 归一，可直接对照官方文件逐字校验。
    const raw = generateSandboxCss({ ...defaultKnobs, base: 0 })
    const rawLight = raw.slice(0, raw.search(/\.dark\b/))
    expect(readVar(rawLight, 'success')).toBe('oklch(73.29% 0.1935 150.81)')
    expect(readVar(rawLight, 'warning')).toBe('oklch(78.19% 0.1585 72.33)')
    expect(readVar(rawLight, 'danger')).toBe('oklch(65.32% 0.2328 25.74)')
  })

  it('默认圆角与官方一致', () => {
    expect(readVar(lightBlock, 'radius')).toBe('0.5rem')
  })
})
