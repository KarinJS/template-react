import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../../src/config'

describe('resolveConfig', () => {
  it('returns defaults when config file is absent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    const config = await resolveConfig({ cwd: root })
    expect(config.templateDir).toBe(path.join(root, 'template'))
    expect(config.cacheDir).toBe(path.join(root, '.ktr'))
    expect(config.mockDataDir).toBe(path.join(root, 'template'))
    expect(config.dev.port).toBe(5180)
  })

  it('merges user config with defaults', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dev: { port: 6000 }, outDir: 'out', vite: { define: { __KTR_TEST__: 'true' } } }\n",
      'utf-8'
    )
    const config = await resolveConfig({ cwd: root })
    expect(config.outDir).toBe(path.join(root, 'out'))
    expect(config.dev.port).toBe(6000)
    expect(config.dev.host).toBe('localhost')
    expect(config.vite).toEqual({ define: { __KTR_TEST__: 'true' } })
  })

  it('resolves templateDir and mockDataDir from user config', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { templateDir: 'templates', mockDataDir: 'mock-data' }\n",
      'utf-8'
    )
    const config = await resolveConfig({ cwd: root })
    expect(config.templateDir).toBe(path.join(root, 'templates'))
    expect(config.mockDataDir).toBe(path.join(root, 'mock-data'))
  })

  it('throws readable config path errors', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(path.join(root, 'karin.template.ts'), 'export default {', 'utf-8')
    await expect(resolveConfig({ cwd: root })).rejects.toThrow('karin.template.ts')
  })
})
