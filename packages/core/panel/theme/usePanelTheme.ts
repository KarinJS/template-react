import { useCallback, useEffect, useState } from 'react'

/** 面板外壳的主题偏好。 */
export type PanelThemePreference = 'light' | 'dark' | 'system'

/** 偏好的持久化键。 */
const storageKey = 'ktr-panel-theme'

/** 读取存储的偏好，非法值按跟随系统处理。 */
const readPreference = (): PanelThemePreference => {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  } catch {
    return 'system'
  }
}

/** 当前系统是否偏好深色。 */
const readSystemDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches

/**
 * 面板外壳的明暗主题。
 *
 * 只管开发面板自身外观，与模板主题完全独立：改这里不会影响画布里的用户组件。
 * 选「跟随系统」时会订阅 `prefers-color-scheme`，系统换肤面板立刻跟上。
 */
export const usePanelTheme = () => {
  const [preference, setPreferenceState] = useState<PanelThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(readSystemDark)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const setPreference = useCallback((next: PanelThemePreference) => {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      // 隐私模式下 localStorage 会抛异常；偏好丢失可以接受，不该让面板崩。
    }
  }, [])

  return {
    preference,
    isDark: preference === 'system' ? systemDark : preference === 'dark',
    setPreference
  }
}
