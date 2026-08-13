import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { createTemplateRenderer, capturedDataFileName, type TemplateRenderFn } from '../../src/runtime'

// 本测试聚焦运行时的约定装配，路由/data 类型收窄由 tests/types 的类型测试负责；
// 这里放宽签名，避免不同测试文件对 ProjectRegistry 的模块增强互相污染。
type LooseRenderFn = (templatePath: string, data: unknown) => ReturnType<TemplateRenderFn>
const createLooseRenderer = (callerUrl: string, options?: Parameters<typeof createTemplateRenderer>[1]): LooseRenderFn =>
  createTemplateRenderer(callerUrl, options) as LooseRenderFn

/** 在临时目录搭一个最小插件包：package.json + 调用方文件 + .ktr 注册表 + 模板目录。 */
const setupPlugin = (): { root: string; callerUrl: string } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-project-renderer-'))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-plugin' }), 'utf-8')
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  const caller = path.join(root, 'src', 'render.ts')
  fs.writeFileSync(caller, '', 'utf-8')

  // 注册表保持零外部依赖（内联组件），jiti 可以脱离 node_modules 直接加载。
  fs.mkdirSync(path.join(root, '.ktr'), { recursive: true })
  fs.writeFileSync(
    path.join(root, '.ktr', 'template-registry.ts'),
    `export const templates = {
  'x/y': { name: '示例', component: () => null }
} as const
`,
    'utf-8'
  )
  fs.mkdirSync(path.join(root, 'ktr', 'template', 'x'), { recursive: true })
  return { root, callerUrl: pathToFileURL(caller).href }
}

describe('createTemplateRenderer', () => {
  it('assembles config, registry and capture by convention, html goes to <outDir>/html', async () => {
    const { root, callerUrl } = setupPlugin()
    const renderTemplate = createLooseRenderer(callerUrl)

    const result = await renderTemplate('x/y', {})

    // 默认输出目录是构建产物下的 html 子目录，文件名为固定命名。
    expect(result.success).toBe(true)
    expect(result.htmlPath).toBe(path.join(root, 'dist', 'template', 'html', 'x_y.html'))
    expect(fs.existsSync(result.htmlPath)).toBe(true)

    // 真实数据按模板路由捕获到插件 ktr/template/ 目录的 captured.json。
    const captured = path.join(root, 'ktr', 'template', 'x', 'y', 'data', capturedDataFileName)
    expect(fs.existsSync(captured)).toBe(true)
  })

  it('lets renderer options override the conventional outputDir', async () => {
    const { root, callerUrl } = setupPlugin()
    const outputDir = path.join(root, 'custom-html')
    const renderTemplate = createLooseRenderer(callerUrl, { renderer: { outputDir } })

    const result = await renderTemplate('x/y', {})
    expect(result.htmlPath).toBe(path.join(outputDir, 'x_y.html'))
    expect(fs.existsSync(result.htmlPath)).toBe(true)
  })

  it('reuses one renderer across calls and reports render failure without throwing', async () => {
    const { root, callerUrl } = setupPlugin()
    // 追加一个 validate 恒失败的模板，验证失败路径以 success:false 返回（错误处理是调用方的事）。
    fs.writeFileSync(
      path.join(root, '.ktr', 'template-registry.ts'),
      `export const templates = {
  'x/y': { component: () => null },
  'x/bad': { component: () => null, validate: () => false }
} as const
`,
      'utf-8'
    )
    const renderTemplate = createLooseRenderer(callerUrl)

    const first = await renderTemplate('x/y', {})
    const second = await renderTemplate('x/y', {})
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    // 固定命名下两次渲染复用同一个 html 文件，不堆积。
    expect(second.htmlPath).toBe(first.htmlPath)

    const failed = await renderTemplate('x/bad', {})
    expect(failed.success).toBe(false)
    expect(failed.error).toContain('x/bad')
  })
})
