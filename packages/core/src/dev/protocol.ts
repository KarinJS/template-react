/** 面板向沙盒同步主题时使用的精简主题数据。 */
interface PanelThemePayload {
  /** 下游组件库可以消费的主题色变量。 */
  theme?: {
    /** 当前主题模式。 */
    mode?: 'light' | 'dark'
    /** 主强调色。 */
    accent?: string
    /** 强调色上的文字颜色。 */
    accentForeground?: string
    /** 页面背景色。 */
    background?: string
    /** 页面前景文字色。 */
    foreground?: string
    /** 卡片或浮层表面色。 */
    surface?: string
    /** 次级文字或弱化背景色。 */
    muted?: string
    /** 边框颜色。 */
    border?: string
  }
}

/** 开发面板发送给 iframe 沙盒的跨窗口消息。 */
export type PanelMessage =
  | { source: 'ktr-panel'; type: 'ktr:select'; payload: { path: string } }
  | {
      source: 'ktr-panel'
      type: 'ktr:data'
      payload: { path: string; data: unknown; ctx?: Record<string, unknown>; emptyReason?: 'no-data' | 'load-failed' }
    }
  | { source: 'ktr-panel'; type: 'ktr:theme'; payload: PanelThemePayload }
  | { source: 'ktr-panel'; type: 'ktr:panel-theme'; payload: { dark: boolean } }
  | { source: 'ktr-panel'; type: 'ktr:scale'; payload: { scale: number } }
  | { source: 'ktr-panel'; type: 'ktr:inspect'; payload: { enabled: boolean } }

/** iframe 沙盒回传给开发面板的跨窗口消息。 */
export type SandboxMessage =
  | { source: 'ktr-sandbox'; type: 'ktr:ready'; payload: { templates: Array<{ path: string; name?: string; description?: string }> } }
  | { source: 'ktr-sandbox'; type: 'ktr:rendered'; payload: { path: string; elapsed: number; size?: { width: number; height: number } } }
  | { source: 'ktr-sandbox'; type: 'ktr:error'; payload: { path?: string; message: string; stack?: string } }
  | { source: 'ktr-sandbox'; type: 'ktr:hmr'; payload: { path: string } }
  | { source: 'ktr-sandbox'; type: 'ktr:inspect-hold'; payload: { held: boolean } }

/**
 * 判断任意消息是否来自开发面板。
 * @param value 收到的跨窗口消息数据。
 * @returns 是面板消息时返回 true。
 */
export const isPanelMessage = (value: unknown): value is PanelMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { source?: unknown }).source === 'ktr-panel' &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}

/**
 * 判断任意消息是否来自 iframe 沙盒。
 * @param value 收到的跨窗口消息数据。
 * @returns 是沙盒消息时返回 true。
 */
export const isSandboxMessage = (value: unknown): value is SandboxMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { source?: unknown }).source === 'ktr-sandbox' &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}
