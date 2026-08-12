import fs from 'node:fs'
import path from 'node:path'

import type { HtmlWrapperOptions, RenderContext } from '../types'

/**
 * SSR 输出页面的基础重置样式：背景透明保证截图圆角处无底色，#container 只是被动的截图边界，
 * 圆角、阴影、背景等外观完全由用户组件根元素自己的 className 决定。
 * #container 必须 flex-shrink: 0：body 是 flex 容器且宽度受视口（默认 800px）限制，
 * 不禁止收缩时宽于视口的模板会被压缩（配合 overflow 裁剪就是右侧内容被切掉）。
 * @returns 重置样式 CSS 文本。
 */
const resetStyle = () => `
html, body {
  margin: 0;
  padding: 0;
  background: transparent !important;
}
body {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}
#container {
  flex-shrink: 0;
}
`

/** 转义双引号，让值可以安全嵌入 HTML 属性。 */
const attr = (value: string): string => value.replace(/"/g, '&quot;')

/**
 * 把显式提供的主题字段转换成 CSS 变量；未提供的字段一律不输出，让组件库自身主题生效。
 * @param theme 调用方显式提供的主题变量，可能为空或部分字段。
 * @returns 可直接写进 style 属性的内联样式字符串。
 */
const themeVariables = (theme?: Partial<RenderContext['theme']>): string => {
  if (!theme) {
    return ''
  }

  // 变量名与 HeroUI 的语义色变量一一对应（ThemeContext 的字段名就是照它取的），
  // 覆盖这些变量即可换肤，无需另造一套 --ktr-theme-* 别名（那套全仓只写不读，已移除）。
  const entries: Array<[string, string | undefined]> = [
    ['--background', theme.background],
    ['--foreground', theme.foreground],
    ['--surface', theme.surface],
    ['--muted', theme.muted],
    ['--border', theme.border],
    ['--accent', theme.accent],
    ['--accent-foreground', theme.accentForeground],
    ['--accent-soft', theme.accentSoft],
    ['--accent-soft-foreground', theme.accentSoftForeground]
  ]

  // vars 里的任意变量追加在后面：同名时覆盖上面的快捷字段。
  for (const [name, value] of Object.entries(theme.vars ?? {})) {
    // 只接受合法的自定义属性名，挡掉借键名注入选择器或声明的情况。
    if (/^--[a-z0-9-]+$/i.test(name)) {
      entries.push([name, value])
    }
  }

  // 过滤值中的引号和分号，防止主题色被注入额外 CSS 声明。
  return entries
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .map(([name, value]) => `${name}: ${value.replace(/[;"{}]/g, '')}`)
    .join('; ')
}

export class HtmlWrapper {
  private readonly cssPath: string
  private readonly extraStylePaths: string[]
  private readonly headExtra: string

  constructor(options: HtmlWrapperOptions) {
    this.cssPath = options.cssPath
    this.extraStylePaths = options.extraStylePaths ?? []
    this.headExtra = options.headExtra ?? ''
  }

  /**
   * 把 React SSR 片段包成可交给 Karin 渲染器截图的完整 HTML。
   * #container 由包装器统一提供，用户组件不需要也不应该自己声明；
   * 它不做任何外观修饰，组件根元素的圆角、阴影、背景完全由用户自己控制。
   * @param htmlContent SSR 渲染出的模板片段。
   * @param ctx 当前渲染上下文，用来决定主题变量和 dark 类名。
   * @returns 完整的 HTML 文档字符串。
   */
  wrapContent(htmlContent: string, ctx: RenderContext): string {
    const inlineStyles = [this.cssPath, ...this.extraStylePaths]
      .map((filePath) => this.loadInlineCss(filePath))
      .filter(Boolean)
      .join('\n')

    const mode = ctx.theme?.mode
    const variables = attr(themeVariables(ctx.theme))

    // 主题变量只写 body：HeroUI 的 @theme inline 桥接把 bg-accent 编译成 var(--accent)，
    // 变量在任意祖先元素上声明都能被后代继承到，不需要落在 :root。
    // 明暗同理——HeroUI 的 dark 变量定义在 `.dark, [data-theme="dark"]` 选择器上，body 带上即可。
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <style>${inlineStyles}</style>
  <style>${resetStyle()}</style>
  ${this.headExtra}
</head>
<body class="${mode === 'dark' ? 'dark' : ''}"${mode ? ` data-theme="${mode}"` : ''} style="${variables}">
  <div id="container">${htmlContent}</div>
</body>
</html>`
  }

  /**
   * 内联 CSS，并把相对资源路径转成 data URI，保证生产环境文件自洽。
   * @param cssFilePath 待内联的 CSS 文件路径。
   * @returns 处理后的 CSS 文本；文件缺失时返回空字符串。
   */
  loadInlineCss(cssFilePath: string): string {
    if (!cssFilePath || !fs.existsSync(cssFilePath)) {
      console.warn(`[ktr] CSS file not found, skipped: ${cssFilePath}`)
      return ''
    }

    const cssDir = path.dirname(cssFilePath)
    const cssContent = fs.readFileSync(cssFilePath, 'utf-8')

    // 只重写相对路径的 url()，data:、http(s):、file:、# 和绝对路径保持原样。
    return cssContent.replace(
      /url\(\s*(['"]?)(?!data:|https?:|file:|#|\/)([^'")]+)\1\s*\)/g,
      (_match, quote: string, rawAssetPath: string) => {
        const normalizedAssetPath = rawAssetPath.trim()
        const assetFilePath = normalizedAssetPath.split(/[?#]/)[0]
        if (!assetFilePath) {
          return `url(${quote}${normalizedAssetPath}${quote})`
        }

        const absoluteAssetPath = path.resolve(cssDir, assetFilePath)
        const dataUri = this.toDataUri(absoluteAssetPath)
        return dataUri ? `url(${quote}${dataUri}${quote})` : `url(${quote}${normalizedAssetPath}${quote})`
      }
    )
  }

  /**
   * 读取资源文件并转换为 data URI。
   * @param assetPath 资源文件绝对路径。
   * @returns data URI 字符串；文件缺失时返回 null。
   */
  private toDataUri(assetPath: string): string | null {
    if (!fs.existsSync(assetPath)) {
      console.warn(`[ktr] asset referenced by CSS was not found, skipped: ${assetPath}`)
      return null
    }

    const mimeType = this.getAssetMimeType(assetPath)
    const fileBuffer = fs.readFileSync(assetPath)
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`
  }

  /**
   * 根据扩展名推断 CSS 资源 MIME。
   * @param assetPath 资源文件路径。
   * @returns 对应的 MIME 类型，未知扩展名返回 application/octet-stream。
   */
  private getAssetMimeType(assetPath: string): string {
    const ext = path.extname(assetPath).toLowerCase()

    switch (ext) {
      case '.woff2':
        return 'font/woff2'
      case '.woff':
        return 'font/woff'
      case '.ttf':
        return 'font/ttf'
      case '.otf':
        return 'font/otf'
      case '.eot':
        return 'application/vnd.ms-fontobject'
      case '.svg':
        return 'image/svg+xml'
      case '.png':
        return 'image/png'
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg'
      case '.gif':
        return 'image/gif'
      case '.webp':
        return 'image/webp'
      case '.avif':
        return 'image/avif'
      default:
        return 'application/octet-stream'
    }
  }
}
