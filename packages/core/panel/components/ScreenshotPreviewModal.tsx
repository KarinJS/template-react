import { Button, Label, Modal, Switch, toast } from '@heroui/react'
import { Camera, Copy, Download, Droplets, Maximize, Minus, Moon, Plus, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'

import { applyWatermark, getWatermarkEnabled, setWatermarkEnabled } from '../utils/watermark'

/** 截图预览弹窗的属性。 */
interface ScreenshotPreviewModalProps {
  /** 弹窗是否打开。 */
  open: boolean
  /** 截图的 Object URL（未叠加水印的原图），为空时展示占位提示。 */
  imageUrl?: string | undefined
  /** 截图内容的明暗主题，决定水印文字深浅和重截开关的初始位置。 */
  contentTheme: 'light' | 'dark'
  /** 面板外壳主题，用于弹窗换肤。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传到弹窗容器。 */
  panelThemeStyle: CSSProperties
  /** 关闭弹窗回调。 */
  onClose: () => void
  /** 以临时主题重新截图的回调，由外层负责重新出图并刷新 imageUrl。 */
  onRecaptureWithTheme?: (theme: 'light' | 'dark') => Promise<void>
}

/**
 * 弹窗底部开关的统一渲染：图标嵌在 thumb 内，标签在右。
 * 注意结构必须是 Content 包裹 Control：HeroUI 里 Switch.Content 才是可点击的 label（React Aria
 * SwitchButton），隐藏 input 挂在它内部；Control 写在外面会导致点击 pill 不触发切换。
 */
const renderFooterSwitch = (checked: boolean, onChange: (checked: boolean) => void, label: string, icon: ReactNode) => (
  <Switch className="gap-4" isSelected={checked} onChange={onChange} size="lg">
    <Switch.Content>
      <Switch.Control>
        <Switch.Thumb>
          <Switch.Icon>{icon}</Switch.Icon>
        </Switch.Thumb>
      </Switch.Control>
      <Label className="text-xs font-medium text-foreground/70">{label}</Label>
    </Switch.Content>
  </Switch>
)

/** 底部次级操作按钮的统一外观。 */
const actionButtonClass = 'h-9 rounded-2xl border border-border bg-default text-foreground shadow-none hover:bg-default-hover'
/** 底部主操作按钮（下载）的统一外观。 */
const primaryActionClass = 'h-9 rounded-2xl bg-accent text-accent-foreground shadow-none hover:bg-accent-hover'

/**
 * 截图预览弹窗：网格画布与主画布同一套交互（滚轮锚点缩放、拖拽平移、双击适应），
 * 右下角浮动缩放控件组，底部提供水印开关、明暗重截开关和重新截图、复制、下载操作。
 */
export const ScreenshotPreviewModal = ({
  open,
  imageUrl,
  contentTheme,
  panelTheme,
  panelThemeStyle,
  onClose,
  onRecaptureWithTheme
}: ScreenshotPreviewModalProps) => {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const scaleIndicatorTimerRef = useRef<number | null>(null)

  const [scale, setScale] = useState(1)
  const [showScaleIndicator, setShowScaleIndicator] = useState(false)
  const [watermarkEnabled, setWatermarkEnabledState] = useState(() => getWatermarkEnabled())
  /** 重截开关上的临时明暗主题，打开弹窗时与当前截图主题对齐。 */
  const [tempDarkMode, setTempDarkMode] = useState(contentTheme === 'dark')
  /** 叠加水印后的预览图 Object URL；关闭水印时回退为原图 URL。 */
  const [displayUrl, setDisplayUrl] = useState<string>()
  const [isCopying, setIsCopying] = useState(false)
  const [isRetaking, setIsRetaking] = useState(false)

  // 打开弹窗时把重截开关对齐到当前截图主题
  useEffect(() => {
    if (open) {
      setTempDarkMode(contentTheme === 'dark')
    }
  }, [open, contentTheme])

  // 新截图到达时重置缩放，从适应视图开始浏览
  useEffect(() => {
    transformRef.current?.resetTransform(0)
  }, [imageUrl])

  // 水印开关变化时即时重铺预览图：预览、复制、下载三处始终是同一份内容。
  // applyWatermark 会新建 Object URL，effect 清理时负责回收，避免内存泄漏。
  useEffect(() => {
    if (!imageUrl) {
      setDisplayUrl(undefined)
      return
    }
    if (!watermarkEnabled) {
      setDisplayUrl(imageUrl)
      return
    }

    let cancelled = false
    let ownedUrl: string | undefined
    const run = async () => {
      try {
        const raw = await (await fetch(imageUrl)).blob()
        const marked = await applyWatermark(raw, { enabled: true, theme: contentTheme })
        if (cancelled) {
          URL.revokeObjectURL(marked)
          return
        }
        ownedUrl = marked
        setDisplayUrl(marked)
      } catch (error) {
        // 水印生成失败时回退原图，不阻塞预览和导出
        console.error('生成水印预览失败:', error)
        if (!cancelled) {
          setDisplayUrl(imageUrl)
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      if (ownedUrl) {
        URL.revokeObjectURL(ownedUrl)
      }
    }
  }, [imageUrl, watermarkEnabled, contentTheme])

  // 卸载时清掉缩放提示的定时器，避免组件销毁后还触发 setState
  useEffect(
    () => () => {
      if (scaleIndicatorTimerRef.current !== null) {
        window.clearTimeout(scaleIndicatorTimerRef.current)
      }
    },
    []
  )

  /** 短暂显示左上角缩放比例提示。 */
  const flashScaleIndicator = () => {
    setShowScaleIndicator(true)
    if (scaleIndicatorTimerRef.current !== null) {
      window.clearTimeout(scaleIndicatorTimerRef.current)
    }
    scaleIndicatorTimerRef.current = window.setTimeout(() => setShowScaleIndicator(false), 1000)
  }

  // 画布手势与主画布保持一致：库自带的 wheel/dblclick 禁用，统一走手算。
  // 依赖 open：HeroUI 在弹窗关闭时不挂载内容，首次渲染 canvasRef 还是 null，
  // 必须在弹窗真正打开后再挂监听，否则滚轮缩放永远不会生效。
  useEffect(() => {
    if (!open) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const transformInstance = transformRef.current
      const transformState = transformInstance?.state
      if (!transformInstance?.instance || !transformState) {
        return
      }

      const delta = -event.deltaY * 0.001
      const newScale = Math.min(Math.max(transformState.scale * (1 + delta), 0.01), 5)
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      const { positionX, positionY, scale: currentScale } = transformState
      const scaleDiff = newScale - currentScale
      // 以鼠标所在点为缩放锚点，复刻主画布滚轮缩放时内容跟随指针的体验；
      // 平滑感来自 TransformComponent 的 contentStyle 过渡，这里 animationTime 保持 0。
      transformInstance.setTransform(
        positionX - (mouseX - positionX) * (scaleDiff / currentScale),
        positionY - (mouseY - positionY) * (scaleDiff / currentScale),
        newScale,
        0,
        'easeOut'
      )
      flashScaleIndicator()
    }

    const handleDoubleClick = (event: MouseEvent) => {
      event.preventDefault()
      transformRef.current?.resetTransform(300, 'easeOut')
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('dblclick', handleDoubleClick)
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('dblclick', handleDoubleClick)
    }
  }, [open])

  /** 切换水印开关并持久化到 localStorage，预览图随 displayUrl effect 即时更新。 */
  const handleWatermarkChange = (enabled: boolean) => {
    setWatermarkEnabledState(enabled)
    setWatermarkEnabled(enabled)
  }

  /** 以重截开关上的临时主题重新截图，期间按钮进入 pending 态。 */
  const handleRetake = async () => {
    if (!onRecaptureWithTheme || isRetaking) {
      return
    }
    setIsRetaking(true)
    try {
      await onRecaptureWithTheme(tempDarkMode ? 'dark' : 'light')
    } finally {
      setIsRetaking(false)
    }
  }

  /** 把当前预览图（已按开关叠好水印）写入系统剪贴板。 */
  const handleCopy = async () => {
    if (!displayUrl || isCopying) {
      return
    }
    setIsCopying(true)
    try {
      // ClipboardItem 直接接受 Promise<Blob>：write 在点击的临时用户激活期内同步发起，
      // 先 await 再 write 会被 Chrome 判定激活期已过而拒绝（NotAllowedError）。
      const png = fetch(displayUrl)
        .then((response) => response.blob())
        .then((blob) => new Blob([blob], { type: 'image/png' }))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      toast.success('复制成功', { description: '图片已复制到剪贴板' })
      onClose()
    } catch (error) {
      console.error('复制截图失败:', error)
      toast.danger('复制失败', { description: '无法复制到剪贴板，请尝试下载' })
    } finally {
      setIsCopying(false)
    }
  }

  /** 把当前预览图按 `screenshot-{时间戳}.png` 命名下载到本地。 */
  const handleDownload = async () => {
    if (!displayUrl) {
      return
    }
    const blob = await (await fetch(displayUrl)).blob()
    const url = URL.createObjectURL(blob)
    // 用临时 a 标签触发浏览器下载，把 blob 落盘为 PNG
    const link = document.createElement('a')
    link.download = `screenshot-${Date.now()}.png`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
    toast.success('下载成功', { description: '图片已保存到本地' })
    onClose()
  }

  return (
    <Modal.Backdrop
      className={`${panelTheme} bg-black/48 dark:bg-black/72`}
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
      <Modal.Container size="cover">
        <Modal.Dialog className="flex h-[min(92vh,1100px)] max-h-[92vh] flex-col overflow-hidden rounded-4xl border border-border bg-surface shadow-lg">
          <Modal.Body className="flex-1 overflow-hidden">
            <div ref={canvasRef} className="relative h-full overflow-hidden rounded-3xl border border-border bg-background">
              {/* 网格背景与主画布完全同一配方：实心 1px 色标、18px 间距、不额外降透明度
                  （颜色→透明渐变 + opacity-60 在浅色底下会淡到看不见） */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(0deg, color-mix(in oklab, var(--separator) 88%, transparent) 0px, color-mix(in oklab, var(--separator) 88%, transparent) 1px, transparent 1px, transparent 18px),
                     repeating-linear-gradient(90deg, color-mix(in oklab, var(--separator) 88%, transparent) 0px, color-mix(in oklab, var(--separator) 88%, transparent) 1px, transparent 1px, transparent 18px)`
                }}
              />

              <div
                className="pointer-events-none absolute top-4 left-4 z-50 rounded-2xl border border-border bg-surface/90 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-sm"
                style={{
                  opacity: showScaleIndicator ? 1 : 0,
                  transform: showScaleIndicator ? 'translateY(0)' : 'translateY(-10px)',
                  transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {Math.round(scale * 100)}%
              </div>

              {displayUrl ? (
                <div className="relative h-full w-full">
                  <TransformWrapper
                    ref={transformRef}
                    centerOnInit
                    disablePadding
                    doubleClick={{ disabled: true }}
                    initialScale={1}
                    limitToBounds={false}
                    maxScale={5}
                    minScale={0.01}
                    panning={{ velocityDisabled: false, disabled: false }}
                    wheel={{ step: 0.02, disabled: true }}
                    onTransform={(_ref, state) => setScale(state.scale)}
                  >
                    <TransformComponent
                      contentClass="flex h-full! w-full! items-center justify-center"
                      contentStyle={{ transition: 'transform 0.3s ease-out', willChange: 'transform' }}
                      wrapperClass="h-full! w-full!"
                    >
                      <img
                        alt="Screenshot preview"
                        className="object-contain"
                        draggable={false}
                        src={displayUrl}
                        style={{
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          filter: 'drop-shadow(0 30px 80px rgba(0, 0, 0, 0.22))'
                        }}
                      />
                    </TransformComponent>
                  </TransformWrapper>

                  {/* 浮动缩放控件组：给不习惯手势的用户一个明确入口 */}
                  <div className="absolute right-4 bottom-4 z-50 flex items-center gap-0.5 rounded-2xl border border-border bg-surface/90 p-1 shadow-sm backdrop-blur-sm">
                    <Button
                      isIconOnly
                      aria-label="缩小"
                      size="sm"
                      variant="ghost"
                      onPress={() => transformRef.current?.zoomOut(0.25, 200, 'easeOut')}
                    >
                      <Minus size={14} />
                    </Button>
                    <span className="min-w-11 text-center text-xs font-medium text-foreground tabular-nums">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button
                      isIconOnly
                      aria-label="放大"
                      size="sm"
                      variant="ghost"
                      onPress={() => transformRef.current?.zoomIn(0.25, 200, 'easeOut')}
                    >
                      <Plus size={14} />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label="适应画布"
                      size="sm"
                      variant="ghost"
                      onPress={() => transformRef.current?.resetTransform(300, 'easeOut')}
                    >
                      <Maximize size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid h-full place-items-center">
                  <p className="text-sm text-muted">暂无截图</p>
                </div>
              )}
            </div>
          </Modal.Body>

          {/* relative z-10：画布里的定位元素会压过非定位的 footer 内容（开关因此点不到），显式抬高层级。 */}
          <Modal.Footer className="relative z-10 flex flex-col gap-4 border-t border-border bg-surface/88 px-4 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {renderFooterSwitch(
                watermarkEnabled,
                handleWatermarkChange,
                watermarkEnabled ? '水印已启用' : '水印已关闭',
                <Droplets size={12} />
              )}
              {renderFooterSwitch(
                tempDarkMode,
                setTempDarkMode,
                tempDarkMode ? '深色主题' : '浅色主题',
                tempDarkMode ? <Moon size={12} /> : <Sun size={12} />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {onRecaptureWithTheme && (
                <Button
                  className={actionButtonClass}
                  isDisabled={isRetaking}
                  isPending={isRetaking}
                  onPress={() => void handleRetake()}
                  size="lg"
                  variant="secondary"
                >
                  {({ isPending }) => (
                    <>
                      {!isPending && <Camera size={16} />}
                      {isPending ? '截图中…' : '重新截图'}
                    </>
                  )}
                </Button>
              )}
              <Button
                className={actionButtonClass}
                isDisabled={!displayUrl || isCopying}
                isPending={isCopying}
                onPress={() => void handleCopy()}
                size="lg"
                variant="secondary"
              >
                {({ isPending }) => (
                  <>
                    {!isPending && <Copy size={16} />}
                    {isPending ? '复制中…' : '复制'}
                  </>
                )}
              </Button>
              <Button
                className={primaryActionClass}
                isDisabled={!displayUrl}
                onPress={() => void handleDownload()}
                size="lg"
                variant="secondary"
              >
                <Download size={16} />
                下载
              </Button>
              <Button className={actionButtonClass} onPress={onClose} size="lg" variant="secondary">
                <X size={16} />
                关闭
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
