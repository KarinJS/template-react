import type React from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { type ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

export interface PreviewPanelRef {
  /** 截取当前 iframe 内的 #container，如果不存在则回退到 body。 */
  captureScreenshot: () => Promise<Blob | null>
  /** 按当前沙盒回报的内容尺寸居中并缩放到可视区域。 */
  fitToCanvas: () => void
}

/** 预览画布组件的属性。 */
interface PreviewPanelProps {
  /** 预览 iframe，由外层 App 负责和沙盒通信。 */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** 当前画布缩放比例。 */
  scale: number
  /** 是否已经选择了可渲染模板。 */
  hasTemplate: boolean
  /** 沙盒渲染完成后回报的真实用户组件尺寸。 */
  contentSize: { width: number; height: number }
  /** 外部触发适应画布的递增信号。 */
  fitRequest: number
  /** 面板外壳主题，用于画布提示层，不直接决定用户组件样式。 */
  panelDark: boolean
  /** 同步缩放比例给顶部状态和快捷提示。 */
  onScaleChange: (scale: number) => void
}

/** 预览画布：承载渲染用户模板的 iframe 沙盒，提供滚轮缩放、拖拽、双击适应和截图能力。 */
export const PreviewPanel = forwardRef<PreviewPanelRef, PreviewPanelProps>(
  ({ iframeRef, scale, hasTemplate, contentSize, fitRequest, panelDark, onScaleChange }, ref) => {
    const previewContentRef = useRef<HTMLDivElement | null>(null)
    const transformWrapperRef = useRef<ReactZoomPanPinchRef | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const [isCtrlPressed, setIsCtrlPressed] = useState(false)
    const [isPanning, setIsPanning] = useState(false)
    const [showScaleIndicator, setShowScaleIndicator] = useState(false)
    const scaleIndicatorTimeoutRef = useRef<number | null>(null)
    const previousContentSizeRef = useRef(contentSize)
    const panelTheme = panelDark ? 'dark' : 'light'
    const isContentVisible = hasTemplate && contentSize.width > 1 && contentSize.height > 1

    /** 短暂显示左上角缩放比例提示。 */
    const showScale = useCallback(() => {
      setShowScaleIndicator(true)
      if (scaleIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(scaleIndicatorTimeoutRef.current)
      }
      scaleIndicatorTimeoutRef.current = window.setTimeout(() => setShowScaleIndicator(false), 1000)
    }, [])

    /** 使用沙盒回报尺寸计算适应比例，确保锚点是可视画布中心。 */
    const fitToCanvas = useCallback(() => {
      if (!hasTemplate || !transformWrapperRef.current || !previewContentRef.current) {
        return
      }

      const transformInstance = transformWrapperRef.current
      const container = transformInstance.instance?.wrapperComponent
      if (!container) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const contentWidth = contentSize.width
      const contentHeight = contentSize.height

      if (contentWidth <= 0 || contentHeight <= 0) {
        return
      }

      // 四周留出 padding，且缩放比例封顶 100%，小尺寸模板不被强行放大。
      const padding = 40
      const availableWidth = Math.max(1, containerRect.width - padding * 2)
      const availableHeight = Math.max(1, containerRect.height - padding * 2)
      const scaleX = availableWidth / contentWidth
      const scaleY = availableHeight / contentHeight
      const fitScale = Math.min(scaleX, scaleY, 1)
      const finalScale = Math.max(0.01, fitScale)
      const scaledWidth = contentWidth * finalScale
      const scaledHeight = contentHeight * finalScale
      const positionX = (containerRect.width - scaledWidth) / 2
      const positionY = (containerRect.height - scaledHeight) / 2

      transformInstance.setTransform(positionX, positionY, finalScale, 300, 'easeOut')
    }, [contentSize.height, contentSize.width, hasTemplate])

    /** 截图时只取用户模板节点，不截开发面板画布和网格背景。 */
    const captureScreenshot = useCallback(async () => {
      if (!hasTemplate || isCapturing) {
        return null
      }

      const doc = iframeRef.current?.contentDocument
      const target = doc?.querySelector('#container') ?? doc?.body
      if (!target) {
        return null
      }

      setIsCapturing(true)
      try {
        const { snapdom } = await import('@zumer/snapdom')
        // embedFonts 内联字体、placeholders 为空元素补占位，fast 关闭保证取全量样式。
        const result = await snapdom(target as HTMLElement, { embedFonts: true, fast: false, placeholders: true })
        // toBlob 默认导出 SVG blob：剪贴板按 PNG 解码会报 DataError，canvas 水印也画不出来，
        // 必须显式指定栅格 PNG。
        return result.toBlob({ type: 'png' })
      } finally {
        setIsCapturing(false)
      }
    }, [hasTemplate, iframeRef, isCapturing])

    useEffect(() => {
      const previous = previousContentSizeRef.current
      previousContentSizeRef.current = contentSize

      if (
        !hasTemplate ||
        contentSize.width <= 1 ||
        contentSize.height <= 1 ||
        previous.width <= 1 ||
        previous.height <= 1 ||
        (previous.width === contentSize.width && previous.height === contentSize.height)
      ) {
        return
      }

      const transformRef = transformWrapperRef.current
      const state = transformRef?.state
      if (!transformRef || !state) {
        return
      }

      // 热更新后内容尺寸可能变化，按差值补偿当前位置，避免组件忽然向右下角漂移。
      const positionX = state.positionX - ((contentSize.width - previous.width) * state.scale) / 2
      const positionY = state.positionY - ((contentSize.height - previous.height) * state.scale) / 2
      transformRef.setTransform(positionX, positionY, state.scale, 0, 'easeOut')
    }, [contentSize, hasTemplate])

    // fitRequest 是外部发来的“适应画布”信号，收到后在下一帧执行居中缩放。
    useEffect(() => {
      if (fitRequest === 0 || !isContentVisible) {
        return
      }

      const frameId = window.requestAnimationFrame(() => fitToCanvas())
      return () => window.cancelAnimationFrame(frameId)
    }, [fitRequest, fitToCanvas, isContentVisible])

    // 双击画布空白处恢复适应视图；TransformWrapper 自带的双击缩放已禁用。
    useEffect(() => {
      const container = transformWrapperRef.current?.instance?.wrapperComponent
      if (!container) {
        return
      }

      const handleDoubleClick = (event: MouseEvent) => {
        event.preventDefault()
        fitToCanvas()
      }

      container.addEventListener('dblclick', handleDoubleClick)
      return () => container.removeEventListener('dblclick', handleDoubleClick)
    }, [fitToCanvas])

    useEffect(() => {
      // 按住 Ctrl/Alt 临时允许选择 iframe 内文本，普通状态保留拖拽画布手感。
      let isCtrlDown = false
      let isAltDown = false
      let hasOtherKeyPressed = false
      let timeoutId: number | null = null

      const clearSelectionTimeout = () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
          timeoutId = null
        }
      }

      const enableTextSelectionSoon = () => {
        clearSelectionTimeout()
        timeoutId = window.setTimeout(() => {
          if ((isCtrlDown || isAltDown) && !hasOtherKeyPressed) {
            setIsCtrlPressed(true)
          }
        }, 10)
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
          return
        }

        if (event.key === 'Control') {
          isCtrlDown = true
          hasOtherKeyPressed = false
          enableTextSelectionSoon()
          return
        }

        if (event.key === 'Alt') {
          event.preventDefault()
          isAltDown = true
          hasOtherKeyPressed = false
          enableTextSelectionSoon()
          return
        }

        if ((isCtrlDown || isAltDown) && event.key !== 'Control' && event.key !== 'Alt') {
          hasOtherKeyPressed = true
          setIsCtrlPressed(false)
          clearSelectionTimeout()
        }
      }

      const handleKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Control') {
          isCtrlDown = false
          if (!isAltDown) {
            hasOtherKeyPressed = false
            setIsCtrlPressed(false)
            clearSelectionTimeout()
          }
          return
        }

        if (event.key === 'Alt') {
          event.preventDefault()
          isAltDown = false
          if (!isCtrlDown) {
            hasOtherKeyPressed = false
            setIsCtrlPressed(false)
            clearSelectionTimeout()
          }
        }
      }

      const handleBlur = () => {
        isCtrlDown = false
        isAltDown = false
        hasOtherKeyPressed = false
        setIsCtrlPressed(false)
        clearSelectionTimeout()
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      window.addEventListener('blur', handleBlur)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
        window.removeEventListener('blur', handleBlur)
        clearSelectionTimeout()
      }
    }, [])

    useEffect(() => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()

        const transformRef = transformWrapperRef.current
        const transformState = transformRef?.state
        if (!transformRef || !transformRef.instance || !transformState) {
          return
        }

        const delta = -event.deltaY * 0.001
        const scaleFactor = 1 + delta
        const newScale = Math.min(Math.max(transformState.scale * scaleFactor, 0.01), 5)
        const rect = container.getBoundingClientRect()
        const mouseX = event.clientX - rect.left
        const mouseY = event.clientY - rect.top
        const { positionX, positionY, scale: currentScale } = transformState
        const scaleDiff = newScale - currentScale
        // 以鼠标所在点为缩放锚点，复刻原面板滚轮缩放时内容跟随指针的体验。
        const newPositionX = positionX - (mouseX - positionX) * (scaleDiff / currentScale)
        const newPositionY = positionY - (mouseY - positionY) * (scaleDiff / currentScale)

        transformRef.setTransform(newPositionX, newPositionY, newScale, 0, 'easeOut')
        showScale()
      }

      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }, [showScale])

    useEffect(() => {
      if (!transformWrapperRef.current?.instance) {
        return
      }

      // 文本选择模式下暂停 pan/zoom 库内部手势处理。
      transformWrapperRef.current.instance.setup.disabled = isCtrlPressed
    }, [isCtrlPressed])

    useEffect(() => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const handleMouseDown = () => {
        // 只改变开发面板光标状态，不把 pointer 事件传进用户 iframe。
        if (!isCtrlPressed) {
          setIsPanning(true)
        }
      }
      const handleMouseUp = () => setIsPanning(false)

      container.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        container.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }, [isCtrlPressed])

    useEffect(
      () => () => {
        if (scaleIndicatorTimeoutRef.current !== null) {
          window.clearTimeout(scaleIndicatorTimeoutRef.current)
        }
      },
      []
    )

    useImperativeHandle(ref, () => ({ captureScreenshot, fitToCanvas }), [captureScreenshot, fitToCanvas])

    return (
      <div className={`flex h-full flex-col ${panelTheme}`} data-theme={panelTheme}>
        <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background" data-ktr-preview-canvas>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, color-mix(in oklab, var(--separator) 88%, transparent) 0px, color-mix(in oklab, var(--separator) 88%, transparent) 1px, transparent 1px, transparent 18px),
                 repeating-linear-gradient(90deg, color-mix(in oklab, var(--separator) 88%, transparent) 0px, color-mix(in oklab, var(--separator) 88%, transparent) 1px, transparent 1px, transparent 18px)`
            }}
          />

          <div className="relative h-full w-full">
            <div
              className="pointer-events-none absolute left-3 top-3 z-50 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground shadow-none backdrop-blur-sm"
              style={{
                opacity: showScaleIndicator ? 1 : 0,
                transform: showScaleIndicator ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {Math.round(scale * 100)}%
            </div>

            {isCtrlPressed && (
              <div
                className="pointer-events-none absolute inset-0 z-[9999]"
                style={{
                  cursor: 'default',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}
              />
            )}

            <TransformWrapper
              ref={transformWrapperRef}
              disablePadding
              disabled={isCtrlPressed}
              initialScale={1}
              limitToBounds={false}
              maxScale={5}
              minScale={0.01}
              doubleClick={{ disabled: true }}
              panning={{ velocityDisabled: false, disabled: false }}
              wheel={{ step: 0.02, disabled: true }}
              onTransform={(_transformRef, state) => {
                if (state.scale !== scale) {
                  onScaleChange(state.scale)
                }
              }}
            >
              <TransformComponent
                contentClass="w-max! h-max!"
                contentStyle={{ transition: 'transform 0.3s ease-out', willChange: 'transform' }}
                wrapperClass="w-full! h-full!"
              >
                <div
                  ref={previewContentRef}
                  className={panelTheme}
                  data-theme={panelTheme}
                  style={{
                    cursor: isCtrlPressed ? 'default' : isPanning ? 'grabbing' : 'grab',
                    pointerEvents: hasTemplate ? 'auto' : 'none',
                    userSelect: isCtrlPressed ? 'text' : 'none',
                    WebkitUserSelect: isCtrlPressed ? 'text' : 'none'
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    className={`block origin-top bg-transparent transition-opacity duration-200 ${isContentVisible ? 'opacity-100' : 'opacity-0'}`}
                    data-ktr-preview-frame
                    src="/__ktr/sandbox"
                    style={{
                      height: `${contentSize.height}px`,
                      pointerEvents: isCtrlPressed ? 'auto' : 'none',
                      width: `${contentSize.width}px`
                    }}
                  />
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      </div>
    )
  }
)

PreviewPanel.displayName = 'PreviewPanel'
