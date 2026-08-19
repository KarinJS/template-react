import { Button, FieldError, InputGroup, Label, Modal, TextField } from '@heroui/react'
import { FilePlus2, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'

/** 两个数据文件操作弹窗共享的换肤属性。 */
interface DataModalBaseProps {
  /** 弹窗是否打开。 */
  isOpen: boolean
  /** 面板外壳主题，用于弹窗换肤。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传到弹窗容器。 */
  panelThemeStyle: CSSProperties
  /** 关闭弹窗回调。 */
  onClose: () => void
}

/** 另存为弹窗的属性。 */
interface SaveDataAsModalProps extends DataModalBaseProps {
  /** 当前数据文件名，作为输入框的初始值。 */
  currentName: string
  /** 已存在的全部数据文件名，用于同名冲突提示。 */
  existingNames: string[]
  /** 确认另存为回调，参数为规范化后的 *.json 文件名。 */
  onSave: (filename: string) => void
}

/** 规范化文件名：去空格、补 .json 后缀；含路径分隔符时返回 null 表示非法。 */
const normalizeFilename = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed || /[/\\]/.test(trimmed)) {
    return null
  }
  return trimmed.endsWith('.json') ? trimmed : `${trimmed}.json`
}

/** 另存为弹窗：把当前正在渲染的数据以新文件名保存到同级目录，替代浏览器原生 prompt。 */
export const SaveDataAsModal = ({
  isOpen,
  currentName,
  existingNames,
  panelTheme,
  panelThemeStyle,
  onClose,
  onSave
}: SaveDataAsModalProps) => {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState('')

  // 每次打开时用当前文件名回填输入框，并清掉上次的错误。
  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setError('')
    }
  }, [isOpen, currentName])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const filename = normalizeFilename(name)
    if (!filename) {
      setError('请输入合法的文件名（不能含路径分隔符）')
      return
    }
    if (filename === currentName) {
      setError('与当前文件同名，无需另存')
      return
    }
    if (existingNames.includes(filename)) {
      setError(`${filename} 已存在，请换个名字`)
      return
    }
    onSave(filename)
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
      <Modal.Container size="sm">
        <Modal.Dialog className="gap-5">
          <Modal.Header>
            <Modal.Icon className="bg-default text-foreground">
              <FilePlus2 size={18} />
            </Modal.Icon>
            <div>
              <Modal.Heading>另存为数据文件</Modal.Heading>
              <p className="mt-1 text-xs text-muted">把当前正在渲染的数据以新名字保存到同级目录</p>
            </div>
          </Modal.Header>

          <form onSubmit={handleSubmit}>
            <Modal.Body>
              <TextField autoFocus isInvalid={Boolean(error)} onKeyDown={(event) => event.stopPropagation()}>
                <Label className="mb-1.5 text-xs font-medium text-foreground">新文件名</Label>
                <InputGroup fullWidth variant="secondary">
                  <InputGroup.Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 dark.json" />
                </InputGroup>
                {error && <FieldError className="mt-1.5">{error}</FieldError>}
              </TextField>
            </Modal.Body>

            <Modal.Footer className="mt-5">
              <Button variant="ghost" onPress={onClose}>
                取消
              </Button>
              <Button type="submit" variant="primary">
                保存
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

/** 删除确认弹窗的属性。 */
interface DeleteDataConfirmModalProps extends DataModalBaseProps {
  /** 待删除的数据文件名。 */
  name: string
  /** 确认删除回调。 */
  onConfirm: () => void
}

/** 删除数据文件前的危险确认弹窗。 */
export const DeleteDataConfirmModal = ({ isOpen, name, panelTheme, panelThemeStyle, onClose, onConfirm }: DeleteDataConfirmModalProps) => (
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
    <Modal.Container size="sm">
      <Modal.Dialog className="gap-5">
        <Modal.Header>
          <Modal.Icon className="bg-danger-soft text-danger">
            <TriangleAlert size={18} />
          </Modal.Icon>
          <div>
            <Modal.Heading>删除数据文件</Modal.Heading>
            <p className="mt-1 text-xs text-muted">此操作不可恢复</p>
          </div>
        </Modal.Header>

        <Modal.Body>
          <p className="text-sm text-foreground">
            确定要删除 <span className="font-semibold">{name}</span> 吗？文件将从磁盘移除，面板会回落到默认数据。
          </p>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onPress={onClose}>
            取消
          </Button>
          <Button variant="danger" onPress={onConfirm}>
            确认删除
          </Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
)
