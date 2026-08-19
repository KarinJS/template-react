import gsap from 'gsap'
import { useEffect, useRef } from 'react'

import { duration, ease, motionDuration, prefersReducedMotion } from '../animation/tokens'

/** 快捷键提示键帽的统一外观。 */
const kbdClass = 'rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted shadow-none'

/**
 * 画布空状态：未选择模板时的吉祥物占位。
 * 吉祥物做 3s 循环的轻微浮动（首见/空状态的 delight 预算位），
 * prefers-reduced-motion 下完全静止。
 */
export const CanvasEmptyState = () => {
  const mascotRef = useRef<HTMLImageElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mascot = mascotRef.current
    const root = rootRef.current
    if (!mascot || !root) {
      return
    }

    const entrance = gsap.fromTo(
      root,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: motionDuration(duration.layout), ease: ease.out, clearProps: 'opacity,transform' }
    )

    // reduced-motion 下只保留入场（时长已归零），不做循环浮动。
    let float: gsap.core.Tween | null = null
    if (!prefersReducedMotion()) {
      float = gsap.to(mascot, { y: -8, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 })
    }

    return () => {
      entrance.kill()
      float?.kill()
    }
  }, [])

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-5">
      <img ref={mascotRef} src="/frame-logo.png" alt="" className="size-28 rounded-3xl opacity-90" draggable={false} />
      <div className="flex flex-col items-center gap-2.5">
        <p className="text-sm font-medium text-muted">从左侧选择一个模板开始预览</p>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <kbd className={kbdClass}>滚轮</kbd>缩放
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={kbdClass}>拖拽</kbd>平移
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={kbdClass}>双击</kbd>适应
          </span>
        </div>
      </div>
    </div>
  )
}
