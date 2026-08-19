import gsap from 'gsap'
import type React from 'react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { duration, motionDuration } from '../animation/tokens'
import { CanvasEmptyState } from '../canvas/CanvasEmptyState'
import { CanvasToolbar } from '../canvas/CanvasToolbar'
import { CanvasZoomSlider } from '../canvas/CanvasZoomSlider'
import { computeFitTransform, useCanvasTransform } from '../canvas/useCanvasTransform'
import { useCanvasGestures } from '../canvas/useCanvasGestures'

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
  /** 检查模式（code-inspector 源码定位）：开启时 iframe 接收鼠标事件，沙盒内可点选元素。 */
  inspectMode: boolean
  /** 面板外壳主题，用于画布提示层，不直接决定用户组件样式。 */
  panelDark: boolean
  /** 顶部工具栏的截图动作，画布 HUD 的相机按钮复用同一条链路。 */
  onCaptureScreenshot: () => void
  /** 同步缩放比例给顶部状态和快捷提示。 */
  onScaleChange: (scale: number) => void
}

/**
 * 预览画布：承载渲染用户模板的 iframe 沙盒。
 * 变换由 GSAP 画布引擎驱动（canvas/useCanvasTransform）：滚轮以光标为锚点缩放、
 * 拖拽 1:1 跟手平移并带松手惯性、双击/快捷键适应画布，全部动画可中断、从当前屏幕值接管。
 */
export const PreviewPanel = forwardRef<PreviewPanelRef, PreviewPanelProps>(
  ({ iframeRef, scale, hasTemplate, contentSize, fitRequest, inspectMode, panelDark, onCaptureScreenshot, onScaleChange }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const [isCtrlPressed, setIsCtrlPressed] = useState(false)
    const [showScaleIndicator, setShowScaleIndicator] = useState(false)
    const scaleIndicatorTimeoutRef = useRef<number | null>(null)
    const previousContentSizeRef = useRef(contentSize)
    const panelTheme = panelDark ? 'dark' : 'light'
    const isContentVisible = hasTemplate && contentSize.width > 1 && contentSize.height > 1

    /** 缩放活动停止后，比例提示和缩放滑块的驻留时间：留足把指针移向滑块的时间。 */
    const zoomUiDwellMs = 2000

    /** 短暂显示左上角缩放比例提示（同时驱动左侧缩放滑块的滑出窗口）。 */
    const showScale = useCallback(() => {
      setShowScaleIndicator(true)
      if (scaleIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(scaleIndicatorTimeoutRef.current)
      }
      scaleIndicatorTimeoutRef.current = window.setTimeout(() => setShowScaleIndicator(false), zoomUiDwellMs)
    }, [])

    const engine = useCanvasTransform({ onScaleChange })

    /** 使用沙盒回报尺寸计算适应比例，四周留白并封顶 100%，动画收定。 */
    const fitToCanvas = useCallback(() => {
      const container = containerRef.current
      if (!hasTemplate || !container || contentSize.width <= 0 || contentSize.height <= 0) {
        return
      }

      const target = computeFitTransform(container.clientWidth, container.clientHeight, contentSize.width, contentSize.height)
      engine.animateTo(target.x, target.y, target.scale, duration.fit)
    }, [contentSize.height, contentSize.width, engine, hasTemplate])

    const { isPanning } = useCanvasGestures({
      containerRef,
      engine,
      enabled: isContentVisible && !isCtrlPressed && !inspectMode,
      onFit: fitToCanvas,
      onFlashScale: showScale
    })

    /** 以画布中心为锚点做步进/重置缩放（HUD 按钮与快捷键共用）。 */
    const zoomStep = useCallback(
      (factor: number | null) => {
        const container = containerRef.current
        if (!container || !isContentVisible) {
          return
        }
        const centerX = container.clientWidth / 2
        const centerY = container.clientHeight / 2
        const target = factor === null ? 1 : engine.get().scale * factor
        engine.zoomAtAnimated(centerX, centerY, target)
        showScale()
      },
      [engine, isContentVisible, showScale]
    )

    /** 滑块拖拽缩放：以画布中心为锚点 1:1 立即缩放，并刷新滑块/提示的可见窗口。 */
    const handleSliderZoom = useCallback(
      (nextScale: number) => {
        const container = containerRef.current
        if (!container || !isContentVisible) {
          return
        }
        engine.zoomAtInstant(container.clientWidth / 2, container.clientHeight / 2, nextScale)
        showScale()
      },
      [engine, isContentVisible, showScale]
    )

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

      // 热更新后内容尺寸可能变化，按差值平滑补偿当前位置，避免组件忽然向右下角漂移。
      const current = engine.get()
      engine.animateTo(
        current.x - ((contentSize.width - previous.width) * current.scale) / 2,
        current.y - ((contentSize.height - previous.height) * current.scale) / 2,
        current.scale,
        duration.micro + 0.02
      )
    }, [contentSize, engine, hasTemplate])

    // fitRequest 是外部发来的“适应画布”信号，收到后在下一帧执行居中缩放。
    useEffect(() => {
      if (fitRequest === 0 || !isContentVisible) {
        return
      }

      const frameId = window.requestAnimationFrame(() => fitToCanvas())
      return () => window.cancelAnimationFrame(frameId)
    }, [fitRequest, fitToCanvas, isContentVisible])

    // 模板内容重新可见时做一次轻微入场：fade + 0.98 收定，掩盖尺寸跳变（防跳变目的）。
    useEffect(() => {
      const iframe = iframeRef.current
      if (!iframe || !isContentVisible) {
        return
      }
      const tween = gsap.fromTo(
        iframe,
        { scale: 0.98 },
        { scale: 1, duration: motionDuration(duration.settle), ease: 'expo.out', transformOrigin: '0 0', clearProps: 'transform' }
      )
      return () => {
        tween.kill()
      }
    }, [iframeRef, isContentVisible])

    // 画布快捷键：+/- 步进缩放、0/1 回 100%、F 适应画布。输入框与 Monaco 内不劫持。
    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) {
          return
        }
        const target = event.target as HTMLElement | null
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          Boolean(target?.isContentEditable) ||
          Boolean(target?.closest('.monaco-editor'))
        if (isEditable) {
          return
        }

        if (event.key === '+' || event.key === '=') {
          zoomStep(1.25)
        } else if (event.key === '-') {
          zoomStep(0.8)
        } else if (event.key === '0' || event.key === '1') {
          zoomStep(null)
        } else if (event.key === 'f' || event.key === 'F') {
          fitToCanvas()
        }
      }

      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [fitToCanvas, zoomStep])

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
          {/* 点阵背板：比直线网格更不抢戏，透明度极低 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(color-mix(in oklab, var(--muted) 26%, transparent) 1px, transparent 1px)',
              backgroundSize: '18px 18px'
            }}
          />

          <div
            className="pointer-events-none absolute left-3 top-3 z-50 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground shadow-none backdrop-blur-sm"
            style={{
              opacity: showScaleIndicator ? 1 : 0,
              transform: showScaleIndicator ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
            }}
          >
            {Math.round(scale * 100)}%
          </div>

          {isCtrlPressed && (
            <div
              className="pointer-events-none absolute inset-0 z-9999"
              style={{
                cursor: 'default',
                userSelect: 'text',
                WebkitUserSelect: 'text'
              }}
            />
          )}

          {inspectMode && (
            <div className="pointer-events-none absolute top-3 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-foreground shadow-sm">
              检查模式：移动选择元素，点击跳转 IDE 源码 · Esc 退出
            </div>
          )}

          {/* 变换层：引擎直接写 translate3d + scale，原点 0 0 */}
          <div
            ref={engine.elementRef}
            className="absolute top-0 left-0 will-change-transform"
            style={{ transformOrigin: '0 0', width: 0, height: 0 }}
          >
            <div
              className={panelTheme}
              data-theme={panelTheme}
              style={{
                cursor: isCtrlPressed || inspectMode ? 'default' : isPanning ? 'grabbing' : 'grab',
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
                  pointerEvents: isCtrlPressed || inspectMode ? 'auto' : 'none',
                  width: `${contentSize.width}px`
                }}
              />
            </div>
          </div>

          {!hasTemplate && <CanvasEmptyState />}

          <CanvasZoomSlider scale={scale} visible={isContentVisible && showScaleIndicator} onZoomByScale={handleSliderZoom} />

          <CanvasToolbar
            capturing={isCapturing}
            scale={scale}
            visible={isContentVisible}
            onCapture={onCaptureScreenshot}
            onFit={fitToCanvas}
            onZoomIn={() => zoomStep(1.25)}
            onZoomOut={() => zoomStep(0.8)}
            onZoomReset={() => zoomStep(null)}
          />
        </div>
      </div>
    )
  }
)

PreviewPanel.displayName = 'PreviewPanel'
