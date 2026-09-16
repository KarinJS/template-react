import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

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
  /* 旧引擎外壳的 transform 会顺带成为绝对定位包含块，模板里的 inset-0 氛围层都锚定在
     卡片矩形上。标准化后外壳没有任何定位，这些层会锚到视口（Karin 截图视口和卡片
     尺寸不一致时，氛围层错位、底部装饰跑到上面）。relative 补回该语义，且不影响外观。 */
  position: relative;
  /* 旧引擎外壳的 transform 还会顺带创建层叠上下文，标准化后（含 zoom，任何取值都不会
     创建层叠上下文）模板里 -z-10 的氛围层会逃逸到 <html> 层叠上下文，被不透明的卡片
     背景整个盖住。isolate 补回该语义，且不影响外观。 */
  isolation: isolate;
}
`

/** 转义双引号，让值可以安全嵌入 HTML 属性。 */
const attr = (value: string): string => value.replace(/"/g, '&quot;')

/**
 * CSS 里的 url() 引用。值里不含引号和右括号，因此 image-set() 这类外层函数里的 url() 也能逐个命中。
 * 与旧实现保持同一限制：`url("a)b.png")` 这种值里带右括号的写法不支持。
 */
const cssUrlPattern = /url\(\s*(['"]?)([^'")]*)\1\s*\)/g

/**
 * url() 的值是否由浏览器自己处理，不需要框架解析成本地文件：
 * - 带协议的（`data:`、`http(s):`、`blob:`、Windows 盘符 `C:`）；
 * - 协议相对的（`//cdn.example.com/a.png`）；
 * - 纯片段（`#gradient`）；
 * - CSS 函数（`var(--logo)`、`image()`），它们不是路径。
 * @param value url() 里的原始值（已 trim）。
 * @returns 保持原样时返回 true。
 */
const isExternalCssReference = (value: string): boolean =>
  value.startsWith('//') || value.startsWith('#') || value.includes('(') || /^[a-z][a-z0-9+.-]*:/i.test(value)

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
  private readonly cssPath: string | undefined
  private readonly cssText: string | undefined
  private readonly extraStylePaths: string[]
  private readonly headExtra: string
  private readonly assetsDir: string | undefined
  private readonly assetsInlineLimit: number | ((filePath: string) => boolean)

  constructor(options: HtmlWrapperOptions) {
    this.cssPath = options.cssPath
    this.cssText = options.cssText
    this.extraStylePaths = options.extraStylePaths ?? []
    this.headExtra = options.headExtra ?? ''
    this.assetsDir = options.assetsDir
    this.assetsInlineLimit = options.assetsInlineLimit ?? 4096
  }

  /**
   * 把 React SSR 片段包成可交给 Karin 渲染器截图的完整 HTML。
   * #container 由包装器统一提供，用户组件不需要也不应该自己声明；
   * 它不做任何外观修饰，组件根元素的圆角、阴影、背景完全由用户自己控制。
   * ctx.scale 也在这里统一施加（zoom），模板不要自行缩放根元素，否则会叠加成 scale²。
   * @param htmlContent SSR 渲染出的模板片段。
   * @param ctx 当前渲染上下文，用来决定主题变量、dark 类名和渲染比例。
   * @returns 完整的 HTML 文档字符串。
   */
  wrapContent(htmlContent: string, ctx: RenderContext): string {
    const stylePaths = [...(this.cssPath ? [this.cssPath] : []), ...this.extraStylePaths]
    const inlineStyles = [this.cssText ?? '', ...stylePaths.map((filePath) => this.loadInlineCss(filePath))].filter(Boolean).join('\n')

    const mode = ctx.theme?.mode
    const variables = attr(themeVariables(ctx.theme))

    // 渲染比例用 zoom 而非 transform 施加：zoom 让布局盒随缩放变化，截图边界（#container）
    // 跟着放大，产物分辨率即 scale 倍；transform 不改布局盒，截图范围不会变。
    // 非法取值（NaN、0、负数、非数字）回退 1，等同于不缩放。
    const scale = typeof ctx.scale === 'number' && Number.isFinite(ctx.scale) && ctx.scale > 0 ? ctx.scale : 1

    // 主题变量只写 body：HeroUI 的 @theme inline 桥接把 bg-accent 编译成 var(--accent)，
    // 变量在任意祖先元素上声明都能被后代继承，不需要落在 :root。
    // 明暗同理——HeroUI 的 dark 变量定义在 `.dark, [data-theme="dark"]` 选择器上，body 带上即可。
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <style>${inlineStyles}</style>
  <style>${resetStyle()}</style>
  ${this.rewriteMarkupAssets(this.headExtra)}
</head>
<body class="${mode === 'dark' ? 'dark' : ''}"${mode ? ` data-theme="${mode}"` : ''} style="${variables}">
  <div id="container"${scale !== 1 ? ` style="zoom: ${scale}"` : ''}>${this.rewriteMarkupAssets(htmlContent)}</div>
</body>
</html>`
  }

  /**
   * 改写标记里的本地资源引用，保证截图引擎用 file:// 打开 HTML 时路径仍然正确。
   * 约定不变量：`/` 开头的引用路径永远等于 `<assetsDir>/` 下的相对路径——
   * dev 由 publicDir 根映射保证，构建时 copyAssets 原样保留目录结构，这里按同一约定解析。
   * 不超过 assetsInlineLimit 的内联为 base64 data URI（HTML 完全自洽），
   * 超过的转为 file:// 绝对路径（与 HTML 落盘位置无关）。
   * 未配置 assetsDir 或目录不存在（dev 面板由 publicDir 服务）时原样返回。
   * @param html 待处理的 HTML 片段。
   * @returns 改写后的 HTML。
   */
  rewriteMarkupAssets(html: string): string {
    if (!this.assetsDir || !fs.existsSync(this.assetsDir)) {
      return html
    }

    return html.replace(/\s(src|srcset|poster|href)=(["'])(\/[^"']*)\2/g, (match, name: string, quote: string, value: string) => {
      const rewritten = name === 'srcset' ? this.rewriteSrcset(value) : this.resolveMarkupAsset(value)
      return ` ${name}=${quote}${rewritten}${quote}`
    })
  }

  /**
   * srcset 是逗号分隔的「URL + 描述符」列表，逐个改写 URL 部分。
   * @param value srcset 属性值。
   * @returns 改写后的 srcset。
   */
  private rewriteSrcset(value: string): string {
    return value
      .split(',')
      .map((candidate) => {
        const parts = candidate.trim().split(/\s+/)
        if (parts.length === 0 || !parts[0]) {
          return candidate
        }
        parts[0] = this.resolveMarkupAsset(parts[0])
        return parts.join(' ')
      })
      .join(', ')
  }

  /**
   * 把单个 `/` 开头的引用解析成 data URI 或 file:// 绝对路径。
   * 协议相对（//cdn）、带协议的 URL 和 assetsDir 下不存在的文件都保持原样。
   * @param url 以 `/` 开头的引用路径。
   * @returns 改写后的 URL；无需改写时返回原值。
   */
  private resolveMarkupAsset(url: string): string {
    // 协议相对 URL（//example.com/x.png）不是本地资源。
    if (url.startsWith('//')) {
      return url
    }

    const assetPath = url.split(/[?#]/)[0]
    if (!assetPath) {
      return url
    }

    const absoluteAssetPath = path.join(this.assetsDir!, assetPath)
    if (!fs.existsSync(absoluteAssetPath)) {
      console.warn(`[ktr] 标记引用的资源不存在，保留原路径：${url}`)
      return url
    }

    if (this.shouldInlineAsset(absoluteAssetPath)) {
      return this.toDataUri(absoluteAssetPath) ?? url
    }
    return pathToFileURL(absoluteAssetPath).href
  }

  /**
   * 按 assetsInlineLimit 判断资源是否内联（阈值语义同 Vite：不超过阈值即内联）。
   * @param filePath 资源文件绝对路径。
   * @returns 内联返回 true。
   */
  private shouldInlineAsset(filePath: string): boolean {
    if (typeof this.assetsInlineLimit === 'function') {
      return this.assetsInlineLimit(filePath)
    }
    return fs.statSync(filePath).size <= this.assetsInlineLimit
  }

  /**
   * 内联 CSS，并把资源引用解析成本地可用的形式。
   *
   * 两类引用都会解析，依赖包（含 pnpm 的 `.pnpm` 真实路径）里的 CSS 与字体一视同仁——
   * 解析只依赖 CSS 文件自身的位置，不假设任何 node_modules 布局：
   * - 相对路径（`./x`、`../x`）：相对 CSS 所在目录。构建时 Vite 把 CSS 引用的资源输出到产物目录，
   *   依赖包里的 CSS 被 @import 内联后，它的字体引用也已经被改写成产物内的相对/根路径；
   * - `/` 开头：先按 CSS 所在目录解析（构建产物里的 `/assets/*` 就是这一种），
   *   再退到 assetsDir（`ktr/public` 里的资源按 `/xxx` 引用，与标记资源同一套约定）。
   *
   * 两种都按 assetsInlineLimit 决定形态，与标记资源一致：不超过阈值内联为 data URI（HTML 自洽），
   * 超过的转成 file:// 绝对路径——字体这类大文件不再 base64 进每一份 HTML。
   * @param cssFilePath 待内联的 CSS 文件路径。
   * @returns 处理后的 CSS 文本；文件缺失时返回空字符串。
   */
  loadInlineCss(cssFilePath: string): string {
    if (!cssFilePath || !fs.existsSync(cssFilePath)) {
      console.warn(`[ktr] 找不到 CSS 文件，已跳过：${cssFilePath}`)
      return ''
    }

    const cssContent = fs.readFileSync(cssFilePath, 'utf-8')
    return cssContent.replace(cssUrlPattern, (match, quote: string, rawValue: string) => {
      const rewritten = this.resolveCssReference(cssFilePath, rawValue)
      return rewritten === undefined ? match : `url(${quote}${rewritten}${quote})`
    })
  }

  /**
   * 把单个 url() 的值解析成 data URI 或 file:// 绝对路径。
   * 外部引用、CSS 函数和找不到的文件保持原样（后者打一条警告，方便定位写错的路径）。
   * @param cssFilePath CSS 文件绝对路径，相对引用以它为基准。
   * @param rawValue url() 里的原始值。
   * @returns 改写后的 URL；无需改写时返回 undefined。
   */
  private resolveCssReference(cssFilePath: string, rawValue: string): string | undefined {
    const value = rawValue.trim()
    if (!value || isExternalCssReference(value)) {
      return undefined
    }

    // 查询串和哈希只影响浏览器缓存，定位文件时去掉；改写后的 data URI / file:// 不再带它们
    //（file:// 带查询串在部分平台直接解析不到文件）。
    const reference = value.split(/[?#]/)[0]
    if (!reference) {
      return undefined
    }

    const assetPath = this.findCssAsset(cssFilePath, reference)
    if (!assetPath) {
      console.warn(`[ktr] CSS 引用的资源不存在，保持原路径：${value}`)
      return undefined
    }

    if (this.shouldInlineAsset(assetPath)) {
      return this.toDataUri(assetPath) ?? undefined
    }

    return pathToFileURL(assetPath).href
  }

  /**
   * 按约定定位 CSS 引用的本地文件。
   * `/` 开头的引用两种解释都试：构建产物根（CSS 同级，Vite 输出的 `assets/*`）和 assetsDir
   * （随包发布的资源目录，`ktr/public` 里的文件按 `/xxx` 引用），命中即用。
   * @param cssFilePath CSS 文件绝对路径。
   * @param reference url() 里的引用路径（已去掉查询串与哈希）。
   * @returns 命中的文件绝对路径；都找不到时返回 undefined。
   */
  private findCssAsset(cssFilePath: string, reference: string): string | undefined {
    const rooted = reference.startsWith('/')
    // `/` 开头时两个基准都试：CSS 同级（构建产物根）和 assetsDir（随包发布的资源目录）。
    const bases = rooted ? [path.dirname(cssFilePath), this.assetsDir] : [path.dirname(cssFilePath)]

    for (const base of bases) {
      if (!base) {
        continue
      }

      for (const item of this.cssReferenceCandidates(reference)) {
        const candidate = rooted ? path.join(base, item) : path.resolve(base, item)
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate
        }
      }
    }

    return undefined
  }

  /**
   * url() 的值的候选写法：CSS 里的 URL 可能对空格等字符做了百分号编码
   * （Vite 输出的资源地址就会编码，磁盘上的文件名是原文），两种都试一次。
   * @param reference url() 里的引用路径。
   * @returns 去重后的候选路径列表。
   */
  private cssReferenceCandidates(reference: string): string[] {
    try {
      const decoded = decodeURIComponent(reference)
      return decoded === reference ? [reference] : [reference, decoded]
    } catch {
      // 非法百分号序列（如文件名里真的有 % ）按原文找。
      return [reference]
    }
  }

  /**
   * 读取资源文件并转换为 data URI。
   * @param assetPath 资源文件绝对路径。
   * @returns data URI 字符串；文件缺失时返回 null。
   */
  private toDataUri(assetPath: string): string | null {
    if (!fs.existsSync(assetPath)) {
      console.warn(`[ktr] CSS 引用的资源不存在，已跳过：${assetPath}`)
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
