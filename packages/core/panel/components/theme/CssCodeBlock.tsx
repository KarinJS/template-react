import { ScrollShadow } from '@heroui/react'
import { useEffect, useState } from 'react'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'

/** 代码块的属性。 */
interface CssCodeBlockProps {
  /** 要展示的 CSS 源码。 */
  code: string
  /** 面板外壳明暗，决定高亮主题。 */
  panelTheme: 'light' | 'dark'
}

/** 高亮器单例，避免每次渲染都重建 WASM 引擎。 */
let highlighterPromise: Promise<HighlighterCore> | null = null

/**
 * 懒加载 shiki 高亮器。
 *
 * 只注册 css 语法和两套 GitHub 主题：全量 shiki 有几 MB，
 * 按需引入后这块只占几十 KB，且被 Vite 拆成独立 chunk。
 */
const getHighlighter = (): Promise<HighlighterCore> => {
  highlighterPromise ??= createHighlighterCore({
    engine: createOnigurumaEngine(import('shiki/wasm')),
    langs: [import('@shikijs/langs/css')],
    themes: [import('@shikijs/themes/github-light-default'), import('@shikijs/themes/github-dark-default')]
  })

  return highlighterPromise
}

/**
 * 带语法高亮的 CSS 代码块。
 *
 * 高亮交给 shiki（和文档站同一套 GitHub 主题），不自己写 tokenizer；
 * 滚动条用 HeroUI 的 ScrollShadow，跟面板其他滚动区域保持一致，
 * 而不是露出浏览器原生滚动条。
 *
 * 高亮结果没出来之前先显示纯文本，保证内容始终可读、可选中复制。
 */
export const CssCodeBlock = ({ code, panelTheme }: CssCodeBlockProps) => {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false

    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return
        setHtml(
          highlighter.codeToHtml(code, {
            lang: 'css',
            theme: panelTheme === 'dark' ? 'github-dark-default' : 'github-light-default'
          })
        )
      })
      .catch(() => {
        // 高亮失败就保持纯文本，不影响复制。
      })

    return () => {
      cancelled = true
    }
  }, [code, panelTheme])

  return (
    <ScrollShadow
      className="min-h-0 flex-1 rounded-xl bg-surface text-[10px] leading-relaxed"
      orientation="vertical"
      size={20}
      tabIndex={0}
    >
      {html ? (
        // shiki 自带背景色，这里强行透明化以继承面板的 surface 配色。
        <div
          className="[&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-3 [&_code]:font-mono [&_.shiki]:bg-transparent!"
          dangerouslySetInnerHTML={{ __html: html }}
          translate="no"
        />
      ) : (
        <pre className="m-0 p-3 font-mono text-muted" translate="no">
          {code}
        </pre>
      )}
    </ScrollShadow>
  )
}
