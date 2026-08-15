import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { HtmlWrapper } from '../../src/runtime'
import type { RenderContext } from '../../src/types'

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-html-'))

const context = (dark = false): RenderContext => ({
  scale: 1,
  theme: {
    mode: dark ? 'dark' : 'light',
    accent: '#0a72ef',
    accentForeground: '#fafafa',
    accentSoft: 'color-mix(in oklab, #0a72ef 14%, transparent)',
    accentSoftForeground: '#0a72ef',
    background: dark ? '#09090b' : '#ffffff',
    foreground: dark ? '#fafafa' : '#09090b',
    surface: dark ? '#111113' : '#ffffff',
    muted: dark ? '#a1a1aa' : '#71717a',
    border: dark ? '#27272a' : '#e4e4e7'
  }
})

describe('HtmlWrapper', () => {
  it('inlines CSS and rewrites relative assets to data URIs', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'font.woff2'), 'font-data', 'utf-8')
    const cssPath = path.join(dir, 'style.css')
    const extraPath = path.join(dir, 'extra.css')
    fs.writeFileSync(cssPath, '@font-face{src:url("./font.woff2")}.a{color:red}', 'utf-8')
    fs.writeFileSync(extraPath, '.b{color:blue}', 'utf-8')

    const wrapper = new HtmlWrapper({ cssPath, extraStylePaths: [extraPath] })
    const html = wrapper.wrapContent('<div id="container"></div>', context())

    expect(html).toContain('data:font/woff2;base64')
    expect(html).toContain('.a{color:red}')
    expect(html).toContain('.b{color:blue}')
    expect(html).toContain('data-theme="light"')
    // 主题变量只写 body：HeroUI 的 @theme inline 桥接让 token 类编译成 var(--accent)，
    // 变量在任意祖先上声明都会被继承，不需要落到 :root，也不需要在 html 上重复一遍。
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('--accent: #0a72ef')
    // 曾经额外下发的 --ktr-theme-* 别名全仓无人消费，已移除。
    expect(html).not.toContain('--ktr-theme-')
    // 内容被包装进被动的 #container 截图边界，包装器不强加任何外观。
    expect(html).toContain('<div id="container">')
    expect(html).not.toContain('border-radius: 5rem')
    // flex 容器下禁止截图边界被视口宽度压缩，否则宽于视口的模板会被裁切；
    // relative 让 #container 成为绝对定位包含块，模板氛围层锚定在卡片矩形而非视口。
    expect(html).toContain('#container {\n  flex-shrink: 0;')
  })

  it('emits no theme variables or data-theme when caller provides no theme', () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')

    const html = new HtmlWrapper({ cssPath }).wrapContent('<p>hi</p>', { scale: 1 })
    // 框架不发明默认主题色：未提供 theme 时不输出变量、不写 data-theme，组件库自身主题生效。
    expect(html).not.toContain('--accent')
    expect(html).not.toContain('data-theme')
    expect(html).toContain('<body class="" style="">')
    expect(html).toContain('<div id="container"><p>hi</p></div>')
  })

  it('直接内嵌 cssText，不依赖构建机上的 CSS 文件', () => {
    const html = new HtmlWrapper({ cssText: '.standalone{display:flex}' }).wrapContent('<div class="standalone">standalone</div>', {
      scale: 1
    })

    expect(html).toContain('.standalone{display:flex}')
    expect(html).toContain('class="standalone"')
  })

  it('keeps remote and absolute URLs as-is and tolerates missing CSS', () => {
    const wrapper = new HtmlWrapper({ cssPath: path.join(tempDir(), 'missing.css') })
    const html = wrapper.wrapContent('<div style="background:url(https://example.com/a.png)"></div>', context(true))
    expect(html).toContain('<body class="dark"')
    expect(html).not.toContain('border-radius: 5rem')
  })
})
