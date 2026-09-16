import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fg from 'fast-glob'
import { describe, expect, it, vi } from 'vitest'

import { buildTemplates } from '../../src/build'
import { HtmlWrapper } from '../../src/runtime'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureRoot = path.resolve(testDir, '../fixtures/mini-project')

describe('buildTemplates', () => {
  it('builds Tailwind CSS for a mini project', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-build-'))
    fs.cpSync(fixtureRoot, root, { recursive: true })
    fs.unlinkSync(path.join(root, 'templates/index.ts'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css' } }\n",
      'utf-8'
    )
    const legacyEntry = path.join(root, 'dist/template/dist/template/.ktr-css-entry.html')
    fs.mkdirSync(path.dirname(legacyEntry), { recursive: true })
    fs.writeFileSync(legacyEntry, '<link rel="stylesheet">', 'utf-8')
    const result = await buildTemplates({ root })

    expect(fs.existsSync(result.cssPath)).toBe(true)
    expect(fs.existsSync(path.join(root, 'templates/index.ts'))).toBe(false)
    expect(fs.readFileSync(path.join(root, '.ktr/template-registry.ts'), 'utf-8')).toContain("'hello/card':")
    const css = fs.readFileSync(result.cssPath, 'utf-8')
    expect(css).toContain('.flex')
    expect(css).not.toContain('.unused-class-name')
    expect(await fg('**/*.html', { cwd: path.join(root, 'dist/template') })).toEqual([])
    expect(await fg('**/.ktr-css-entry.*', { cwd: path.join(root, 'dist/template'), dot: true })).toEqual([])
    expect(fs.existsSync(path.join(root, 'dist/template/dist'))).toBe(false)
  })

  it('dir.copyAssets 控制静态资源是否复制到产物 assets/', async () => {
    const makeProject = () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-assets-'))
      fs.cpSync(fixtureRoot, root, { recursive: true })
      fs.unlinkSync(path.join(root, 'templates/index.ts'))
      // 静态资源放在默认约定位置（模板目录同级的 public）。
      fs.mkdirSync(path.join(root, 'public/image'), { recursive: true })
      fs.writeFileSync(path.join(root, 'public/image/logo.png'), 'PNG', 'utf-8')
      return root
    }

    // 默认 true：复制到产物 assets/。
    const copied = makeProject()
    fs.writeFileSync(
      path.join(copied, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css' } }\n",
      'utf-8'
    )
    await buildTemplates({ root: copied })
    expect(fs.existsSync(path.join(copied, 'dist/template/assets/image/logo.png'))).toBe(true)

    // false：资源目录已随包发布在固定位置时不重复打包。
    const skipped = makeProject()
    fs.writeFileSync(
      path.join(skipped, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css', copyAssets: false } }\n",
      'utf-8'
    )
    await buildTemplates({ root: skipped })
    expect(fs.existsSync(path.join(skipped, 'dist/template/assets'))).toBe(false)
  })

  it('依赖包里的 CSS 与字体：pnpm 的 .pnpm 布局能解析，大字体不进 HTML 的 base64', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-dep-css-'))
    fs.cpSync(fixtureRoot, root, { recursive: true })
    fs.unlinkSync(path.join(root, 'templates/index.ts'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css' } }\n",
      'utf-8'
    )

    // 伪造 pnpm 布局：根 node_modules 下只有软链，真实文件在 .pnpm/<包名>@<版本>/node_modules/<包名>。
    const packageDir = path.join(root, 'node_modules/.pnpm/dep-font@1.0.0/node_modules/dep-font')
    fs.mkdirSync(path.join(packageDir, 'fonts'), { recursive: true })
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: 'dep-font', version: '1.0.0' }), 'utf-8')
    fs.writeFileSync(
      path.join(packageDir, 'index.css'),
      "@font-face{font-family:DepSmall;src:url('./fonts/small.woff2') format('woff2')}\n" +
        "@font-face{font-family:DepBig;src:url('./fonts/big.woff2') format('woff2')}\n",
      'utf-8'
    )
    fs.writeFileSync(path.join(packageDir, 'fonts/small.woff2'), 'tiny-font', 'utf-8')
    fs.writeFileSync(path.join(packageDir, 'fonts/big.woff2'), 'x'.repeat(6000), 'utf-8')
    fs.symlinkSync(packageDir, path.join(root, 'node_modules/dep-font'), 'junction')

    fs.writeFileSync(
      path.join(root, 'templates/style.css'),
      "@import 'tailwindcss';\n@source './**/*.{ts,tsx}';\n@import 'dep-font/index.css';\n",
      'utf-8'
    )

    const result = await buildTemplates({ root })
    const css = fs.readFileSync(result.cssPath, 'utf-8')
    // 依赖包 CSS 被内联进来：小字体由构建期内联，大字体落到产物 assets/ 并按 /assets/ 引用。
    expect(css).toContain('@font-face')
    expect(css).toContain('data:font/woff2;base64,')
    expect(css).toContain('/assets/')
    expect(await fg('assets/*.woff2', { cwd: path.join(root, 'dist/template') })).toHaveLength(1)

    // 渲染期把 /assets/* 解析到产物里的真实文件：截图页是 file://，留着根路径就是静默回退到系统字体。
    const html = new HtmlWrapper({ cssPath: result.cssPath }).wrapContent('<p>hi</p>', { scale: 1 })
    expect(html).toContain('data:font/woff2;base64,')
    expect(html).toMatch(/url\(["']?file:\/\/\/[^"']*big-[^"']*\.woff2["']?\)/)
    expect(html).not.toContain('url("/assets/')
  })

  it('write: false 时不落盘、不打印日志，产物以内存形式返回', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-build-memory-'))
    fs.cpSync(fixtureRoot, root, { recursive: true })
    fs.unlinkSync(path.join(root, 'templates/index.ts'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css' } }\n",
      'utf-8'
    )

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    let result: Awaited<ReturnType<typeof buildTemplates>>
    let logged = ''
    try {
      result = await buildTemplates({ root, write: false })
      logged = logSpy.mock.calls.flat().join(' ')
    } finally {
      logSpy.mockRestore()
    }

    // CSS 不落盘，产物通过 outputs 返回给调用方（打包器插件 emit 进外层 bundle）。
    expect(fs.existsSync(result!.cssPath)).toBe(false)
    expect(logged).not.toContain('[ktr] 已构建')
    const css = result!.outputs.find((output) => output.fileName === 'style.css')
    expect(css).toBeDefined()
    expect(String(css!.source)).toContain('.flex')
    expect(result!.cssSize).toBeGreaterThan(0)
    // 内存模式下同样不留临时入口文件。
    expect(await fg('**/.ktr-css-entry.*', { cwd: path.join(root, 'dist/template'), dot: true })).toEqual([])
  })
})
