import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { duration, ease, motionDuration, prefersReducedMotion } from '../animation/tokens'

/** 画布变换状态：内容元素左上角在容器坐标系里的偏移和缩放。 */
export interface CanvasTransformState {
  x: number
  y: number
  scale: number
}

/** useCanvasTransform 的配置项。 */
interface UseCanvasTransformOptions {
  /** 缩放变化时同步给外层（HUD、状态栏），每帧触发。 */
  onScaleChange?: (scale: number) => void
  minScale?: number
  maxScale?: number
}

/** 适应视图的计算结果。 */
const clampScale = (scale: number, min: number, max: number) => Math.min(Math.max(scale, min), max)

/** 计算让内容在容器内居中且完整可见的变换（四周留白，缩放封顶 100%）。 */
export const computeFitTransform = (
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number,
  padding = 40,
  minScale = 0.01,
  maxScale = 5
): CanvasTransformState => {
  const availableWidth = Math.max(1, containerWidth - padding * 2)
  const availableHeight = Math.max(1, containerHeight - padding * 2)
  const scale = clampScale(Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1), minScale, maxScale)

  return {
    scale,
    x: (containerWidth - contentWidth * scale) / 2,
    y: (containerHeight - contentHeight * scale) / 2
  }
}

/**
 * GSAP 驱动的画布变换引擎：自有 { x, y, scale } 状态，直接写内容元素的
 * translate3d + scale（原点 0 0）。连续输入（滚轮）走 quickTo 复用 tween 不堆积；
 * 离散动画（适应、惯性、补偿）走 gsap.to；任何新输入都会打断进行中的动画，
 * 并始终从当前屏幕值接管，保证动画可中断、无跳变。
 */
export const useCanvasTransform = ({ onScaleChange, minScale = 0.01, maxScale = 5 }: UseCanvasTransformOptions = {}) => {
  const elementRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<CanvasTransformState>({ x: 0, y: 0, scale: 1 })
  const discreteTweenRef = useRef<gsap.core.Tween | null>(null)
  const quickRef = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc; scale: gsap.QuickToFunc } | null>(null)
  const onScaleChangeRef = useRef(onScaleChange)
  onScaleChangeRef.current = onScaleChange

  /** 把当前状态写到 DOM，并同步缩放给外层。 */
  const apply = useCallback(() => {
    const element = elementRef.current
    if (!element) {
      return
    }
    const { x, y, scale } = stateRef.current
    element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
    onScaleChangeRef.current?.(scale)
  }, [])

  useEffect(
    () => () => {
      discreteTweenRef.current?.kill()
      gsap.killTweensOf(stateRef.current)
    },
    []
  )

  const engine = useMemo(() => {
    const state = stateRef.current
    const clamp = (scale: number) => clampScale(scale, minScale, maxScale)

    /** 打断一切进行中的动画：新输入从当前屏幕值接管，旧动画不抢控制权。 */
    const interrupt = () => {
      discreteTweenRef.current?.kill()
      discreteTweenRef.current = null
      // quickTo 复用同一个 tween，被 kill 后不会自愈；置空让下次调用重建。
      gsap.killTweensOf(state)
      quickRef.current = null
    }

    /**
     * 连续输入通道：quickTo 复用 tween，高频滚轮事件不会堆积出延迟队列。
     * 时长刻意给 0.32s + power3.out：每次滚轮只把目标往前推一小段，
     * 追随过程始终带一点滑动感，短时长 expo.out 会起步猛冲、收尾发愣。
     */
    const ensureQuick = () => {
      if (!quickRef.current) {
        const config = { duration: 0.32, ease: ease.soft, onUpdate: apply }
        quickRef.current = {
          x: gsap.quickTo(state, 'x', config),
          y: gsap.quickTo(state, 'y', config),
          scale: gsap.quickTo(state, 'scale', config)
        }
      }
      return quickRef.current
    }

    const setInstant = (x: number, y: number, scale: number) => {
      interrupt()
      state.x = x
      state.y = y
      state.scale = clamp(scale)
      apply()
    }

    const animateTo = (x: number, y: number, scale: number, seconds: number = duration.settle) => {
      // reduced-motion 下等价于 setInstant，动画整体降级为即时切换。
      if (prefersReducedMotion() || seconds <= 0) {
        setInstant(x, y, scale)
        return
      }
      interrupt()
      discreteTweenRef.current = gsap.to(state, {
        x,
        y,
        scale: clamp(scale),
        duration: motionDuration(seconds),
        ease: ease.out,
        onUpdate: apply
      })
    }

    return {
      elementRef,

      /** 读取当前变换的副本。 */
      get: (): CanvasTransformState => ({ ...state }),

      /** 立即设置变换（拖拽 1:1 跟手、初始化），无动画。 */
      setInstant,

      /** 平滑过渡到目标变换；reduced-motion 下等价于 setInstant。 */
      animateTo,

      /**
       * 以容器内某点为锚点缩放（滚轮）：内容跟随指针。
       * 走连续输入通道，滚动中带滑动感地追随，松手后 power3.out 柔和收定。
       */
      zoomAt: (pointX: number, pointY: number, nextScale: number) => {
        const clamped = clamp(nextScale)
        if (clamped === state.scale) {
          return
        }
        const ratio = clamped / state.scale
        const nextX = pointX - (pointX - state.x) * ratio
        const nextY = pointY - (pointY - state.y) * ratio
        // 滚轮接管进行中的离散动画（如惯性），从当前屏幕值继续。
        discreteTweenRef.current?.kill()
        discreteTweenRef.current = null
        const quick = ensureQuick()
        quick.x(nextX)
        quick.y(nextY)
        quick.scale(clamped)
      },

      /** 以容器内某点为锚点动画缩放到目标值（快捷键、HUD 按钮）。 */
      zoomAtAnimated: (pointX: number, pointY: number, nextScale: number, seconds: number = duration.layout) => {
        const clamped = clamp(nextScale)
        const ratio = clamped / state.scale
        animateTo(pointX - (pointX - state.x) * ratio, pointY - (pointY - state.y) * ratio, clamped, seconds)
      },

      /** 以容器内某点为锚点立即缩放：滑块拖拽等直接操控场景，1:1 跟手无动画延迟。 */
      zoomAtInstant: (pointX: number, pointY: number, nextScale: number) => {
        const clamped = clamp(nextScale)
        if (clamped === state.scale) {
          return
        }
        const ratio = clamped / state.scale
        setInstant(pointX - (pointX - state.x) * ratio, pointY - (pointY - state.y) * ratio, clamped)
      },

      /** 拖拽平移：立即跟随指针增量，1:1 跟手无延迟。 */
      panBy: (deltaX: number, deltaY: number) => {
        state.x += deltaX
        state.y += deltaY
        apply()
      },

      /**
       * 松手惯性：按速度（px/ms）推算衰减位移，power3.out 柔和减速。
       * 位移总量封顶 480px、时长随速度伸缩（0.3–0.8s）：甩得快就滑得久一点，
       * 内容不会飞离视口，收尾不带顿挫。任何新输入都会打断它。
       */
      fling: (velocityX: number, velocityY: number) => {
        if (prefersReducedMotion()) {
          return
        }
        const speed = Math.hypot(velocityX, velocityY)
        if (speed < 0.2) {
          return
        }
        let deltaX = velocityX * 180
        let deltaY = velocityY * 180
        const distance = Math.hypot(deltaX, deltaY)
        const maxDistance = 480
        if (distance > maxDistance) {
          deltaX *= maxDistance / distance
          deltaY *= maxDistance / distance
        }
        interrupt()
        discreteTweenRef.current = gsap.to(state, {
          x: state.x + deltaX,
          y: state.y + deltaY,
          duration: Math.min(0.3 + speed * 0.35, 0.8),
          ease: ease.soft,
          onUpdate: apply
        })
      }
    }
  }, [apply, minScale, maxScale])

  return engine
}

export type CanvasTransformEngine = ReturnType<typeof useCanvasTransform>
