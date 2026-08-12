import { baseMax, defaultAccent, defaultBase } from './palette'

/**
 * 主题旋钮（knobs）是模板主题所有可调参数的数据模型。
 *
 * 主题面板一对一地暴露它们，用户编辑后存进 localStorage，
 * 再由 useSandboxThemeSync 注入 iframe，最后由 css.ts 展开成完整变量表。
 */

/** 全部可调旋钮。 */
export interface ThemeKnobs {
  /** 强调色色相（度），0 ~ 360。 */
  hue: number
  /** 强调色彩度，0 ~ 0.4。 */
  chroma: number
  /** 强调色明度，0 ~ 1。 */
  lightness: number
  /** 中性色染色量，0 ~ baseMax；越大背景越偏向主色色相。 */
  base: number
  /** 全局圆角基准值（CSS length）。 */
  radius: string
  /** 正文字体栈，写进 --font-sans。 */
  fontSans: string
  /** 等宽字体栈，写进 --font-mono。 */
  fontMono: string
}

/** 可锁定的旋钮：锁上之后「随机配色」会跳过它。 */
export type LockableKnob = 'accent' | 'base' | 'radius' | 'fontSans' | 'fontMono'

/** 单个离散选项。 */
export interface KnobOption {
  /** 稳定标识，同时作为列表 key。 */
  id: string
  /** 选项名称。 */
  label: string
  /** 写入旋钮的实际值。 */
  value: string
  /** 网格卡片上的大号缩写，圆角这类需要图形预览的选项用。 */
  abbr?: string
  /** 该字体的 CDN 样式表地址；缺省表示纯字体栈，不需要加载。 */
  cdnUrl?: string
}

/**
 * 正文字体候选。
 *
 * ktr 不打包任何字体文件，所以除了「系统字体栈」这一项，其余都指向 CDN：
 * 选中后会把样式表注入沙盒，导出的 CSS 里也会带上 @import，
 * 避免出现「面板里好看、真实渲染时回落成默认字体」。
 */
export const fontSansOptions: readonly KnobOption[] = [
  {
    id: 'system',
    label: '系统字体栈',
    value: `system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`
  },
  {
    id: 'noto-sans-sc',
    label: 'Noto Sans SC',
    value: `'Noto Sans SC', system-ui, sans-serif`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@100..900&display=swap'
  },
  {
    id: 'inter',
    label: 'Inter',
    value: `'Inter', 'Noto Sans SC', system-ui, sans-serif`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'
  },
  {
    id: 'geist',
    label: 'Geist',
    value: `'Geist', 'Noto Sans SC', system-ui, sans-serif`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap'
  },
  {
    id: 'figtree',
    label: 'Figtree',
    value: `'Figtree', 'Noto Sans SC', system-ui, sans-serif`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Figtree:wght@300..900&display=swap'
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    value: `'DM Sans', 'Noto Sans SC', system-ui, sans-serif`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..900&display=swap'
  },
  {
    id: 'noto-serif-sc',
    label: 'Noto Serif SC',
    value: `'Noto Serif SC', Georgia, serif`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200..900&display=swap'
  }
]

/** 等宽字体候选，同样只保留系统字体栈 + CDN 字体。 */
export const fontMonoOptions: readonly KnobOption[] = [
  {
    id: 'system',
    label: '系统等宽',
    value: `ui-monospace, SFMono-Regular, Consolas, monospace`
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    value: `'JetBrains Mono', ui-monospace, monospace`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap'
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    value: `'Fira Code', ui-monospace, monospace`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@300..700&display=swap'
  },
  {
    id: 'ibm-plex-mono',
    label: 'IBM Plex Mono',
    value: `'IBM Plex Mono', ui-monospace, monospace`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@100;200;300;400;500;600;700&display=swap'
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    value: `'Geist Mono', ui-monospace, monospace`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap'
  },
  {
    id: 'source-code-pro',
    label: 'Source Code Pro',
    value: `'Source Code Pro', ui-monospace, monospace`,
    cdnUrl: 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@200..900&display=swap'
  }
]

/**
 * 圆角候选。
 *
 * 只到 L：HeroUI 主题构建器的全局圆角同样止步于 0.75rem，
 * 更大的值会让小控件（徽标、输入框）变成胶囊，破坏整体比例。
 */
export const radiusOptions: readonly KnobOption[] = [
  { id: 'none', label: '无', abbr: '—', value: '0rem' },
  { id: 'xs', label: '超小', abbr: 'XS', value: '0.125rem' },
  { id: 'sm', label: '小', abbr: 'S', value: '0.25rem' },
  { id: 'md', label: '中', abbr: 'M', value: '0.5rem' },
  { id: 'lg', label: '大', abbr: 'L', value: '0.75rem' }
]

/** 全部预设字体的 CDN 地址，供沙盒一次性预加载（选中即生效，不必等网络）。 */
export const presetFontCdnUrls: readonly string[] = [...fontSansOptions, ...fontMonoOptions]
  .map((option) => option.cdnUrl)
  .filter((url): url is string => Boolean(url))

/** 默认旋钮值：HeroUI 开箱即用的蓝紫强调色 + 系统字体栈。 */
export const defaultKnobs: ThemeKnobs = {
  hue: defaultAccent.h,
  chroma: defaultAccent.c,
  lightness: defaultAccent.l,
  base: defaultBase,
  radius: '0.5rem',
  fontSans: fontSansOptions[0]!.value,
  fontMono: fontMonoOptions[0]!.value
}

/**
 * 判断旋钮是否仍是默认值。
 *
 * 浮点用容差比较：滑块经过 toFixed 往返后可能差个 1e-15，
 * 严格相等会让「恢复默认」按钮在视觉毫无变化时还是可点。
 */
export const isDefaultKnobs = (knobs: ThemeKnobs): boolean =>
  Math.abs(knobs.hue - defaultKnobs.hue) < 1e-4 &&
  Math.abs(knobs.chroma - defaultKnobs.chroma) < 1e-4 &&
  Math.abs(knobs.lightness - defaultKnobs.lightness) < 1e-4 &&
  Math.abs(knobs.base - defaultKnobs.base) < 1e-4 &&
  knobs.radius === defaultKnobs.radius &&
  knobs.fontSans === defaultKnobs.fontSans &&
  knobs.fontMono === defaultKnobs.fontMono

/** 数值旋钮的夹取，非法输入回落到默认值。 */
const clampNumber = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback

/** 字符串旋钮的兜底，空串也算非法。 */
const fallbackString = (value: unknown, fallback: string): string => (typeof value === 'string' && value ? value : fallback)

/**
 * 校验并补全来自 localStorage 的旋钮。
 *
 * 存储里的值可能来自旧版本或被手改过，全部夹到合法区间，
 * 保证后续 CSS 生成不会产出 `oklch(NaN ...)` 这种把画布刷白的输出。
 */
export const sanitizeKnobs = (input: unknown): ThemeKnobs => {
  if (typeof input !== 'object' || !input) {
    return defaultKnobs
  }

  const raw = input as Partial<ThemeKnobs>

  return {
    hue: clampNumber(raw.hue, defaultKnobs.hue, 0, 360),
    chroma: clampNumber(raw.chroma, defaultKnobs.chroma, 0, 0.4),
    lightness: clampNumber(raw.lightness, defaultKnobs.lightness, 0, 1),
    base: clampNumber(raw.base, defaultKnobs.base, 0, baseMax),
    radius: fallbackString(raw.radius, defaultKnobs.radius),
    fontSans: fallbackString(raw.fontSans, defaultKnobs.fontSans),
    fontMono: fallbackString(raw.fontMono, defaultKnobs.fontMono)
  }
}
