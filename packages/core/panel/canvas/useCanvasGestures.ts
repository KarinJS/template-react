import { useEffect, useRef, useState, type RefObject } from 'react'

import type { CanvasTransformEngine } from './useCanvasTransform'

/** useCanvasGestures 的配置项。 */
interface UseCanvasGesturesOptions {
  /** 画布容器：监听滚轮、双击和指针拖拽。 */
  containerRef: RefObject<HTMLElement | null>
  /** 变换引擎，手势最终都转成引擎调用。 */
  engine: CanvasTransformEngine
  /** 是否响应手势：无内容、文本选择模式或检查模式下为 false。 */
  enabled: boolean
  /** 双击画布触发的适应视图回调。 */
  onFit: () => void
  /** 用户缩放时闪现比例提示。 */
  onFlashScale?: () => void
}

/** 速度采样窗口：只取最近 100ms 内的轨迹推算松手速度。 */
const velocityWindowMs = 100

interface PointerSample {
  x: number
  y: number
  t: number
}

/**
 * 画布指针手势层：
 * - 滚轮（含 Ctrl+滚轮的触摸板捏合）以光标为锚点缩放；
 * - 左键/中键拖拽平移，pointerdown 即 1:1 跟手，松手按最近 100ms 轨迹甩出惯性；
 * - 双击适应视图。
 * 所有监听都挂在容器上：iframe 正常状态 pointer-events 为 none，事件会冒泡到容器。
 */
export const useCanvasGestures = ({ containerRef, engine, enabled, onFit, onFlashScale }: UseCanvasGesturesOptions) => {
  const [isPanning, setIsPanning] = useState(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onFitRef = useRef(onFit)
  onFitRef.current = onFit
  const onFlashScaleRef = useRef(onFlashScale)
  onFlashScaleRef.current = onFlashScale

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let panPointerId: number | null = null
    let samples: PointerSample[] = []

    const handleWheel = (event: WheelEvent) => {
      if (!enabledRef.current) {
        return
      }
      event.preventDefault()

      // Ctrl+滚轮是触摸板捏合手势，步进放大一档补偿过小的 deltaY。
      const factor = event.ctrlKey ? 0.006 : 0.0015
      const rect = container.getBoundingClientRect()
      engine.zoomAt(event.clientX - rect.left, event.clientY - rect.top, engine.get().scale * (1 - event.deltaY * factor))
      onFlashScaleRef.current?.()
    }

    const handleDoubleClick = (event: MouseEvent) => {
      if (!enabledRef.current) {
        return
      }
      // 画布悬浮 UI（HUD 按钮、缩放滑块）上的双击不触发适应：
      // 快速连点缩放按钮时，两次 click 会合成 dblclick，把用户的快速缩放劫持成重置。
      if (event.target instanceof Element && event.target.closest('[data-canvas-ui]')) {
        return
      }
      event.preventDefault()
      onFitRef.current()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!enabledRef.current || (event.button !== 0 && event.button !== 1)) {
        return
      }
      // 画布悬浮 UI（带 data-canvas-ui 标记）和交互元素冒泡上来的按下不启动平移：
      // 一旦 setPointerCapture 到容器，后续 pointerup 会重定向到容器，吃掉按钮的 press
      // 和滑块的拖拽。
      if (
        event.target instanceof Element &&
        event.target.closest('[data-canvas-ui], button, a, input, select, textarea, [role="button"]')
      ) {
        return
      }
      event.preventDefault()
      panPointerId = event.pointerId
      container.setPointerCapture(event.pointerId)
      samples = [{ x: event.clientX, y: event.clientY, t: performance.now() }]
      // 新拖拽打断惯性/缩放动画，从当前屏幕值接管。
      engine.setInstant(engine.get().x, engine.get().y, engine.get().scale)
      setIsPanning(true)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (panPointerId !== event.pointerId || samples.length === 0) {
        return
      }
      const last = samples[samples.length - 1]!
      engine.panBy(event.clientX - last.x, event.clientY - last.y)
      samples.push({ x: event.clientX, y: event.clientY, t: performance.now() })
      // 只保留速度采样窗口内的轨迹。
      const cutoff = performance.now() - velocityWindowMs * 2
      samples = samples.filter((sample) => sample.t >= cutoff)
    }

    const finishPan = (event: PointerEvent) => {
      if (panPointerId !== event.pointerId) {
        return
      }
      panPointerId = null
      setIsPanning(false)

      if (samples.length >= 2) {
        const now = performance.now()
        const newest = samples[samples.length - 1]!
        // 从窗口内最早的有效样本算起，轨迹越短速度越可信。
        let oldest = samples[0]!
        for (const sample of samples) {
          if (sample.t >= now - velocityWindowMs) {
            oldest = sample
            break
          }
        }
        const elapsed = newest.t - oldest.t
        if (elapsed > 0) {
          engine.fling((newest.x - oldest.x) / elapsed, (newest.y - oldest.y) / elapsed)
        }
      }
      samples = []
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('dblclick', handleDoubleClick)
    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', finishPan)
    container.addEventListener('pointercancel', finishPan)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('dblclick', handleDoubleClick)
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', finishPan)
      container.removeEventListener('pointercancel', finishPan)
    }
    // enabled 变化（如弹窗 open 后内容才挂载）时重挂监听：此时容器 ref 已就位。
  }, [containerRef, engine, enabled])

  return { isPanning }
}
