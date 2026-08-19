import { Button, Tooltip } from '@heroui/react'
import gsap from 'gsap'
import { Camera, Maximize2, Minus, Plus } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { duration, ease, motionDuration } from '../animation/tokens'

/** 画布浮动工具栏的属性。 */
interface CanvasToolbarProps {
  /** 当前缩放比例，百分比徽章回显用。 */
  scale: number
  /** 有内容时才显示。 */
  visible: boolean
  /** 截图进行中：相机按钮进入 pending 态。 */
  capturing: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  /** 点击百分比徽章回到 100%。 */
  onZoomReset: () => void
  onFit: () => void
  onCapture: () => void
}

/**
 * 画布右下角的浮动工具栏：缩放步进、百分比回显（点击回 100%）、适应画布、截图。
 * 给不习惯手势的用户一个明确入口；入场只做一次下滑淡入（首见位）。
 */
export const CanvasToolbar = ({ scale, visible, capturing, onZoomIn, onZoomOut, onZoomReset, onFit, onCapture }: CanvasToolbarProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const enteredRef = useRef(false)

  useEffect(() => {
    if (!visible || enteredRef.current || !rootRef.current) {
      return
    }
    enteredRef.current = true
    gsap.fromTo(
      rootRef.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: motionDuration(duration.settle), ease: ease.out, clearProps: 'opacity,transform' }
    )
  }, [visible])

  if (!visible) {
    return null
  }

  return (
    <div
      ref={rootRef}
      className="absolute right-4 bottom-4 z-50 flex items-center gap-0.5 rounded-2xl border border-border bg-surface/90 p-1 shadow-sm backdrop-blur-sm"
    >
      <Tooltip closeDelay={80} delay={300}>
        <Tooltip.Trigger>
          <Button isIconOnly aria-label="缩小" size="sm" variant="ghost" onPress={onZoomOut}>
            <Minus size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">缩小（-）</p>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip closeDelay={80} delay={300}>
        <Tooltip.Trigger>
          <Button
            aria-label="重置为 100%"
            className="min-w-11 px-1 text-xs font-medium tabular-nums"
            size="sm"
            variant="ghost"
            onPress={onZoomReset}
          >
            {Math.round(scale * 100)}%
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">重置为 100%（0）</p>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip closeDelay={80} delay={300}>
        <Tooltip.Trigger>
          <Button isIconOnly aria-label="放大" size="sm" variant="ghost" onPress={onZoomIn}>
            <Plus size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">放大（+）</p>
        </Tooltip.Content>
      </Tooltip>

      <div className="mx-0.5 h-4 w-px bg-border" />

      <Tooltip closeDelay={80} delay={300}>
        <Tooltip.Trigger>
          <Button isIconOnly aria-label="适应画布" size="sm" variant="ghost" onPress={onFit}>
            <Maximize2 size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">适应画布（F）</p>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip closeDelay={80} delay={300}>
        <Tooltip.Trigger>
          <Button isIconOnly aria-label="截图" isPending={capturing} size="sm" variant="ghost" onPress={onCapture}>
            <Camera size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">截图</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  )
}
