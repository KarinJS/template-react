import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

import { dataFilesChangedEvent, dataStreamPath, handleDataStream, registerDataWatch } from '../../src/dev/data-watch'
import type { ResolvedKtrConfig } from '../../src/types'

const servers: ViteDevServer[] = []
const streams: AbortController[] = []
const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '../..')
const fixtureRoot = path.join(packageRoot, 'tests/fixtures/mini-project')

afterEach(async () => {
  for (const controller of streams) {
    controller.abort()
  }
  streams.length = 0
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

/** 面板同步事件负载，与 useDataFileSync 收到的结构一致。 */
interface DataFilesChangedPayload {
  templatePath: string
  file: string
}

/**
 * 订阅 SSE 事件流，返回收到数据文件变更事件的数组句柄。
 * 不用 Vite 的 HMR WebSocket：Vite 8 对浏览器同源 WS 连接强制校验 token，
 * 面板拿不到 token，所以推送通道已改成 SSE（见 data-watch.ts 的 handleDataStream）。
 * @param baseUrl dev server 基地址。
 * @returns 持续追加事件负载的数组。
 */
const subscribeDataEvents = async (baseUrl: string): Promise<DataFilesChangedPayload[]> => {
  const controller = new AbortController()
  streams.push(controller)

  const response = await fetch(new URL(dataStreamPath, baseUrl), {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal
  })
  if (!response.body) {
    throw new Error('SSE 响应没有 body')
  }

  const received: DataFilesChangedPayload[] = []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  // 后台持续读取事件流：一帧以空行结束，按 event/data 两行解析。
  void (async () => {
    let buffer = ''
    try {
      for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- Reading a stream is inherently sequential.
        const { done, value } = await reader.read()
        if (done) {
          return
        }
        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const eventLine = frame.split('\n').find((line) => line.startsWith('event: '))
          const dataLine = frame.split('\n').find((line) => line.startsWith('data: '))
          if (eventLine?.slice(7) === dataFilesChangedEvent && dataLine) {
            received.push(JSON.parse(dataLine.slice(6)) as DataFilesChangedPayload)
          }
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch {
      // abort 时 reader.read() 会抛，属于正常收尾。
    }
  })()

  return received
}

describe('data watch', () => {
  it('pushes data file changes to the panel over websocket', async () => {
    const mockDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-watch-'))
    const config = configFor(mockDataDir)
    const server = await createServer({ root: packageRoot, appType: 'custom', server: { host: '127.0.0.1', port: 0 } })
    servers.push(server)
    // 生产路径由 mock-api 中间件把 /__ktr/api/stream 转给 handleDataStream，
    // 这里只起了裸 dev server，所以自己挂一条同路径的中间件。
    server.middlewares.use(dataStreamPath, (req, res) => {
      handleDataStream(req, res)
    })
    registerDataWatch(server, config)
    await server.listen()
    const base = server.resolvedUrls?.local[0] ?? ''

    const received = await subscribeDataEvents(base)

    // chokidar 初始化期间（Vite 的 watcher 是 ignoreInitial）可能吞掉太早落盘的文件，
    // CI 上偶发丢第一个 add 事件。先反复写探针文件直到收到事件，确认 watcher 就位后再做正式断言。
    // 写入间隔必须大于 100ms 去抖窗口，否则 debounce 一直被重置、永远收不到。
    const dataDir = path.join(mockDataDir, 'hello/card', 'data')
    fs.mkdirSync(dataDir, { recursive: true })
    await vi.waitFor(
      () => {
        fs.writeFileSync(path.join(dataDir, 'canary.json'), `{"t":${Date.now()}}`, 'utf-8')
        expect(received).toContainEqual({ templatePath: 'hello/card', file: 'canary.json' })
      },
      { timeout: 10000, interval: 300 }
    )

    // 新建模板数据文件，触发 watcher 的 add 事件。
    received.length = 0
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
  }, 30000)
})
