import { useEffect, useRef, type RefObject } from 'react'

import { generateFontFace, isFontFileUrl, type CustomFont } from './fontCdn'

/** 注入沙盒的主题 style 标签 id。 */
const themeStyleId = 'ktr-template-theme'

/** 字体资源节点的 id 前缀，便于批量比对和回收。 */
const fontNodePrefix = 'ktr-font-'

/**
 * 把主题 CSS 和字体资源同步进 iframe 沙盒。
 *
 * 走 DOM 注入而不是 postMessage：变量改动要立刻反映到画布上，
 * 消息往返会慢一帧，拖滑块时能看出迟滞。
 *
 * @param iframeRef 目标 iframe。
 * @param css 主题 CSS；空串表示用户没自定义，此时移除注入让组件库默认主题生效。
 * @param readyTick 沙盒重新就绪的计数器，变化时重新注入（iframe 换文档会清空 head）。
 * @param fonts 需要在沙盒里加载的 CDN 字体。
 */
export const useSandboxThemeSync = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
  css: string,
  readyTick: number,
  fonts: readonly CustomFont[] = []
) => {
  // 用 ref 存最新值：effect 只依赖 readyTick，避免每次 css 变化都重新绑 load 监听。
  const cssRef = useRef(css)
  cssRef.current = css

  const fontsRef = useRef(fonts)
  fontsRef.current = fonts

  /** 指向当前 iframe 的同步函数，供 css/fonts 变化时复用。 */
  const syncRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    /** 同步字体节点：先回收已移除的，再补上缺失的。 */
    const syncFonts = (doc: Document) => {
      const wanted = new Set(fontsRef.current.map((font) => `${fontNodePrefix}${encodeURIComponent(font.url)}`))

      const stale: Element[] = []
      doc.head.querySelectorAll(`[id^="${fontNodePrefix}"]`).forEach((node) => {
        if (!wanted.has(node.id)) {
          stale.push(node)
        }
      })
      for (const node of stale) {
        node.remove()
      }

      for (const font of fontsRef.current) {
        const id = `${fontNodePrefix}${encodeURIComponent(font.url)}`
        if (doc.getElementById(id)) continue

        // 直链字体文件要自己写 @font-face；样式表则交给 <link>。
        if (isFontFileUrl(font.url)) {
          const style = doc.createElement('style')
          style.id = id
          style.textContent = generateFontFace(font.family, font.url)
          doc.head.appendChild(style)
        } else {
          const link = doc.createElement('link')
          link.id = id
          link.rel = 'stylesheet'
          link.href = font.url
          doc.head.appendChild(link)
        }
      }
    }

    /** 同步主题变量。 */
    const syncTheme = () => {
      const doc = iframe.contentDocument
      if (!doc?.head) return

      syncFonts(doc)

      const existing = doc.getElementById(themeStyleId)

      // 没有自定义主题就撤掉注入，让 HeroUI 自身主题重新接管。
      if (!cssRef.current) {
        existing?.remove()
        return
      }

      if (existing) {
        existing.textContent = cssRef.current
        return
      }

      const style = doc.createElement('style')
      style.id = themeStyleId
      style.textContent = cssRef.current
      doc.head.appendChild(style)
    }

    syncTheme()

    // iframe 重新加载会清掉 head，load 之后要补注入。
    iframe.addEventListener('load', syncTheme)
    syncRef.current = syncTheme

    return () => {
      iframe.removeEventListener('load', syncTheme)
      syncRef.current = null
    }
  }, [iframeRef, readyTick])

  // css、字体变化时重新写入，但不重建 load 监听：
  // 反复解绑重绑会让注入时序变得不可预期。
  useEffect(() => {
    // 合并到下一帧：拖滑块时 css 每帧都变，逐次写 DOM 会拖慢渲染。
    const frame = requestAnimationFrame(() => syncRef.current?.())

    return () => cancelAnimationFrame(frame)
  }, [css, fonts])
}
