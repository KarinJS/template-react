import { Button, Modal } from '@heroui/react'
import { Download, ImageDown, X } from 'lucide-react'
import type { CSSProperties } from 'react'

/** 截图预览弹窗的属性。 */
interface ScreenshotPreviewModalProps {
  /** 弹窗是否打开。 */
  open: boolean
  /** 截图的 Object URL，为空时展示占位提示。 */
  imageUrl?: string | undefined
  /** 面板外壳主题，用于弹窗换肤。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传到弹窗容器。 */
  panelThemeStyle: CSSProperties
  /** 关闭弹窗回调。 */
  onClose: () => void
}

/** 截图预览弹窗：展示刚截取的模板图片，并提供下载。 */
export const ScreenshotPreviewModal = ({ open, imageUrl, panelTheme, panelThemeStyle, onClose }: ScreenshotPreviewModalProps) => (
  <Modal.Backdrop
    className={panelTheme}
    data-theme={panelTheme}
    isDismissable
    isOpen={open}
    style={panelThemeStyle}
    variant="blur"
    onOpenChange={(next) => {
      if (!next) {
        onClose()
      }
    }}
  >
    <Modal.Container className="p-4" size="lg">
      <Modal.Dialog className="overflow-hidden">
        <Modal.Header>
          <Modal.Icon className="bg-default text-foreground">
            <ImageDown size={18} />
          </Modal.Icon>
          <Modal.Heading>截图预览</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <div className="grid max-h-[70vh] min-h-80 place-items-center overflow-auto rounded-2xl bg-surface-secondary p-4">
            {imageUrl ? (
              <img alt="Screenshot preview" className="max-w-full rounded-2xl shadow-2xl" src={imageUrl} />
            ) : (
              <p className="text-sm text-muted">暂无截图</p>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onPress={onClose} variant="secondary">
            <X size={16} />
            关闭
          </Button>
          {imageUrl && (
            <Button
              onPress={() => {
                // 用临时 a 标签触发浏览器下载，把 Object URL 落盘为 PNG。
                const link = document.createElement('a')
                link.download = 'ktr-screenshot.png'
                link.href = imageUrl
                link.click()
              }}
            >
              <Download size={16} />
              下载
            </Button>
          )}
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
)
