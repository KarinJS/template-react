import { describe, expect, it } from 'vitest'

import { detectFontFamily, generateFontFace, getFontUrlErrorMessage, isFontFileUrl, validateFontUrl } from '../../panel/theme/fontCdn'

describe('validateFontUrl', () => {
  it('放行受支持的 CDN', () => {
    expect(validateFontUrl('https://fonts.googleapis.com/css2?family=Inter')).toBeNull()
    expect(validateFontUrl('https://api.fontshare.com/v2/css?f[]=satoshi@400')).toBeNull()
    expect(validateFontUrl('https://fonts.bunny.net/css?family=inter')).toBeNull()
  })

  it('放行子域名', () => {
    expect(validateFontUrl('https://cdn.fonts.googleapis.com/css2?family=Inter')).toBeNull()
  })

  it('拒绝非 https', () => {
    expect(validateFontUrl('http://fonts.googleapis.com/css2?family=Inter')).toBe('not-https')
  })

  it('拒绝白名单外的域名', () => {
    expect(validateFontUrl('https://evil.example.com/font.css')).toBe('not-allowed-cdn')
  })

  it('拒绝无法解析的 URL', () => {
    expect(validateFontUrl('not a url')).toBe('invalid-url')
    expect(validateFontUrl('')).toBe('invalid-url')
  })

  it('jsDelivr 只放行 fontsource 路径', () => {
    expect(validateFontUrl('https://cdn.jsdelivr.net/npm/@fontsource/inter/index.css')).toBeNull()
    expect(validateFontUrl('https://cdn.jsdelivr.net/npm/@fontsource-variable/inter/index.css')).toBeNull()
    // 同域但任意路径会变成任意脚本/样式来源，必须挡住。
    expect(validateFontUrl('https://cdn.jsdelivr.net/npm/evil-pkg/x.css')).toBe('not-allowed-cdn')
  })
})

describe('detectFontFamily', () => {
  it('识别 Google Fonts 的 family 参数', () => {
    expect(detectFontFamily('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@100..900')).toBe('Noto Sans Sc')
  })

  it('多字体只取第一个', () => {
    expect(detectFontFamily('https://fonts.googleapis.com/css?family=Inter|Roboto')).toBe('Inter')
  })

  it('识别 Bunny Fonts 的 f[] 参数', () => {
    expect(detectFontFamily('https://fonts.bunny.net/css?f[]=dm-sans@400')).toBe('Dm Sans')
  })

  it('识别 Fontsource 路径', () => {
    expect(detectFontFamily('https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/index.css')).toBe('Jetbrains Mono')
    expect(detectFontFamily('https://cdn.jsdelivr.net/npm/@fontsource-variable/inter/index.css')).toBe('Inter')
  })

  it('识别不出时返回 null，交给调用方提示', () => {
    expect(detectFontFamily('https://fonts.googleapis.com/css2')).toBeNull()
    expect(detectFontFamily('not a url')).toBeNull()
  })
})

describe('isFontFileUrl', () => {
  it('识别直链字体文件', () => {
    expect(isFontFileUrl('https://x.com/a.woff2')).toBe(true)
    expect(isFontFileUrl('https://x.com/a.ttf')).toBe(true)
  })

  it('带查询串或哈希仍能识别', () => {
    expect(isFontFileUrl('https://x.com/a.woff2?v=1#f')).toBe(true)
  })

  it('样式表不算字体文件', () => {
    expect(isFontFileUrl('https://fonts.googleapis.com/css2?family=Inter')).toBe(false)
  })
})

describe('generateFontFace', () => {
  it('普通字体生成固定字重', () => {
    const css = generateFontFace('Inter', 'https://x.com/inter.woff2')
    expect(css).toContain(`font-family: 'Inter'`)
    expect(css).toContain('font-weight: 400')
    expect(css).toContain(`format('woff2')`)
    expect(css).toContain('font-display: swap')
  })

  it('可变字体生成字重区间', () => {
    const css = generateFontFace('Inter', 'https://x.com/inter:vf@400.woff2')
    expect(css).toContain('font-weight: 100 900')
    expect(css).toContain(`format('woff2-variations')`)
  })

  it('按后缀推断格式', () => {
    expect(generateFontFace('A', 'https://x.com/a.ttf')).toContain(`format('truetype')`)
    expect(generateFontFace('A', 'https://x.com/a.otf')).toContain(`format('opentype')`)
    expect(generateFontFace('A', 'https://x.com/a.woff')).toContain(`format('woff')`)
  })
})

describe('getFontUrlErrorMessage', () => {
  it('每个错误码都有中文提示，不泄漏码值', () => {
    const codes = ['not-https', 'not-allowed-cdn', 'invalid-url', 'cannot-detect-family', 'already-imported'] as const

    for (const code of codes) {
      const message = getFontUrlErrorMessage(code)
      expect(message).toBeTruthy()
      expect(message).not.toContain(code)
    }
  })
})
