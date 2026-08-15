import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

import { registerMockApi } from '../../src/dev/mock-api'
import type { ResolvedKtrConfig } from '../../src/types'

const servers: ViteDevServer[] = []
const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '../..')
const fixtureRoot = path.join(packageRoot, 'tests/fixtures/mini-project')

afterEach(async () => {
  await Promise.all(servers.map((server) => server.close()))
  servers.length = 0
})

const configFor = (mockDataDir: string): ResolvedKtrConfig => ({
  root: packageRoot,
  templateDir: path.join(fixtureRoot, 'templates'),
  cacheDir: path.join(mockDataDir, '../.ktr'),
  mockDataDir,
  assetsDir: path.join(fixtureRoot, 'resources'),
  copyAssets: true,
  outDir: path.join(mockDataDir, '../dist/template'),
  cssEntry: path.join(fixtureRoot, 'templates/style.css'),
  extraStylePaths: [],
  dev: { port: 0, host: '127.0.0.1', open: false },
  html: { headExtra: '', assetsInlineLimit: 4096 },
  standalone: {
    outDir: path.join(mockDataDir, '../dist/ktr'),
    target: 'node18',
    format: 'esm',
    minify: false,
    sourcemap: false,
    assets: 'copy',
    external: [],
    singleChunk: true
  }
})

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text()
  expect(text, `HTTP ${response.status}`).not.toBe('')
  return JSON.parse(text) as T
}

describe('mock API', () => {
  it('lists, reads, saves and deletes data entries', async () => {
    const mockDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-api-'))
    // mock 与模板共置：fixture 的 TS mock 在 templates/hello/card/ 下，复制成同样的相对布局。
    fs.mkdirSync(path.join(mockDataDir, 'hello/card'), { recursive: true })
    fs.copyFileSync(path.join(fixtureRoot, 'templates', 'hello/card', 'mock.ts'), path.join(mockDataDir, 'hello/card', 'mock.ts'))
    const jsonDataDir = path.join(mockDataDir, 'hello/card', 'data')
    fs.mkdirSync(jsonDataDir, { recursive: true })
    fs.writeFileSync(path.join(jsonDataDir, 'default.json'), JSON.stringify({ title: 'Json default', items: [] }), 'utf-8')
    fs.writeFileSync(path.join(jsonDataDir, 'valid.json'), JSON.stringify({ title: 'Json wins', items: [] }), 'utf-8')
    const config = configFor(mockDataDir)
    const server = await createServer({ root: packageRoot, appType: 'custom', server: { host: '127.0.0.1', port: 0 } })
    servers.push(server)
    registerMockApi(server, config)
    await server.listen()
    const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? ''

    const listTs = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard`).then((res) =>
      readJson<{ entries: Array<{ name: string; readonly: boolean }> }>(res)
    )
    expect(listTs.entries[0]).toMatchObject({ name: 'default.json', readonly: false })
    expect(listTs.entries.some((entry) => entry.name === 'valid' && entry.readonly)).toBe(true)

    const readWithoutExtension = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=default`).then((res) =>
      readJson<{ data: { title: string } }>(res)
    )
    expect(readWithoutExtension.data.title).toBe('Json default')

    const jsonOverTs = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=valid`).then((res) =>
      readJson<{ data: { title: string }; readonly: boolean }>(res)
    )
    expect(jsonOverTs).toMatchObject({ readonly: false, data: { title: 'Json wins' } })

    const tsSave = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=typedOnly`, { method: 'PUT', body: '{}' })
    expect(tsSave.status).toBe(409)

    const save = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=default.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Saved', items: [] })
    })
    expect(save.ok).toBe(true)

    const read = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=default.json`).then((res) =>
      readJson<{ data: { title: string } }>(res)
    )
    expect(read.data.title).toBe('Saved')

    const traversal = await fetch(`${base}/__ktr/api/data?path=..%2F..%2Fetc`)
    expect(traversal.status).toBe(400)

    const deleted = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=default.json`, { method: 'DELETE' })
    expect(deleted.ok).toBe(true)
  })

  it('loads colocated JSON and TS mocks from the template directory', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-api-colocated-'))
    const templateDir = path.join(root, 'template')
    fs.cpSync(path.join(fixtureRoot, 'templates'), templateDir, { recursive: true })
    fs.mkdirSync(path.join(templateDir, 'hello/card'), { recursive: true })
    fs.mkdirSync(path.join(templateDir, 'hello/card', 'data'), { recursive: true })
    fs.writeFileSync(
      path.join(templateDir, 'hello/card/data/default.json'),
      JSON.stringify({ title: 'Colocated JSON', items: [] }),
      'utf-8'
    )
    fs.writeFileSync(
      path.join(templateDir, 'hello/card/mock.ts'),
      "import type { HelloCardData } from './index'\nexport const typed = { title: 'Colocated TS', items: [] } satisfies HelloCardData\n",
      'utf-8'
    )
    const config: ResolvedKtrConfig = {
      ...configFor(templateDir),
      root,
      templateDir,
      mockDataDir: templateDir,
      assetsDir: path.join(root, 'resources'),
      outDir: path.join(root, 'dist/template'),
      cssEntry: path.join(templateDir, 'style.css')
    }
    const server = await createServer({ root: packageRoot, appType: 'custom', server: { host: '127.0.0.1', port: 0 } })
    servers.push(server)
    registerMockApi(server, config)
    await server.listen()
    const base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? ''

    const list = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard`).then((res) =>
      readJson<{ entries: Array<{ name: string; source: 'json' | 'ts'; readonly: boolean }> }>(res)
    )
    expect(list.entries).toEqual([
      { name: 'default.json', source: 'json', readonly: false },
      { name: 'typed', source: 'ts', readonly: true }
    ])

    const read = await fetch(`${base}/__ktr/api/data?path=hello%2Fcard&name=default`).then((res) =>
      readJson<{ data: { title: string }; source: string }>(res)
    )
    expect(read).toMatchObject({ source: 'json', data: { title: 'Colocated JSON' } })
  })
})
