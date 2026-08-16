import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import React from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { createRenderer } from '../../src/runtime'
import { templates } from '../fixtures/mini-project/templates'

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-renderer-'))

describe('createRenderer', () => {
  it('renders a registered template into complete HTML', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '.flex{display:flex}', 'utf-8')
    const render = createRenderer(templates, { cssPath, outputDir: dir, captureDir: path.join(dir, 'mock-data') })

    const result = await render('hello/card', { title: 'Hello', items: [] }, { theme: { mode: 'dark' }, scale: 1.25 })

    expect(result.success).toBe(true)
    expect(fs.existsSync(result.htmlPath)).toBe(true)
    const html = fs.readFileSync(result.htmlPath, 'utf-8')
    expect(html).toContain('Hello')
    expect(html).toContain('<style>.flex{display:flex}</style>')
    expect(html).toContain('<body class="dark"')
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('data-scale="1.25"')
  })

  it('returns failure for validation errors and missing templates', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const render = createRenderer(templates, { cssPath, outputDir: dir })

    const invalid = await render('hello/card', { title: 'Hello' } as never)
    expect(invalid.success).toBe(false)
    expect(invalid.error).toContain('hello/card')

    const missing = await render('missing/template' as never, {} as never)
    expect(missing.success).toBe(false)
  })

  it('runs afterRender plugins and catches component errors', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const render = createRenderer(templates, {
      cssPath,
      outputDir: dir,
      plugins: [
        {
          name: 'append',
          afterRender: ({ html }) => `${html}<footer>plugin</footer>`
        }
      ]
    })

    const ok = await render('hello/card', { title: 'Hello', items: [] })
    expect(fs.readFileSync(ok.htmlPath, 'utf-8')).toContain('plugin')

    const broken = await render('hello/broken', { message: 'x' })
    expect(broken.success).toBe(false)
    expect(broken.error).toContain('broken component')
  })

  it('overwrites one fixed html file per template by default', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const render = createRenderer(templates, { cssPath, outputDir: dir })

    const first = await render('hello/card', { title: 'First', items: [] })
    const second = await render('hello/card', { title: 'Second', items: [] })

    // 默认 fixed：两次渲染同一路由得到同一个固定文件，outputDir 内 html 数量不增加。
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(first.htmlPath).toBe(second.htmlPath)
    expect(path.basename(first.htmlPath)).toBe('hello_card.html')
    const htmlFiles = fs.readdirSync(dir).filter((file) => file.endsWith('.html'))
    expect(htmlFiles).toEqual(['hello_card.html'])
    // 第二次渲染覆盖写入，内容以最新数据为准。
    expect(fs.readFileSync(second.htmlPath, 'utf-8')).toContain('Second')
  })

  it('keeps timestamped file names when htmlFileName is timestamp', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const render = createRenderer(templates, { cssPath, outputDir: dir, htmlFileName: 'timestamp' })

    const first = await render('hello/card', { title: 'First', items: [] })
    // Date.now() 精度是毫秒，稍微等待避免两次渲染落在同一毫秒导致文件名相同。
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = await render('hello/card', { title: 'Second', items: [] })

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(first.htmlPath).not.toBe(second.htmlPath)
    expect(path.basename(first.htmlPath)).toMatch(/^hello_card_\d+\.html$/)
    const htmlFiles = fs.readdirSync(dir).filter((file) => file.endsWith('.html'))
    expect(htmlFiles).toHaveLength(2)
  })

  it('uses the custom htmlFileName function result as file stem', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const render = createRenderer(templates, {
      cssPath,
      outputDir: dir,
      htmlFileName: (templatePath) => `custom-${templatePath.replace('/', '-')}`
    })

    const result = await render('hello/card', { title: 'Hello', items: [] })

    expect(result.success).toBe(true)
    expect(path.basename(result.htmlPath)).toBe('custom-hello-card.html')
    expect(fs.existsSync(result.htmlPath)).toBe(true)
  })

  it('assetsDir 透传到 HTML 包装器，标记资源在渲染时被改写', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const assetsDir = path.join(dir, 'public')
    fs.mkdirSync(path.join(assetsDir, 'image'), { recursive: true })
    fs.writeFileSync(path.join(assetsDir, 'image', 'logo.png'), 'png-bytes', 'utf-8')

    const localTemplates = {
      'x/img': { component: () => React.createElement('img', { src: '/image/logo.png', alt: '' }) }
    }
    const render = createRenderer(localTemplates, { cssPath, outputDir: dir, assetsDir })
    const result = await render('x/img', {})

    expect(result.success).toBe(true)
    const html = fs.readFileSync(result.htmlPath, 'utf-8')
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).not.toContain('src="/image/logo.png"')
  })

  it('优先使用注入的 ssrRuntime（约定装配层按下游包根解析后传入）', async () => {
    const dir = tempDir()
    const cssPath = path.join(dir, 'style.css')
    fs.writeFileSync(cssPath, '', 'utf-8')
    const calls: string[] = []
    const render = createRenderer(templates, {
      cssPath,
      outputDir: dir,
      ssrRuntime: {
        createElement: ((...args: unknown[]) => {
          calls.push('createElement')
          return (React.createElement as (...a: unknown[]) => unknown)(...args)
        }) as unknown as typeof React.createElement,
        renderToReadableStream: (element: React.ReactNode) => {
          calls.push('renderToReadableStream')
          return renderToReadableStream(element as React.ReactElement)
        }
      }
    })

    const result = await render('hello/card', { title: 'Hello', items: [] })

    expect(result.success).toBe(true)
    expect(calls).toEqual(['createElement', 'renderToReadableStream'])
  })
})
