import { describe, expect, it } from 'vitest'

import { generateSandboxCss } from '../../panel/theme/css'
import { defaultKnobs } from '../../panel/theme/knobs'

/**
 * 派生色公式逐条对齐官方 getDerivedColorFormulas。
 *
 * 这些百分比是官方为可读性逐个调过的，不是一个统一公式能覆盖的：
 * default 的 hover 只挪 4%、soft 用 50%；success/warning 的 soft-foreground
 * 在亮色下分别混 60%/70% 前景。用统一循环生成会全部错掉。
 */
const css = generateSandboxCss({ ...defaultKnobs, base: 0.01 })
const darkIndex = css.search(/\.dark\b/)
const lightBlock = css.slice(0, darkIndex)
const darkBlock = css.slice(darkIndex)

const readVar = (block: string, name: string): string | null => {
  const matched = block.match(new RegExp(`--${name}:\\s*([^;]+);`))

  return matched ? matched[1]!.trim() : null
}

describe('派生色公式对齐官方', () => {
  it('语义色 hover 统一混 10% 前景', () => {
    for (const key of ['accent', 'success', 'warning', 'danger']) {
      expect(readVar(lightBlock, `${key}-hover`)).toBe(`color-mix(in oklab, var(--${key}) 90%, var(--${key}-foreground) 10%)`)
    }
  })

  it('default 的 hover 与 soft 用中性色专属比例', () => {
    expect(readVar(lightBlock, 'default-hover')).toBe('color-mix(in oklab, var(--default) 96%, var(--default-foreground) 4%)')
    expect(readVar(lightBlock, 'default-soft')).toBe('color-mix(in oklab, var(--default) 50%, transparent)')
    expect(readVar(lightBlock, 'default-soft-hover')).toBe('color-mix(in oklab, var(--default) 60%, transparent)')
    expect(readVar(lightBlock, 'default-soft-foreground')).toBe('var(--default-foreground)')
  })

  it('soft 比例亮色 15/20、暗色 12/16', () => {
    expect(readVar(lightBlock, 'accent-soft')).toBe('color-mix(in oklab, var(--accent) 15%, transparent)')
    expect(readVar(lightBlock, 'accent-soft-hover')).toBe('color-mix(in oklab, var(--accent) 20%, transparent)')
    expect(readVar(darkBlock, 'accent-soft')).toBe('color-mix(in oklab, var(--accent) 12%, transparent)')
    expect(readVar(darkBlock, 'accent-soft-hover')).toBe('color-mix(in oklab, var(--accent) 16%, transparent)')
  })

  it('danger 的 soft 固定 15/20，不随明暗变化', () => {
    expect(readVar(darkBlock, 'danger-soft')).toBe('color-mix(in oklab, var(--danger) 15%, transparent)')
    expect(readVar(darkBlock, 'danger-soft-hover')).toBe('color-mix(in oklab, var(--danger) 20%, transparent)')
  })

  it('soft-foreground 每种色的比例各不相同', () => {
    expect(readVar(lightBlock, 'accent-soft-foreground')).toBe('color-mix(in oklab, var(--accent) 70%, var(--foreground) 30%)')
    expect(readVar(lightBlock, 'success-soft-foreground')).toBe('color-mix(in oklab, var(--success) 80%, var(--foreground) 60%)')
    expect(readVar(lightBlock, 'warning-soft-foreground')).toBe('color-mix(in oklab, var(--warning) 80%, var(--foreground) 70%)')
    expect(readVar(lightBlock, 'danger-soft-foreground')).toBe('color-mix(in oklab, var(--danger) 70%, var(--foreground) 40%)')
  })

  it('暗色下 soft-foreground 统一为 80/30', () => {
    for (const key of ['accent', 'success', 'warning', 'danger']) {
      expect(readVar(darkBlock, `${key}-soft-foreground`)).toBe(`color-mix(in oklab, var(--${key}) 80%, var(--foreground) 30%)`)
    }
  })

  it('焦点环复用 --focus', () => {
    expect(readVar(lightBlock, 'tw-ring-color')).toBe('var(--focus)')
  })

  it('表面与字段的派生公式与官方一致', () => {
    expect(readVar(lightBlock, 'surface-hover')).toBe('color-mix(in oklab, var(--surface) 92%, var(--surface-foreground) 8%)')
    expect(readVar(lightBlock, 'field-focus')).toBe('var(--field-background, var(--default))')
    expect(readVar(lightBlock, 'background-inverse')).toBe('var(--foreground)')
  })
})
