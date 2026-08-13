import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'
import { describe, expect, it } from 'vitest'

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

    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [ktrBuildPlugin({ root })],
      build: {
        emptyOutDir: true,
        minify: false,
        outDir: path.join(root, 'lib'),
        rollupOptions: { input: path.join(root, 'entry.js') }
      }
    })

    // buildStart 阶段：注册表已刷新（替代 ktr sync）。
    expect(fs.readFileSync(path.join(root, '.ktr/template-registry.ts'), 'utf-8')).toContain("'hello/card':")
    // closeBundle 阶段：CSS 编译到了 vite 自己的 outDir（替代 ktr build --outDir lib）。
    const css = fs.readFileSync(path.join(root, 'lib/style.css'), 'utf-8')
    expect(css).toContain('.flex')
    // JS 产物与 CSS 共存，互不覆盖（vite 把入口 chunk 放在 assets/ 下）。
    const assetsDir = path.join(root, 'lib', 'assets')
    expect(fs.readdirSync(assetsDir).some((file) => /\.m?js$/.test(file))).toBe(true)
    // 临时入口的 emit 残留也应被清理。
    expect(fs.existsSync(path.join(root, 'lib', 'lib'))).toBe(false)
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
