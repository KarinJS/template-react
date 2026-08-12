import { converter, formatHsl } from 'culori'
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
