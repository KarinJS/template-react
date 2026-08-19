import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** ShadowScroll 的属性。 */
interface ShadowScrollProps {
  /** 外层滚动容器的类名（布局、padding、max-h 等）。 */
  className?: string
  /** 渐变遮罩高度（px），只在对应方向还有可滚内容时出现。 */
  size?: number
  children: ReactNode
}

/**
 * 自研滚动遮罩容器：顶/底渐变只在对应方向还有可滚内容时出现。
 * 与 HeroUI ScrollShadow 的关键差异：ResizeObserver 同时观察容器和内容，
 * 内容高度变化（切换板块、折叠/展开文件夹）也会重新测量，
 * 不会出现「内容已变短、底部渐变却残留遮挡」的陈旧遮罩。
 */
export const ShadowScroll = ({ className, size = 48, children }: ShadowScrollProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [shadows, setShadows] = useState({ top: false, bottom: false })

  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) {
      return
    }

    const update = () => {
      const { scrollTop, clientHeight, scrollHeight } = container
      const next = {
        top: scrollTop > 1,
        bottom: scrollTop + clientHeight < scrollHeight - 1
      }
      setShadows((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next))
    }

    update()
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(container)
    // 内容高度变化（板块切换、折叠展开、数据区增删）必须重新测量：这是 HeroUI 版缺失的观察点。
    resizeObserver.observe(content)
    container.addEventListener('scroll', update, { passive: true })

    return () => {
      resizeObserver.disconnect()
      container.removeEventListener('scroll', update)
    }
  }, [])

  const maskImage = `linear-gradient(to bottom, ${shadows.top ? 'transparent' : 'black'} 0px, black ${shadows.top ? size : 0}px, black calc(100% - ${shadows.bottom ? size : 0}px), ${shadows.bottom ? 'transparent' : 'black'} 100%)`
  const maskStyle: CSSProperties = {
    maskImage,
    WebkitMaskImage: maskImage
  }

  return (
    <div ref={containerRef} className={className} style={{ overflowY: 'auto', scrollbarWidth: 'none', ...maskStyle }}>
      <div ref={contentRef}>{children}</div>
    </div>
  )
}
