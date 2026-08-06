import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadMockRegistry, loadTemplateRegistry } from '../../src/runtime'

// 手写一份最小的约定注册表，避免测试依赖完整的 ktr sync 流程。
const writeRegistries = (cacheDir: string): void => {
  fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(
    path.join(cacheDir, 'template-registry.ts'),
    "export const templates = {\n  'hello/card': { name: '测试卡片' }\n} as const\n",
    'utf-8'
  )
  fs.writeFileSync(
    path.join(cacheDir, 'mock-registry.ts'),
    "export const mockDataFiles = {\n  'hello/card': ['default.json']\n} as const\n",
    'utf-8'
  )
}

describe('registry loader', () => {
  it('loads template registry from the given cacheDir', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-registry-'))
    // 故意使用非默认的相对缓存目录，验证 cacheDir 选项确实生效。
    writeRegistries(path.join(root, 'cache'))

    const registry = await loadTemplateRegistry({ root, cacheDir: 'cache' })
    expect(registry).toEqual({ 'hello/card': { name: '测试卡片' } })
  })

  it('loads mock registry from the given cacheDir', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-registry-'))
    writeRegistries(path.join(root, '.ktr'))

    const registry = await loadMockRegistry({ root, cacheDir: '.ktr' })
    expect(registry.mockDataFiles).toEqual({ 'hello/card': ['default.json'] })
  })

  it('throws a readable error when the registry file is missing', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-registry-'))

    await expect(loadTemplateRegistry({ root })).rejects.toThrow('ktr sync')
    await expect(loadMockRegistry({ root })).rejects.toThrow('ktr sync')
  })

  it('prefers the .ktr source when present and falls back to the bundled lib registry', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-registry-'))
    writeRegistries(path.join(root, '.ktr'))
    // 模拟生产构建产物：打包进 lib/ 的注册表（内容可区分）。
    fs.mkdirSync(path.join(root, 'lib'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'lib', 'template-registry.js'),
      "export const templates = { 'bundled/x': { name: '打包产物' } }\n",
      'utf-8'
    )

    // 即使 lib 更新，开发态也必须用 .ktr 源文件（否则包内 React 与外部渲染器双副本）。
    const bundledTime = new Date('2030-01-02')
    fs.utimesSync(path.join(root, 'lib', 'template-registry.js'), bundledTime, bundledTime)
    await expect(loadTemplateRegistry({ root })).resolves.toEqual({ 'hello/card': { name: '测试卡片' } })

    // .ktr 缺失时（生产环境）回退到 lib 打包产物。
    fs.rmSync(path.join(root, '.ktr', 'template-registry.ts'))
    await expect(loadTemplateRegistry({ root })).resolves.toEqual({ 'bundled/x': { name: '打包产物' } })
  })

  it('discovers the bundled registry from package.json main and explicit bundledDir', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-registry-'))
    // 下游自定义 outDir 为 build-output，main 指向其中的 index.js。
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'custom-out', main: 'build-output/index.js' }), 'utf-8')
    fs.mkdirSync(path.join(root, 'build-output'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'build-output', 'template-registry.js'),
      "export const templates = { 'via/main': { name: 'main 发现' } }\n",
      'utf-8'
    )
    // 没有 .ktr：应通过 main 字段发现 build-output 下的注册表。
    await expect(loadTemplateRegistry({ root })).resolves.toEqual({ 'via/main': { name: 'main 发现' } })

    // 显式 bundledDir 覆盖一切发现逻辑。
    fs.mkdirSync(path.join(root, 'anywhere'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'anywhere', 'template-registry.js'),
      "export const templates = { 'via/option': { name: '显式指定' } }\n",
      'utf-8'
    )
    await expect(loadTemplateRegistry({ root, bundledDir: 'anywhere' })).resolves.toEqual({ 'via/option': { name: '显式指定' } })
  })

  it('loads registries that import real JSX components and renders them', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-registry-jsx-'))
    // 注册表引用的组件含 JSX，验证 jiti 的 JSX 转换在真实加载链上生效。
    const componentDir = path.join(root, 'template', 'hello', 'card')
    fs.mkdirSync(componentDir, { recursive: true })
    fs.writeFileSync(
      path.join(componentDir, 'index.tsx'),
      `const Card = ({ data }) => <div id="container"><h1>{data.title}</h1></div>
export default { name: '卡片', component: Card }
`,
      'utf-8'
    )
    fs.mkdirSync(path.join(root, '.ktr'), { recursive: true })
    fs.writeFileSync(
      path.join(root, '.ktr', 'template-registry.ts'),
      `import template_hello_card from '../template/hello/card/index'
export const templates = { 'hello/card': template_hello_card }
`,
      'utf-8'
    )

    const registry = await loadTemplateRegistry({ root })
    expect(registry['hello/card']?.name).toBe('卡片')

    // 直接经 createRenderer 走一遍 SSR，证明 JSX 转换产物可执行。
    const { createRenderer } = await import('../../src/runtime')
    const render = createRenderer(registry, { cssPath: path.join(root, 'style.css'), outputDir: path.join(root, 'html') })
    fs.writeFileSync(path.join(root, 'style.css'), '', 'utf-8')
    const result = await render('hello/card', { title: 'JSX 正常', items: [] })
    expect(result.success).toBe(true)
    expect(fs.readFileSync(result.htmlPath, 'utf-8')).toContain('JSX 正常')
  })
})
