import type { OklchColor } from './oklch'

/**
 * 调色板常量。
 *
 * 从 bundle 恢复的明暗双调色板，覆盖面板灰阶层级、语义色（success/warning/danger）
 * 和派生色算法（hover/soft/border）。HeroUI 原文档里这些都跟主色色相锁死，
 * 这里保留算法，但抽成旋钮可调。
 */

/** 预定义的无彩色调色板键值，所有面板控件都从它们取色。 */
export const fixedColors = {
  white: { l: 1, c: 0, h: 0 },
  snow: { l: 0.9911, c: 0, h: 0 },
  eclipse: { l: 0.2103, c: 0.0059, h: 285.89 }
} as const satisfies Record<string, OklchColor>

/** 亮色模式基础调色板，每个键对应一个 CSS 变量（kebab-case 映射）。 */
export const lightPalette = {
  background: { l: 0.9702, c: 0, h: 0 },
  foreground: fixedColors.eclipse,
  surface: fixedColors.white,
  surfaceSecondary: { l: 0.9524, c: 0.0013, h: 286.37 },
  surfaceTertiary: { l: 0.9373, c: 0.0013, h: 286.37 },
  overlay: fixedColors.white,
  muted: { l: 0.5517, c: 0.0138, h: 285.94 },
  default: { l: 0.94, c: 0.001, h: 286.375 },
  defaultForeground: fixedColors.eclipse,
  segment: fixedColors.white,
  border: { l: 0.9, c: 0.004, h: 286.32 },
  separator: { l: 0.92, c: 0.004, h: 286.32 },
  fieldBackground: fixedColors.white,
  fieldForeground: { l: 0.2103, c: 0.0059, h: 285.89 }
} as const satisfies Record<string, OklchColor>

/** 暗色模式基础调色板，层级顺序和 lightPalette 对应。 */
export const darkPalette = {
  background: { l: 0.12, c: 0.005, h: 285.823 },
  foreground: fixedColors.snow,
  surface: { l: 0.2103, c: 0.0059, h: 285.89 },
  surfaceSecondary: { l: 0.257, c: 0.0037, h: 286.14 },
  surfaceTertiary: { l: 0.2721, c: 0.0024, h: 247.91 },
  overlay: { l: 0.2103, c: 0.0059, h: 285.89 },
  muted: { l: 0.705, c: 0.015, h: 286.067 },
  default: { l: 0.274, c: 0.006, h: 286.033 },
  defaultForeground: fixedColors.snow,
  segment: { l: 0.3964, c: 0.01, h: 285.93 },
  border: { l: 0.28, c: 0.006, h: 286.033 },
  separator: { l: 0.25, c: 0.006, h: 286.033 },
  fieldBackground: { l: 0.2103, c: 0.0059, h: 285.89 },
  fieldForeground: fixedColors.snow
} as const satisfies Record<string, OklchColor>

/**
 * 语义色参数（成功、警告、危险），每种色存各自的色相、明度、彩度，
 * 明暗模式独立调参。
 */
export const semanticColors = {
  success: {
    hueLight: 150.81,
    hueDark: 150.81,
    chromaLight: 0.1935,
    chromaDark: 0.1935,
    lightnessLight: 0.7329,
    lightnessDark: 0.7329
  },
  warning: {
    hueLight: 72.33,
    // 暗色下 HeroUI 把警告色往黄偏 4°，抵消深背景上的发绿感。
    hueDark: 76.34,
    chromaLight: 0.1585,
    chromaDark: 0.1388,
    lightnessLight: 0.7819,
    lightnessDark: 0.8203
  },
  danger: {
    hueLight: 25.74,
    // 暗色下略微回正，避免偏橙。
    hueDark: 24.63,
    chromaLight: 0.2328,
    chromaDark: 0.1967,
    lightnessLight: 0.6532,
    lightnessDark: 0.594
  }
} as const

/** 默认强调色（HeroUI 蓝紫色），明度 62%、彩度 0.195、色相 253°。 */
export const defaultAccent: OklchColor = { l: 0.6204, c: 0.195, h: 253.83 }

/**
 * base 旋钮的区间：灰阶染色量，控制中性色朝强调色偏多少。
 *
 * 官方不暴露这个值，而是从强调色彩度派生：min(chroma * 0.05, 0.015)。
 * 默认强调色（c=0.195）下得 0.00975，即 defaultBase。这里抽成旋钮让用户可调，
 * 上限沿用官方的两倍余量。
 */
export const baseMin = 0
export const baseMax = 0.02

/** 默认灰阶染色量，等于官方在默认强调色下派生出的 grayChroma。 */
export const defaultBase = Math.min(defaultAccent.c * 0.05, 0.015)

/** 灰阶和语义色跟主色色相的最大偏移角度（度）。 */
export const hueShiftMax = 0.12
