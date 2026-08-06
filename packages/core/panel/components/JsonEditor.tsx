import Editor from '@monaco-editor/react'

/** 面板内 JSON 数据编辑器属性。 */
interface JsonEditorProps {
  /** 当前 JSON 文本。 */
  value: string
  /** TS mock 等只读数据源不允许直接保存。 */
  readonly?: boolean
  /** 跟随面板主题切换 Monaco 明暗模式。 */
  dark?: boolean
  /** JSON 文本变化回调。 */
  onChange: (value: string) => void
}

/** 轻量包裹 Monaco，只负责 JSON 编辑，不关心 mock API 写入细节。 */
export const JsonEditor = ({ value, readonly, dark, onChange }: JsonEditorProps) => (
  <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
    <Editor
      height="100%"
      language="json"
      options={{
        readOnly: Boolean(readonly),
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        // 弹窗尺寸或主题变化时让 Monaco 跟随容器重排，避免高度塌缩成一条缝。
        automaticLayout: true
      }}
      theme={dark ? 'vs-dark' : 'vs-light'}
      value={value}
      onChange={(next) => onChange(next ?? '')}
    />
  </div>
)
