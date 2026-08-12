/**
 * 字体 CDN 导入。
 *
 * 面板侧边栏可以让用户粘贴 Google Fonts / Fontsource / Fontshare / Bunny Fonts
 * 的样式表 URL，动态注入到沙盒和导出 CSS；也可以直接粘贴 .woff2 URL，
 * 生成对应的 @font-face 块。
 */

/** 允许的样式表 CDN 域名（白名单）。 */
const allowedHosts = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'fonts.bunny.net']

/** Fontsource / jsDelivr 允许的路径前缀（白名单）。 */
const allowedJsDelivrPrefixes = ['/fontsource/fonts/', '/npm/@fontsource/', '/npm/@fontsource-variable/']

/** 可能直接粘贴的字体文件后缀。 */
const fontFileExtensions = ['.woff2', '.woff', '.ttf', '.otf', '.eot']

/** 一条用户导入的 CDN 字体。 */
export interface CustomFont {
  /** font-family 名称，写进 --font-sans / --font-mono 时用它。 */
  family: string
  /** 样式表或字体文件的 URL。 */
  url: string
}
/** 错误码，用于国际化提示。 */
export type FontUrlError = 'not-https' | 'not-allowed-cdn' | 'invalid-url' | 'cannot-detect-family' | 'already-imported'

/**
 * 检查 URL 是否是受支持的字体 CDN 或本地字体文件。
 *
 * 返回 null 表示合法，返回错误码说明具体问题。
 */
export const validateFontUrl = (urlString: string): FontUrlError | null => {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return 'invalid-url'
  }

  if (url.protocol !== 'https:') return 'not-https'

  // jsDelivr 只认特定路径
  if (url.hostname === 'cdn.jsdelivr.net') {
    return allowedJsDelivrPrefixes.some((prefix) => url.pathname.startsWith(prefix)) ? null : 'not-allowed-cdn'
  }

  // 其他 CDN 检查域名白名单
  return allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? null : 'not-allowed-cdn'
}

/**
 * 从样式表 URL 中推断 font-family 名称。
 *
 * 支持 Google Fonts 的 `?family=` 和 Fontsource 路径规则；
 * 推断不出来返回 null，让调用方提示用户换一个 URL 或手动填 family。
 */
export const detectFontFamily = (urlString: string): string | null => {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return null
  }

  // Google Fonts: ?family=Inter:wght@400;700
  const familyParam = url.searchParams.get('family')
  if (familyParam) {
    const name = familyParam.split('|')[0]?.split(':')[0]?.replaceAll('+', ' ').trim()
    if (name) return titleCase(name)
  }

  // Bunny Fonts: ?f[]=inter@400
  const fParam = url.searchParams.get('f[]')
  if (fParam) {
    const name = fParam.split('@')[0]?.trim()
    if (name) return titleCase(name.replaceAll('-', ' '))
  }

  // Fontsource: /npm/@fontsource/inter 或 /fontsource/fonts/inter
  const fontsourceMatch = /\/npm\/@fontsource(?:-variable)?\/([^@/]+)|\/fontsource\/fonts\/([^@/:]+)/.exec(url.pathname)
  if (fontsourceMatch) {
    const slug = fontsourceMatch[1] ?? fontsourceMatch[2]
    if (slug) return titleCase(slug.replaceAll('-', ' '))
  }

  return null
}

/** 把 kebab-case 或 space-case 转成 Title Case。 */
const titleCase = (str: string): string =>
  str
    .toLowerCase()
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/**
 * 判断 URL 是不是直接指向字体文件（而非样式表）。
 *
 * 用于决定注入方式：样式表用 `<link>`，字体文件生成 `<style>` + `@font-face`。
 */
export const isFontFileUrl = (urlString: string): boolean => {
  const path = urlString.split(/[?#]/)[0]?.toLowerCase() ?? ''
  return fontFileExtensions.some((ext) => path.endsWith(ext))
}

/**
 * 为直接粘贴的字体文件 URL 生成 @font-face 规则。
 *
 * 根据路径特征（`:vf@` / `-wght-` / `-opsz-` 或后缀）推断格式和 font-weight，
 * 尽可能生成可变字体声明（`font-weight: 100 900`），后备普通字重。
 */
export const generateFontFace = (family: string, urlString: string): string => {
  const isVariable = urlString.includes(':vf@') || urlString.includes('-wght-') || urlString.includes('-opsz-')
  const lower = urlString.toLowerCase()

  let format = 'woff2'
  if (lower.includes('.woff') && !lower.includes('.woff2')) format = 'woff'
  else if (lower.includes('.ttf')) format = 'truetype'
  else if (lower.includes('.otf')) format = 'opentype'
  else if (isVariable) format = 'woff2-variations'

  return `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-display: swap;
  font-weight: ${isVariable ? '100 900' : '400'};
  src: url(${urlString}) format('${format}');
}`
}

/**
 * 把错误码翻译成面向用户的中文提示。
 */
export const getFontUrlErrorMessage = (error: FontUrlError): string => {
  switch (error) {
    case 'not-https':
      return 'URL 必须使用 https 协议'
    case 'not-allowed-cdn':
      return 'URL 必须来自受支持的 CDN（Google Fonts、Fontsource、Fontshare、Bunny Fonts）'
    case 'invalid-url':
      return '请输入有效的 URL'
    case 'cannot-detect-family':
      return '无法从 URL 中识别字体，请确认它是有效的字体样式表'
    case 'already-imported':
      return '该字体已导入'
  }
}
