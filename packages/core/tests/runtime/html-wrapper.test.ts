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

  it('CSS 相对引用与标记资源同一套阈值：小的内联，大的转 file:// 不进 base64', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'small.png'), 'tiny', 'utf-8')
    fs.writeFileSync(path.join(dir, 'big.woff2'), 'x'.repeat(5000), 'utf-8')
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, ".a{background:url('./small.png')}\n@font-face{src:url(big.woff2) format('woff2')}", 'utf-8')

    const html = new HtmlWrapper({ cssPath }).wrapContent('<p>hi</p>', { scale: 1 })

    // 大字体走 file:// 绝对路径：截图引擎按 file:// 打开 HTML，字体照样加载，但不占 HTML 体积。
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain("url('./small.png')")
    expect(html).toMatch(/url\(['"]?file:\/\/\/[^'"]*big\.woff2['"]?\)/)
    expect(html).not.toContain('data:font/woff2;base64,')
  })

  it('CSS 引用的文件名带空格时按原文找盘上文件；目录引用不算命中', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'My Font.woff2'), 'x'.repeat(5000), 'utf-8')
    fs.mkdirSync(path.join(dir, 'fonts'))
    const cssPath = path.join(dir, 'style.css')
    // Vite 输出的资源地址会对空格做百分号编码，磁盘上的文件名是原文。
    fs.writeFileSync(cssPath, "@font-face{src:url('./My%20Font.woff2')}\n.b{background:url(./fonts)}", 'utf-8')

    const html = new HtmlWrapper({ cssPath }).wrapContent('<p>hi</p>', { scale: 1 })

    expect(html).toMatch(/url\(['"]?file:\/\/\/[^'"]*My%20Font\.woff2['"]?\)/)
    expect(html).toContain('url(./fonts)')
  })

  it('CSS 里的 / 开头引用：先按构建产物目录解析，再退到 assetsDir', () => {
    const dir = tempDir()
    const buildDir = path.join(dir, 'lib')
    const assetsDir = path.join(dir, 'ktr/public')
    fs.mkdirSync(path.join(buildDir, 'assets'), { recursive: true })
    fs.mkdirSync(path.join(assetsDir, 'image'), { recursive: true })
    // 构建期 Vite 把依赖包 CSS 引用的字体输出成 <产物目录>/assets/<名字>-<hash>.woff2。
    fs.writeFileSync(path.join(buildDir, 'assets/dep-font-C9sBJCER.woff2'), 'x'.repeat(5000), 'utf-8')
    // 随包发布的资源目录：模板按 /image/logo.png 引用，产物目录下没有这份文件。
    fs.writeFileSync(path.join(assetsDir, 'image/logo.png'), 'tiny', 'utf-8')

    const cssPath = path.join(buildDir, 'style.css')
    fs.writeFileSync(cssPath, "@font-face{src:url('/assets/dep-font-C9sBJCER.woff2')}\n.logo{background:url('/image/logo.png')}", 'utf-8')

    const html = new HtmlWrapper({ cssPath, assetsDir }).wrapContent('<div class="logo"></div>', { scale: 1 })

    // 两种解释都不能留成 /assets/...、/image/...：截图页是 file://，根路径解析成 file:///assets/... 必然 404。
    expect(html).toMatch(/url\('file:\/\/\/[^']*dep-font-C9sBJCER\.woff2'\)/)
    expect(html).toContain("url('data:image/png;base64,")
    expect(html).not.toContain("url('/assets/")
    expect(html).not.toContain("url('/image/")
  })

  it('CSS 里的外部引用、CSS 函数和缺失文件保持原样', () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(
      cssPath,
      [
        '.a{background:url(https://cdn.com/a.png)}',
        '.b{background:url(data:image/gif;base64,AAA)}',
        '.c{background:url(#gradient)}',
        '.d{background:url(var(--logo))}',
        '.e{background:url("//cdn.com/b.png")}',
        '.f{background:url(/missing.png)}',
        '.g{background:url(./missing-too.png?rev=2)}'
      ].join('\n'),
      'utf-8'
    )

    const html = new HtmlWrapper({ cssPath, assetsDir: dir }).wrapContent('<p>hi</p>', { scale: 1 })

    expect(html).toContain('url(https://cdn.com/a.png)')
    expect(html).toContain('url(data:image/gif;base64,AAA)')
    expect(html).toContain('url(#gradient)')
    expect(html).toContain('url(var(--logo))')
    expect(html).toContain('url("//cdn.com/b.png")')
    // 找不到的文件保持原样，方便在产物里一眼看出是哪条引用没落地。
    expect(html).toContain('url(/missing.png)')
    expect(html).toContain('url(./missing-too.png?rev=2)')
  })

  it('标记资源：不超过阈值内联为 base64，超过的转为 file:// 绝对路径', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'small.png'), 'tiny', 'utf-8')
    fs.writeFileSync(path.join(dir, 'big.png'), 'x'.repeat(5000), 'utf-8')

    const wrapper = new HtmlWrapper({ assetsDir: dir })
    const html = wrapper.wrapContent('<img src="/small.png"><img src="/big.png">', { scale: 1 })

    // 小文件内联，HTML 自洽；大文件转 file:// 绝对路径，与 HTML 落盘位置无关。
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).toContain('src="file://')
    expect(html).not.toContain('src="/small.png"')
    expect(html).not.toContain('src="/big.png"')
  })

  it('函数形式的阈值按文件决定内联；远程、协议相对和缺失资源保持原样', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'a.png'), 'x'.repeat(100), 'utf-8')
    fs.writeFileSync(path.join(dir, 'b.png'), 'x'.repeat(100), 'utf-8')

    const wrapper = new HtmlWrapper({ assetsDir: dir, assetsInlineLimit: (filePath) => filePath.endsWith('a.png') })
    const html = wrapper.wrapContent(
      '<img src="/a.png"><img src="/b.png"><img src="https://cdn.com/x.png"><img src="data:image/png;base64,AA"><img src="//cdn.com/y.png"><img src="/missing.png">',
      { scale: 1 }
    )

    expect(html).toContain('src="data:image/png;base64,')
    expect(html).toContain('src="file://')
    expect(html).toContain('src="https://cdn.com/x.png"')
    expect(html).toContain('src="data:image/png;base64,AA"')
    expect(html).toContain('src="//cdn.com/y.png"')
    expect(html).toContain('src="/missing.png"')
  })

  it('改写 srcset 的每个候选 URL 并保留描述符', () => {
    const dir = tempDir()
    fs.writeFileSync(path.join(dir, 'a.png'), 'tiny', 'utf-8')

    const wrapper = new HtmlWrapper({ assetsDir: dir })
    const html = wrapper.wrapContent('<img srcset="/a.png 1x, /a.png 2x">', { scale: 1 })

    expect(html).not.toContain('/a.png')
    expect(html).toContain(' 1x, ')
    expect(html).toContain(' 2x')
  })

  it('未设置 assetsDir 时标记资源原样输出', () => {
    const html = new HtmlWrapper({}).wrapContent('<img src="/a.png">', { scale: 1 })
    expect(html).toContain('src="/a.png"')
  })

  it('ctx.scale 由外壳统一施加：非 1 时给 #container 加 zoom，模板不再自行缩放', () => {
    const wrapper = new HtmlWrapper({})

    // zoom 让布局盒随缩放变化，截图边界（#container）跟着放大，产物分辨率即 scale 倍。
    expect(wrapper.wrapContent('<p>hi</p>', { scale: 2 })).toContain('<div id="container" style="zoom: 2">')
    // scale 为 1（含缺省合并值）时输出与之前完全一致，不携带 style。
    expect(wrapper.wrapContent('<p>hi</p>', { scale: 1 })).toContain('<div id="container">')
    // 非法取值（NaN、0、负数）回退 1，不输出 zoom。
    expect(wrapper.wrapContent('<p>hi</p>', { scale: Number.NaN })).toContain('<div id="container">')
    expect(wrapper.wrapContent('<p>hi</p>', { scale: 0 })).toContain('<div id="container">')
    expect(wrapper.wrapContent('<p>hi</p>', { scale: -1 })).toContain('<div id="container">')
  })

  it('#container 带 isolation，补回旧引擎 transform 顺带的层叠上下文', () => {
    const html = new HtmlWrapper({}).wrapContent('<p>hi</p>', { scale: 1 })
    // 没有它，模板里 -z-10 的氛围层会逃逸到 <html> 层叠上下文，被不透明卡片背景整个盖住。
    expect(html).toContain('isolation: isolate;')
  })
})
