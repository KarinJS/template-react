import { useCallback, useMemo, useState } from 'react'

import { generateExportCss, generateSandboxCss } from './css'
import { detectFontFamily, validateFontUrl, type CustomFont, type FontUrlError } from './fontCdn'
import { defaultKnobs, isDefaultKnobs, radiusOptions, sanitizeKnobs, type LockableKnob, type ThemeKnobs } from './knobs'
import { baseMax } from './palette'

/** 旋钮的持久化键。 */
const knobsStorageKey = 'ktr-template-theme'

/** 自定义字体的持久化键。 */
const fontsStorageKey = 'ktr-template-fonts'

/**
 * 随机配色的取值区间。
 *
 * 明度和彩度都收在中段：全区间随机会经常抽到接近纯黑纯白、
 * 或彩度爆表的颜色，用户点几次就不想点了。
 */
const randomRanges = {
  hue: [0, 360],
  chroma: [0.1, 0.26],
  lightness: [0.5, 0.85],
  base: [0, baseMax]
} as const

/** 区间内取随机数。 */
const randomInRange = ([min, max]: readonly [number, number]): number => min + Math.random() * (max - min)

/** 数组里取随机项。 */
const randomItem = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!

/** 读取存储的旋钮，损坏时回落到默认值。 */
const readKnobs = (): ThemeKnobs => {
  try {
    const stored = window.localStorage.getItem(knobsStorageKey)
    return stored ? sanitizeKnobs(JSON.parse(stored)) : defaultKnobs
  } catch {
    return defaultKnobs
  }
}

/** 读取存储的自定义字体，顺手过滤掉已不合规的 URL。 */
const readCustomFonts = (): CustomFont[] => {
  try {
    const stored = window.localStorage.getItem(fontsStorageKey)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is CustomFont =>
        typeof item === 'object' &&
        !!item &&
        typeof (item as CustomFont).url === 'string' &&
        typeof (item as CustomFont).family === 'string' &&
        validateFontUrl((item as CustomFont).url) === null
    )
  } catch {
    return []
  }
}

/**
 * 模板主题构建器的状态与派生数据。
 *
 * 旋钮是唯一数据源，CSS 全部由它派生：
 * `sandboxCss` 注入画布（默认主题时为空串，表示不干预），`exportCss` 供用户复制。
 */
export const useThemeBuilder = () => {
  const [knobs, setKnobsState] = useState<ThemeKnobs>(readKnobs)
  const [lockedKnobs, setLockedKnobs] = useState<LockableKnob[]>([])
  const [customFonts, setCustomFonts] = useState<CustomFont[]>(readCustomFonts)

  const persistKnobs = useCallback((next: ThemeKnobs) => {
    try {
      window.localStorage.setItem(knobsStorageKey, JSON.stringify(next))
    } catch {
      // 存不下就算了，当前会话依旧可用。
    }
  }, [])

  const persistFonts = useCallback((next: CustomFont[]) => {
    try {
      window.localStorage.setItem(fontsStorageKey, JSON.stringify(next))
    } catch {
      // 同上，静默降级。
    }
  }, [])

  /** 局部更新旋钮。 */
  const setKnobs = useCallback(
    (patch: Partial<ThemeKnobs>) => {
      setKnobsState((current) => {
        const next = { ...current, ...patch }
        persistKnobs(next)
        return next
      })
    },
    [persistKnobs]
  )

  /** 切换某个旋钮的锁定状态。 */
  const toggleLock = useCallback((knob: LockableKnob) => {
    setLockedKnobs((current) => (current.includes(knob) ? current.filter((item) => item !== knob) : [...current, knob]))
  }, [])

  /**
   * 导入 CDN 字体。
   *
   * @returns 成功返回 null，失败返回错误码交给调用方翻译。
   */
  const importFont = useCallback(
    (url: string): FontUrlError | null => {
      const trimmed = url.trim()

      const invalid = validateFontUrl(trimmed)
      if (invalid) return invalid

      const family = detectFontFamily(trimmed)
      if (!family) return 'cannot-detect-family'

      if (customFonts.some((font) => font.url === trimmed)) return 'already-imported'

      const next = [...customFonts, { family, url: trimmed }]
      setCustomFonts(next)
      persistFonts(next)
      return null
    },
    [customFonts, persistFonts]
  )

  /** 移除已导入的字体。 */
  const removeFont = useCallback(
    (url: string) => {
      const next = customFonts.filter((font) => font.url !== url)
      setCustomFonts(next)
      persistFonts(next)
    },
    [customFonts, persistFonts]
  )

  /** 随机配色，跳过已锁定的旋钮；字体不参与随机（换字体的视觉跳变太大）。 */
  const randomize = useCallback(() => {
    setKnobsState((current) => {
      const isLocked = (knob: LockableKnob) => lockedKnobs.includes(knob)

      const next: ThemeKnobs = {
        hue: isLocked('accent') ? current.hue : randomInRange(randomRanges.hue),
        chroma: isLocked('accent') ? current.chroma : randomInRange(randomRanges.chroma),
        lightness: isLocked('accent') ? current.lightness : randomInRange(randomRanges.lightness),
        base: isLocked('base') ? current.base : randomInRange(randomRanges.base),
        radius: isLocked('radius') ? current.radius : randomItem(radiusOptions).value,
        fontSans: current.fontSans,
        fontMono: current.fontMono
      }

      persistKnobs(next)
      return next
    })
  }, [lockedKnobs, persistKnobs])

  /** 恢复默认，同时清空锁定状态。 */
  const reset = useCallback(() => {
    setKnobsState(defaultKnobs)
    setLockedKnobs([])
    persistKnobs(defaultKnobs)
  }, [persistKnobs])

  const isDefault = isDefaultKnobs(knobs)

  return {
    knobs,
    // 默认主题不注入任何 CSS：这是「不设置就用组件库默认」语义的落点。
    sandboxCss: useMemo(() => (isDefault ? '' : generateSandboxCss(knobs)), [isDefault, knobs]),
    exportCss: useMemo(() => generateExportCss(knobs), [knobs]),
    isDefault,
    lockedKnobs,
    customFonts,
    importFont,
    removeFont,
    setKnobs,
    toggleLock,
    randomize,
    reset
  }
}
