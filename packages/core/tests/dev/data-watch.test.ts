import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

import { dataFilesChangedEvent, registerDataWatch } from '../../src/dev/data-watch'
import type { ResolvedKtrConfig } from '../../src/types'

const servers: ViteDevServer[] = []
const sockets: WebSocket[] = []
const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '../..')
const fixtureRoot = path.join(packageRoot, 'tests/fixtures/mini-project')

afterEach(async () => {
  for (const socket of sockets) {
    socket.close()
  }
  sockets.length = 0
  await Promise.all(servers.map((server) => server.close()))
  servers.length = 0
})

const configFor = (mockDataDir: string): ResolvedKtrConfig => ({
  root: packageRoot,
  templateDir: path.join(fixtureRoot, 'templates'),
  cacheDir: path.join(mockDataDir, '../.ktr'),
  mockDataDir,
  assetsDir: path.join(fixtureRoot, 'resources'),
  outDir: path.join(mockDataDir, '../dist/template'),
  cssEntry: path.join(fixtureRoot, 'templates/style.css'),
  extraStylePaths: [],
  dev: { port: 0, host: '127.0.0.1', open: false },
  html: { headExtra: '' }
})

/** 面板同步事件负载，与 useDataFileSync 收到的结构一致。 */
interface DataFilesChangedPayload {
  templatePath: string
  file: string
}

/** 以 vite-hmr 子协议连接 dev server，返回收到数据文件变更事件的数组句柄。 */
const subscribeDataEvents = async (baseUrl: string): Promise<DataFilesChangedPayload[]> => {
  const socket = new WebSocket(baseUrl.replace(/^http/, 'ws'), 'vite-hmr')
  sockets.push(socket)
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error('WebSocket connect failed')), { once: true })
  })

  const received: DataFilesChangedPayload[] = []
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as { type?: string; event?: string; data?: DataFilesChangedPayload }
    if (message.type === 'custom' && message.event === dataFilesChangedEvent && message.data) {
      received.push(message.data)
    }
  })
  return received
}

describe('data watch', () => {
  it('pushes data file changes to the panel over websocket', async () => {
    const mockDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-watch-'))
    const config = configFor(mockDataDir)
    const server = await createServer({ root: packageRoot, appType: 'custom', server: { host: '127.0.0.1', port: 0 } })
    servers.push(server)
    registerDataWatch(server, config)
    await server.listen()
    const base = server.resolvedUrls?.local[0] ?? ''

    const received = await subscribeDataEvents(base)

    // 新建模板数据文件，触发 watcher 的 add 事件。
    const dataDir = path.join(mockDataDir, 'hello/card', 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(path.join(dataDir, 'extra.json'), '{"a":1}', 'utf-8')

    // 去抖 100ms 加上文件系统事件延迟，轮询等待事件到达。
    await vi.waitFor(
      () => {
        expect(received).toContainEqual({ templatePath: 'hello/card', file: 'extra.json' })
      },
      { timeout: 5000, interval: 50 }
    )

    // 修改同一文件触发 change 事件，同样按模板路由通知。
    received.length = 0
    fs.writeFileSync(path.join(dataDir, 'extra.json'), '{"a":2}', 'utf-8')
    await vi.waitFor(
      () => {
        expect(received).toContainEqual({ templatePath: 'hello/card', file: 'extra.json' })
      },
      { timeout: 5000, interval: 50 }
    )

    // 删除文件触发 unlink 事件。
    received.length = 0
    fs.unlinkSync(path.join(dataDir, 'extra.json'))
    await vi.waitFor(
      () => {
        expect(received).toContainEqual({ templatePath: 'hello/card', file: 'extra.json' })
      },
      { timeout: 5000, interval: 50 }
    )

    // data/ 目录之外的 JSON（模板根目录、mock 根目录散置文件）不应通知面板。
    received.length = 0
    fs.writeFileSync(path.join(mockDataDir, 'hello/card', 'loose.json'), '{}', 'utf-8')
    fs.writeFileSync(path.join(mockDataDir, 'loose.json'), '{}', 'utf-8')
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(received).toEqual([])
  }, 20000)
})
