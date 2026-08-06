import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
      "export default { templateDir: 'templates', mockDataDir: 'mock-data', outDir: 'dist/template', cssEntry: 'templates/style.css' }\n",
      'utf-8'
    )
    const result = await buildTemplates({ root })

    expect(fs.existsSync(result.cssPath)).toBe(true)
    expect(fs.existsSync(path.join(root, 'templates/index.ts'))).toBe(false)
    expect(fs.readFileSync(path.join(root, '.ktr/template-registry.ts'), 'utf-8')).toContain("'hello/card':")
    const css = fs.readFileSync(result.cssPath, 'utf-8')
    expect(css).toContain('.flex')
    expect(css).not.toContain('.unused-class-name')
  })
})
