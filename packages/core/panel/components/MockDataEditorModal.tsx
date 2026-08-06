import { Button, Modal } from '@heroui/react'
import { Save, X } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'

import { JsonEditor } from './JsonEditor'

/** mock 数据编辑弹窗的属性。 */
interface MockDataEditorModalProps {
  /** 弹窗是否打开。 */
  isOpen: boolean
  /** 当前已加载的 JSON 文本，打开弹窗时作为草稿初值。 */
  jsonText: string
  /** TS mock 等只读数据源禁止保存。 */
  readonly?: boolean
  /** 当前选中的数据文件名，用于标题展示。 */
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

  // 每次打开弹窗时重置草稿，防止上一次未保存的修改残留。
  useEffect(() => {
    if (isOpen) {
      setDraft(jsonText)
    }
  }, [isOpen, jsonText])

  /** 保存草稿：先同步回外层状态，再写文件，成功后关闭弹窗。 */
  const handleSave = async () => {
    setIsSaving(true)
    try {
      onJsonTextChange(draft)
      await onSave(draft)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

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

          {/* HeroUI 的 modal__body 默认不是 flex 容器，这里必须显式 flex 列布局，JsonEditor 的 flex-1 才能撑满剩余高度。 */}
          <Modal.Body className="flex min-h-0 flex-1 flex-col">
            <JsonEditor dark={panelTheme === 'dark'} readonly={Boolean(readonly)} value={draft} onChange={setDraft} />
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-3">
            <Button onPress={onClose} size="lg" variant="secondary">
              <X size={16} />
              取消
            </Button>
            <Button isDisabled={Boolean(readonly)} isPending={isSaving} onPress={handleSave} size="lg">
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
