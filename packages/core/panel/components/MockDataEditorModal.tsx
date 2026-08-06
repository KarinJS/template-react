import { Button, Modal } from '@heroui/react'
import { CircleAlert, Save, X } from 'lucide-react'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'

import { parseJsonLenient } from '../utils/parseJson'
import { JsonEditor } from './JsonEditor'

/** mock 数据编辑弹窗的属性。 */
interface MockDataEditorModalProps {
  /** 弹窗是否打开。 */
  isOpen: boolean
  /** 当前已加载的 JSON 文本，打开弹窗时作为草稿初值。 */
  jsonText: string
  /** TS mock 等只读数据源禁止保存。 */
  readonly?: boolean
  /** 当前选中的数据文件名，用于标题展示和导出命名。 */
  selectedDataName?: string
  /** 面板外壳主题，用于弹窗内 Monaco 和 HeroUI 换肤。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传到弹窗容器保证浮层样式一致。 */
  panelThemeStyle: CSSProperties
  /** 关闭弹窗回调。 */
  onClose: () => void
  /** 保存前把草稿同步回外层 JSON 状态。 */
  onJsonTextChange: (value: string) => void
  /** 保存草稿到 mock 数据文件。 */
  onSave: (value: string) => Promise<void>
}

/** mock 数据编辑弹窗：以草稿形式编辑 JSON，保存后写回文件并重载预览。 */
export const MockDataEditorModal = ({
  isOpen,
  jsonText,
  readonly,
  selectedDataName,
  panelTheme,
  panelThemeStyle,
  onClose,
  onJsonTextChange,
  onSave
}: MockDataEditorModalProps) => {
  // 弹窗内编辑的是本地草稿，避免输入过程直接触发外层保存和沙盒重渲染。
  const [draft, setDraft] = useState(jsonText)
  const [isSaving, setIsSaving] = useState(false)
  // 草稿解析失败时的错误文案，以横幅形式展示在弹窗顶部，不关闭弹窗。
  const [error, setError] = useState<string>()

  // 每次打开弹窗时重置草稿和错误，防止上一次未保存的修改残留。
  useEffect(() => {
    if (isOpen) {
      setDraft(jsonText)
      setError(undefined)
    }
  }, [isOpen, jsonText])

  /**
   * 保存草稿：先容错解析（容忍单引号、无引号 key、尾逗号），失败时展示错误横幅并中止；
   * 成功后把草稿规范化为标准 JSON，同步回外层状态并写文件，最后关闭弹窗。
   */
  const handleSave = useCallback(async () => {
    let parsed: unknown
    try {
      parsed = parseJsonLenient(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON 解析失败')
      return
    }

    setError(undefined)
    setIsSaving(true)
    try {
      // 写回文件前统一序列化为 2 空格缩进的标准 JSON，保证后端按严格 JSON 读取时不失败。
      const normalized = JSON.stringify(parsed, null, 2)
      onJsonTextChange(normalized)
      await onSave(normalized)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [draft, onJsonTextChange, onSave, onClose])

  // Ctrl/Cmd+S 快捷保存：拦截浏览器默认的“保存网页”行为；只读或保存中不触发。
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!readonly && !isSaving) {
          void handleSave()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, readonly, isSaving, handleSave])

  return (
    <Modal.Backdrop
      className={panelTheme}
      data-theme={panelTheme}
      isDismissable
      isOpen={isOpen}
      style={panelThemeStyle}
      variant="blur"
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <Modal.Container className="p-2 sm:p-4" size="cover">
        <Modal.Dialog className="flex max-h-[92vh] flex-col gap-6 overflow-hidden">
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">
              <Save size={18} />
            </Modal.Icon>
            <div>
              <Modal.Heading>编辑 mock 数据</Modal.Heading>
              <p className="mt-1 text-xs text-muted">{selectedDataName ?? 'default.json'}</p>
            </div>
          </Modal.Header>

          {/* 草稿解析失败的错误横幅：只提示不关闭弹窗，修改草稿后再次保存即可清除。 */}
          {error && (
            <div
              className="flex shrink-0 items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
              role="alert"
            >
              <CircleAlert className="shrink-0" size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* HeroUI 的 modal__body 默认不是 flex 容器，这里必须显式 flex 列布局，JsonEditor 的 flex-1 才能撑满剩余高度。 */}
          <Modal.Body className="flex min-h-0 flex-1 flex-col">
            <JsonEditor
              dark={panelTheme === 'dark'}
              name={selectedDataName}
              readonly={Boolean(readonly)}
              value={draft}
              onChange={setDraft}
            />
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-3">
            <Button onPress={onClose} size="lg" variant="secondary">
              <X size={16} />
              取消
            </Button>
            <Button isDisabled={Boolean(readonly)} isPending={isSaving} onPress={() => void handleSave()} size="lg">
              {({ isPending }) => (
                <span className="flex items-center gap-1.5">
                  <Save size={14} />
                  {isPending ? '保存中...' : '保存并重载'}
                </span>
              )}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
