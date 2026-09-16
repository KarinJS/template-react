import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../../src/config'

const testDir = path.dirname(fileURLToPath(import.meta.url))

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
    expect(config.standalone).toEqual({
      outDir: path.join(root, 'dist', 'ktr'),
      target: 'node18',
      format: 'esm',
      minify: false,
      sourcemap: false,
      assets: 'copy',
      external: [],
      singleChunk: true
    })
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
      "export default { dev: { port: 6000 }, dir: { template: 'views' }, vite: { define: { __KTR_TEST__: 'true' } } }\n",
      'utf-8'
    )
    const config = await resolveConfig({ cwd: root })
    expect(config.templateDir).toBe(path.join(root, 'views'))
    expect(config.dev.port).toBe(6000)
    expect(config.dev.host).toBe('localhost')
    expect(config.vite).toEqual({ define: { __KTR_TEST__: 'true' } })
  })

  it('样式路径可以直接写依赖包里的文件（pnpm 的 .pnpm 真实路径也能命中）', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    // 伪造 pnpm 布局：真实文件在 .pnpm 下，根 node_modules 里只有软链。
    const packageDir = path.join(root, 'node_modules/.pnpm/dep-font@1.0.0/node_modules/dep-font')
    fs.mkdirSync(path.join(packageDir, 'fonts'), { recursive: true })
    fs.writeFileSync(path.join(packageDir, 'index.css'), '.dep{}', 'utf-8')
    fs.writeFileSync(path.join(packageDir, 'fonts/big.woff2'), 'font', 'utf-8')
    // 有 exports 映射、且没为字体声明子路径：走文件系统兜底，而不是被 exports 拦下。
    fs.writeFileSync(
      path.join(packageDir, 'package.json'),
      JSON.stringify({ name: 'dep-font', version: '1.0.0', exports: { '.': './index.css' } }),
      'utf-8'
    )
    fs.symlinkSync(packageDir, path.join(root, 'node_modules/dep-font'), 'junction')

    const config = await resolveConfig({
      cwd: root,
      overrides: {
        dir: { cssEntry: 'dep-font/index.css' },
        extraStylePaths: ['dep-font/fonts/big.woff2', 'local/print.css']
      }
    })

    // 只有真实存在的包内文件才解析过去；解析不到的保持项目根相对路径，错误提示才指向用户写的值。
    // 路径本身可能带 node_modules 软链（.pnpm 布局就是这样），比较时按真实文件比对。
    expect(fs.realpathSync(config.cssEntry!)).toBe(fs.realpathSync(path.join(packageDir, 'index.css')))
    expect(fs.realpathSync(config.extraStylePaths[0]!)).toBe(fs.realpathSync(path.join(packageDir, 'fonts/big.woff2')))
    expect(config.extraStylePaths[1]).toBe(path.join(root, 'local', 'print.css'))
  })

  it('mockDataDir 固定等于 dir.template，不单独可配', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(path.join(root, 'karin.template.ts'), "export default { dir: { template: 'templates' } }\n", 'utf-8')
    const config = await resolveConfig({ cwd: root })
    expect(config.templateDir).toBe(path.join(root, 'templates'))
    expect(config.mockDataDir).toBe(path.join(root, 'templates'))
  })

  it('解析 standalone 输出目录和构建选项', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    const config = await resolveConfig({
      cwd: root,
      overrides: {
        standalone: {
          outDir: 'build/templates',
          target: 'node20',
          minify: true,
          sourcemap: true,
          external: ['sharp'],
          singleChunk: false
        }
      }
    })

    expect(config.standalone).toMatchObject({
      outDir: path.join(root, 'build', 'templates'),
      target: 'node20',
      minify: true,
      sourcemap: true,
      external: ['sharp'],
      singleChunk: false
    })
  })

  it('throws readable config path errors', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    fs.writeFileSync(path.join(root, 'karin.template.ts'), 'export default {', 'utf-8')
    await expect(resolveConfig({ cwd: root })).rejects.toThrow('karin.template.ts')
  })

  it('skipUserConfig 时忽略配置文件直接用默认值（生产 bundle 不触发 TS 加载）', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-'))
    // 配置文件存在且含非法语法：被跳过时连解析都不应该发生。
    fs.writeFileSync(path.join(root, 'karin.template.ts'), 'export default {', 'utf-8')

    const config = await resolveConfig({ cwd: root, skipUserConfig: true })
    expect(config.templateDir).toBe(path.join(root, 'ktr', 'template'))
  })

  it('无 package.json 的项目（tsx 转译为 CJS）也能正确加载配置', () => {
    // vitest 的模块加载器会抹平 ESM-CJS interop，必须起真实 node 进程才能复现双层 default。
    // dist 由 pnpm test 前置的 build:runtime 保证存在。
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-config-cjs-'))
    fs.writeFileSync(path.join(root, 'karin.template.ts'), "export default { dir: { template: 'views' } }\n", 'utf-8')

    const entry = pathToFileURL(path.resolve(testDir, '../../dist/index.mjs')).href
    const script = [
      `const { resolveConfig } = await import(${JSON.stringify(entry)})`,
      `const config = await resolveConfig({ cwd: ${JSON.stringify(root)} })`,
      'console.log(config.templateDir)'
    ].join(';')
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf-8' })

    expect(output.trim()).toBe(path.join(root, 'views'))
  })
})
