import { converter, formatCss, formatHsl, mapper, parse, round } from 'culori'
import { parseColor, type Color } from 'react-aria-components'

import type { OklchColor } from './oklch'

/** culori 的 oklch 转换器，模块级复用避免每次调用都重建。 */
const toOklch = converter('oklch')

/** react-aria 解析失败时的兜底色，取 HeroUI 默认强调色的 HSL 形式。 */
const fallbackColor = 'hsl(253.67, 100%, 61.99%)'

/**
 * 把 CSS 颜色字符串解析成 react-aria 的 Color。
 *
 * react-aria 的取色组件不认 `oklch()`，所以统一先用 culori 转成 hsl 再交给它；
 * 解析不出来时回落到默认强调色，保证取色器永远有一个合法初值。
 */
export const safeParseColor = (value: string): Color => {
  try {
    const hsl = formatHsl(value)
    return parseColor(hsl ?? fallbackColor)
  } catch {
    return parseColor(fallbackColor)
  }
}

/** 从 react-aria 的 Color 里取出 OKLCH 三通道。 */
export const ariaColorToOklch = (color: Color): OklchColor => {
  const oklch = toOklch(color.toString('hsl'))

  return { l: oklch?.l ?? 0, c: oklch?.c ?? 0, h: oklch?.h ?? 0 }
}

/** 只取色相，用于色相滑块——它不该动明度和彩度。 */
export const getHueFromColor = (color: Color): number => ariaColorToOklch(color).h

/* --------------------------------------------------------------------------
 * 取色器色值输入框（HEX / HSL / RGB / HSB / OKLCH）。
 * 以下函数与 HeroUI 官方文档取色器的行为逐条对齐：
 * 输入时自动识别格式、失焦或 Esc 放弃非法输入、OKLCH 走 culori 换算。
 * ------------------------------------------------------------------------ */

/** 取色器支持的色值格式。 */
export type ColorFormat = 'hex' | 'hsl' | 'rgb' | 'hsb' | 'oklch'

/** culori 的 4 位小数取整器，模块级复用。 */
const roundTo4 = round(4)

/** 把 Color 格式化成指定格式字符串；oklch 走 culori（react-aria 不认 oklch）。 */
export const formatColor = (color: Color, format: ColorFormat): string => {
  if (format !== 'oklch') return color.toString(format)

  const oklchColor = toOklch(color.toString('css'))
  if (!oklchColor) return color.toString('hex')

  return formatCss(mapper(roundTo4, 'oklch')(oklchColor))
}

/** 从输入字符串识别色值格式，识别不出返回 null。 */
export const detectColorFormat = (value: string): ColorFormat | null => {
  const trimmed = value.trim().toLowerCase()

  if (trimmed.startsWith('oklch(')) return 'oklch'
  if (trimmed.startsWith('hsl(') || trimmed.startsWith('hsla(')) return 'hsl'
  if (trimmed.startsWith('rgb(') || trimmed.startsWith('rgba(')) return 'rgb'
  if (trimmed.startsWith('hsb(') || trimmed.startsWith('hsba(')) return 'hsb'
  if (/^#?[0-9a-f]{3,8}$/i.test(trimmed)) return 'hex'

  return null
}

/**
 * 把现代 CSS 色值语法（空格分隔）规整成 react-aria 认识的逗号分隔旧语法。
 *
 * @example normalizeColorSyntax('hsl(220 70% 50%)') // → 'hsl(220, 70%, 50%)'
 * @example normalizeColorSyntax('rgb(255 128 0 / 0.5)') // → 'rgba(255, 128, 0, 0.5)'
 */
export const normalizeColorSyntax = (color: string): string => {
  const trimmed = color.trim()

  const matched = trimmed.match(/^(hsla?|rgba?|hsba?)\s*\(\s*([^\s,]+)\s+([^\s,]+)\s+([^\s,/]+)(?:\s*\/\s*([^\s)]+))?\s*\)$/i)
  if (!matched) return trimmed

  const [, func, a, b, c, alpha] = matched
  // 带 alpha 时函数名必须是 hsla/rgba/hsba 的 a 结尾形式。
  const name = alpha !== undefined ? `${func!.replace(/a$/i, '')}a` : func!

  return `${name}(${a}, ${b}, ${c}${alpha !== undefined ? `, ${alpha}` : ''})`
}

/**
 * 校验输入串是否是指定格式的合法色值，合法则返回解析后的 Color，否则 null。
 * oklch 会先经 culori 转成 hsl 再交给 react-aria。
 */
export const validateColorInput = (input: string, format: ColorFormat): Color | null => {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    if (!parse(trimmed)) return null

    switch (format) {
      case 'hex':
        if (!/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmed)) return null
        return parseColor(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
      case 'hsl':
      case 'rgb':
      case 'hsb': {
        if (!new RegExp(`^${format}a?\\s*\\(`, 'i').test(trimmed)) return null
        return parseColor(normalizeColorSyntax(trimmed))
      }
      case 'oklch': {
        if (!/^oklch\s*\(/i.test(trimmed)) return null
        const hsl = formatHsl(trimmed)
        return hsl ? parseColor(hsl) : null
      }
    }
  } catch {
    return null
  }
}
