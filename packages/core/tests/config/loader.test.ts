import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../../src/config'

describe('resolveConfig', () => {
  it('returns defaults when config file is absent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    const config = await resolveConfig({ cwd: root })
    expect(config.templateDir).toBe(path.join(root, 'ktr', 'template'))
    expect(config.cacheDir).toBe(path.join(root, '.ktr'))
    expect(config.mockDataDir).toBe(path.join(root, 'ktr', 'template'))
    // 静态资源默认与模板目录同级：ktr/template -> ktr/public。
    expect(config.assetsDir).toBe(path.join(root, 'ktr', 'public'))
    expect(config.outDir).toBe(path.join(root, 'dist', 'template'))
    expect(config.dev.port).toBe(5180)
  })

  it('assetsDir 跟随自定义 dir.template，也可单独覆盖', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))

    // 单层模板目录时，静态资源落到同级的 public。
    const followed = await resolveConfig({ cwd: root, overrides: { dir: { template: 'templates' } } })
    expect(followed.assetsDir).toBe(path.join(root, 'public'))

    const overridden = await resolveConfig({ cwd: root, overrides: { dir: { assets: 'static' } } })
    expect(overridden.assetsDir).toBe(path.join(root, 'static'))
  })

  it('merges user config with defaults', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dev: { port: 6000 }, dir: { out: 'out' }, vite: { define: { __KTR_TEST__: 'true' } } }\n",
      'utf-8'
    )
    const config = await resolveConfig({ cwd: root })
    expect(config.outDir).toBe(path.join(root, 'out'))
    expect(config.dev.port).toBe(6000)
    expect(config.dev.host).toBe('localhost')
    expect(config.vite).toEqual({ define: { __KTR_TEST__: 'true' } })
  })

  it('resolves dir.template and dir.mockData from user config', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(
      path.join(root, 'karin.template.ts'),
      "export default { dir: { template: 'templates', mockData: 'mock-data' } }\n",
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
