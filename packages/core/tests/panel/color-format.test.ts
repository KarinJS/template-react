import { parseColor } from 'react-aria-components'
import { describe, expect, it } from 'vitest'

import { detectColorFormat, formatColor, normalizeColorSyntax, validateColorInput } from '../../panel/theme/colorFormat'

/**
 * 取色器色值输入框的格式检测、校验与格式化。
 * 行为逐条对齐 HeroUI 官方文档取色器。
 */
describe('色值格式工具', () => {
  it('识别输入串的格式', () => {
    expect(detectColorFormat('#448ECF')).toBe('hex')
    expect(detectColorFormat('448ecf')).toBe('hex')
    expect(detectColorFormat('hsl(212, 100%, 47%)')).toBe('hsl')
    expect(detectColorFormat('hsla(212 100% 47% / 0.5)')).toBe('hsl')
    expect(detectColorFormat('rgb(68, 142, 207)')).toBe('rgb')
    expect(detectColorFormat('hsb(212, 67%, 81%)')).toBe('hsb')
    expect(detectColorFormat('oklch(62% 0.19 253)')).toBe('oklch')
    expect(detectColorFormat('not-a-color')).toBeNull()
  })

  it('现代空格语法规整为逗号语法', () => {
    expect(normalizeColorSyntax('hsl(220 70% 50%)')).toBe('hsl(220, 70%, 50%)')
    expect(normalizeColorSyntax('hsl(220 70% 50% / 0.5)')).toBe('hsla(220, 70%, 50%, 0.5)')
    expect(normalizeColorSyntax('rgb(255 128 0)')).toBe('rgb(255, 128, 0)')
    expect(normalizeColorSyntax('hsb(220 70% 50%)')).toBe('hsb(220, 70%, 50%)')
    // 已是逗号语法或不认识的串原样返回
    expect(normalizeColorSyntax('hsl(220, 70%, 50%)')).toBe('hsl(220, 70%, 50%)')
    expect(normalizeColorSyntax('#fff')).toBe('#fff')
  })

  it('校验并按格式解析输入', () => {
    expect(validateColorInput('448ecf', 'hex')?.toString('hex').toLowerCase()).toBe('#448ecf')
    expect(validateColorInput('#448ECF', 'hex')?.toString('hex').toLowerCase()).toBe('#448ecf')
    expect(validateColorInput('hsl(212 100% 47%)', 'hsl')).not.toBeNull()
    expect(validateColorInput('oklch(62% 0.19 253)', 'oklch')).not.toBeNull()
    expect(validateColorInput('oklch(62% 0.19 253)', 'hex')).toBeNull()
    expect(validateColorInput('xyz', 'rgb')).toBeNull()
    expect(validateColorInput('', 'hex')).toBeNull()
  })

  it('格式化成指定格式字符串', () => {
    const color = parseColor('#448ECF')

    expect(formatColor(color, 'hex').toLowerCase()).toBe('#448ecf')
    expect(formatColor(color, 'hsl')).toMatch(/^hsl\(/)
    expect(formatColor(color, 'rgb')).toMatch(/^rgb\(/)
    expect(formatColor(color, 'hsb')).toMatch(/^hsb\(/)
    expect(formatColor(color, 'oklch')).toMatch(/^oklch\(/)
  })
})
