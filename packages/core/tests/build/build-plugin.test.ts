import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fg from 'fast-glob'
import { build, type Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'

import { ktrBuildPlugin } from '../../src/plugin'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureRoot = path.resolve(testDir, '../fixtures/mini-project')

describe('ktrBuildPlugin', () => {
  it('sync 注册表并把 CSS 编译到打包器自己的 outDir', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-plugin-build-'))
    fs.cpSync(fixtureRoot, root, { recursive: true })
    fs.unlinkSync(path.join(root, 'templates/index.ts'))
    // 故意不写 outDir：插件应当从 vite 的 build.outDir 自动跟随。
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css' } }\n",
      'utf-8'
    )
    fs.writeFileSync(path.join(root, 'entry.js'), 'export const answer = 42\n', 'utf-8')

    // 探针插件：捕获外层 bundle 的文件清单，验证 style.css 是作为 bundle asset 注入的（会进打包器输出表）。
    let bundleFiles: string[] = []
    const probe: Plugin = {
      name: 'ktr-test-probe',
      writeBundle(_options, bundle) {
        bundleFiles = Object.keys(bundle)
      }
    }
    // 插件路径下不应再单独打印 [ktr] 构建日志行。
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    let logged = ''

    try {
      await build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [ktrBuildPlugin({ root }), probe],
        build: {
          emptyOutDir: true,
          minify: false,
          outDir: path.join(root, 'lib'),
          rollupOptions: { input: path.join(root, 'entry.js') }
        }
      })
      logged = logSpy.mock.calls.flat().join(' ')
    } finally {
      logSpy.mockRestore()
    }

    // buildStart 阶段：注册表已刷新（替代 ktr sync）。
    expect(fs.readFileSync(path.join(root, '.ktr/template-registry.ts'), 'utf-8')).toContain("'hello/card':")
    // generateBundle 阶段：CSS 作为 asset 注入外层 bundle，由打包器连同 JS 产物一起写入 outDir。
    expect(bundleFiles).toContain('style.css')
    expect(logged).not.toContain('[ktr] 已构建')
    const css = fs.readFileSync(path.join(root, 'lib/style.css'), 'utf-8')
    expect(css).toContain('.flex')
    // JS 产物与 CSS 共存，互不覆盖（vite 把入口 chunk 放在 assets/ 下）。
    const assetsDir = path.join(root, 'lib', 'assets')
    expect(fs.readdirSync(assetsDir).some((file) => /\.m?js$/.test(file))).toBe(true)
    // CSS 临时入口不应留下 HTML、空 JS chunk 或额外目录层级。
    expect(fs.existsSync(path.join(root, 'lib', 'lib'))).toBe(false)
    expect(await fg('**/*.html', { cwd: path.join(root, 'lib') })).toEqual([])
    expect(await fg('**/.ktr-css-entry.*', { cwd: path.join(root, 'lib'), dot: true })).toEqual([])
  })

  it('css: false 时只做 sync，不编译样式', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-plugin-no-css-'))
    fs.cpSync(fixtureRoot, root, { recursive: true })
    fs.unlinkSync(path.join(root, 'templates/index.ts'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dir: { template: 'templates', cssEntry: 'templates/style.css' } }\n",
      'utf-8'
    )
    fs.writeFileSync(path.join(root, 'entry.js'), 'export const answer = 42\n', 'utf-8')

    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [ktrBuildPlugin({ css: false, root })],
      build: {
        emptyOutDir: true,
        minify: false,
        outDir: path.join(root, 'lib'),
        rollupOptions: { input: path.join(root, 'entry.js') }
      }
    })

    expect(fs.existsSync(path.join(root, '.ktr/template-registry.ts'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'lib/style.css'))).toBe(false)
  })
})
