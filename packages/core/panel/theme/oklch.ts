/**
 * OKLCH 颜色工具。
 *
 * 主题构建器全程用 OKLCH 表达颜色：感知均匀，改色相时明度不会跳变，
 * 这也是 HeroUI 主题体系本身采用的色彩空间。
 */

/** OKLCH 三通道。 */
export interface OklchColor {
  /** 明度，0（黑）~ 1（白）。 */
  l: number
  /** 彩度，0（灰）~ 0.4（浓）。 */
  c: number
  /** 色相，0 ~ 360 度。 */
  h: number
}

/**
 * 序列化成 CSS 的 `oklch()`。
 *
 * 明度写成百分比、彩度保留 4 位、色相保留 2 位：位数是权衡后的结果——
 * 再多会让导出的 CSS 噪声变大，再少滑动时会出现可见的台阶。
 */
export const formatOklch = ({ l, c, h }: OklchColor): string =>
  `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(2)})`

/** 换色相，保持明度彩度。 */
export const withHue = (color: OklchColor, h: number): OklchColor => ({ ...color, h })

/** 换彩度，负值截到 0。 */
export const withChroma = (color: OklchColor, c: number): OklchColor => ({ ...color, c: Math.max(0, c) })

/** 把任意角度归一化到 [0, 360)。 */
export const normalizeHue = (h: number): number => ((h % 360) + 360) % 360

/** 明度分界：超过它算亮色，配深色前景。 */
const lightnessThreshold = 0.7

/**
 * 按背景明度推导可读的前景色。
 *
 * 前景不用纯黑纯白，而是带一点背景的色相和残余彩度，
 * 这样文字压在彩色背景上不会显得脏或突兀。
 */
export const calculateForeground = (background: OklchColor): OklchColor =>
  background.l > lightnessThreshold
    ? { l: 0.15, c: Math.min(background.c * 0.3, 0.05), h: background.h }
    : { l: 0.98, c: Math.min(background.c * 0.1, 0.02), h: background.h }
