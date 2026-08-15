import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

import { buildTemplates } from '../../src/build'

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
})
