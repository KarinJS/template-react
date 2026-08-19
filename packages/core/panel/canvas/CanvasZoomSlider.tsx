import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { frostedSurfaceClass } from './frosted'

/** 滑块的缩放范围：对数映射，覆盖日常查看区间，超出范围的比例仍可经滚轮到达。 */
const minScale = 0.1
const maxScale = 4

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

/** 比例 → 滑块位置（0=底/最小，1=顶/最大），对数映射保证各档位手感均匀。 */
const scaleToRatio = (scale: number) => {
  const clamped = Math.min(Math.max(scale, minScale), maxScale)
  return (Math.log(clamped) - Math.log(minScale)) / (Math.log(maxScale) - Math.log(minScale))
}

/** 滑块位置 → 比例。 */
const ratioToScale = (ratio: number) => Math.exp(Math.log(minScale) + clamp01(ratio) * (Math.log(maxScale) - Math.log(minScale)))

/** 缩放滑块的属性。 */
interface CanvasZoomSliderProps {
  /** 当前缩放比例，驱动滑块位置实时回显。 */
  scale: number
  /** 是否滑出可见：跟随左上角比例提示的可见性（缩放活动中显示）。 */
  visible: boolean
  /** 拖拽改变比例：以画布中心为锚点立即缩放。 */
  onZoomByScale: (scale: number) => void
}

/**
 * 画布左缘滑出的纵向缩放滑块：滚轮/按钮缩放时随比例提示一起滑出，
 * 拖拽滑块以画布中心为锚点 1:1 缩放，是效率最高的缩放方式。
 * 对数映射：上 = 放大，下 = 缩小。
 */
export const CanvasZoomSlider = ({ scale, visible, onZoomByScale }: CanvasZoomSliderProps) => {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const draggingPointerIdRef = useRef<number | null>(null)
  /** 指针悬停在滑块上时不允许自动收起：用户可能正在把指针移向滑块或即将拖拽。 */
  const [hovering, setHovering] = useState(false)
  const shown = visible || hovering

  /** 把指针纵坐标换算成比例并缩放：轨道顶端为最大档。 */
  const zoomToPointer = (clientY: number) => {
    const track = trackRef.current
    if (!track) {
      return
    }
    const rect = track.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / rect.height
    onZoomByScale(ratioToScale(ratio))
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    draggingPointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    zoomToPointer(event.clientY)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointerIdRef.current !== event.pointerId) {
      return
    }
    zoomToPointer(event.clientY)
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingPointerIdRef.current === event.pointerId) {
      draggingPointerIdRef.current = null
    }
  }

  const ratio = scaleToRatio(scale)

  return (
    <div
      aria-hidden={!shown}
      className={`absolute top-1/2 left-3 z-50 flex -translate-y-1/2 flex-col items-center gap-2 rounded-2xl px-2 py-2.5 ${frostedSurfaceClass}`}
      data-canvas-ui
      style={{
        opacity: shown ? 1 : 0,
        transform: `translateY(-50%) translateX(${shown ? 0 : -10}px)`,
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
        pointerEvents: shown ? 'auto' : 'none'
      }}
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
    >
      {/* 百分比标签定宽：两位数和三位数切换时不能撑变父容器宽度 */}
      <span className="relative w-9 text-center text-[10px] font-medium text-foreground tabular-nums">{Math.round(scale * 100)}%</span>

      {/* 轨道：整条都可按下拖动，按下即跳转到对应比例 */}
      <div
        ref={trackRef}
        className="relative h-40 w-4 cursor-grab touch-none rounded-full active:cursor-grabbing"
        role="slider"
        aria-label="缩放比例"
        aria-orientation="vertical"
        aria-valuemax={maxScale * 100}
        aria-valuemin={minScale * 100}
        aria-valuenow={Math.round(scale * 100)}
        tabIndex={-1}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-border" />
        {/* 已缩放部分的高亮填充（从底部起） */}
        <div
          className="absolute bottom-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60"
          style={{ height: `${ratio * 100}%` }}
        />
        <div
          className="absolute left-1/2 size-3 -translate-x-1/2 translate-y-1/2 rounded-full border border-border bg-foreground shadow-sm"
          style={{ bottom: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
