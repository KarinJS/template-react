import path from 'node:path'

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'

import type { ResolvedKtrConfig } from '../types'

/** 数据文件变更时推送给面板的事件名，SSE 与（兼容路径）WebSocket 通道共用。 */
export const dataFilesChangedEvent = 'ktr:data-files-changed'

/** SSE 事件流端点，面板侧只消费这里，不依赖 Vite 内部 HMR 协议。 */
export const dataStreamPath = '/__ktr/api/stream'

/**
 * 数据文件变更的推送负载，面板侧按此形状更新数据下拉并重渲染画布。
 */
export interface DataFilesChangedPayload {
  /** 模板路由，例如 bilibili/videoInfo。 */
  templatePath: string
  /** 发生变更的数据文件名，例如 captured.json。 */
  file: string
}

/**
 * 连接活跃的 SSE 响应集合：Vite 8 的 HMR WebSocket 对浏览器同源连接强制校验 token，
 * 面板内手写 WS 客户端拿不到 token，事件永远收不到；这里改用不受 token 限制的 SSE 通道。
 */
const sseClients = new Set<ServerResponse>()

/** 给所有在线的 SSE 客户端推送一条 JSON 事件。 */
const broadcast = (payload: DataFilesChangedPayload): void => {
  const body = `event: ${dataFilesChangedEvent}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of sseClients) {
    client.write(body)
  }
}

/**
 * 处理 /__ktr/api/stream 的 SSE 长连接：发送重连提示后挂起连接，断线由面板自动重连。
 * @param req HTTP 请求。
 * @param res HTTP 响应。
 * @returns 无返回值。
 */
export const handleDataStream = (req: IncomingMessage, res: ServerResponse): void => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })
  res.write(`retry: 1000\n\n`)
  sseClients.add(res)

  // 空闲心跳：注释帧不触发面板回调，只用于防止连接被中间层按空闲超时掐断。
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
  }, 30_000)

  const close = (): void => {
    clearInterval(heartbeat)
    sseClients.delete(res)
  }
  req.on('close', close)
  res.on('close', close)
}

/**
 * 监听 mock 数据目录下的 JSON 文件变更，按模板路由去抖后通过 SSE 通知面板刷新。
 * @param server Vite 开发服务器。
 * @param config 已解析的 ktr 配置。
 * @returns 无返回值。
 */
export const registerDataWatch = (server: ViteDevServer, config: ResolvedKtrConfig): void => {
  // Vite 内置 watcher 关闭了 glob（disableGlobbing），这里监听整个 mock 目录，再在回调里筛选 JSON 文件。
  server.watcher.add(config.mockDataDir)

  // 按模板路由分别记录去抖定时器，短时间内的连续写入只保留最后一次通知。
  const debounceTimers = new Map<string, NodeJS.Timeout>()

  const notify = (file: string): void => {
    if (!file.endsWith('.json')) {
      return
    }

    // JSON mock 约定收在各模板目录的 data/ 子目录中，其他位置的 JSON 不推送给面板。
    if (path.basename(path.dirname(file)) !== 'data') {
      return
    }

    const fileName = path.basename(file)
    // 文件相对 mock 数据目录的目录名去掉 data/ 段就是模板路由，统一转成 posix 分隔供面板和 URL 使用。
    const templatePath = path
      .relative(config.mockDataDir, path.dirname(path.dirname(file)))
      .split(path.sep)
      .join('/')
    if (!templatePath) {
      // mock 根目录下的散置 JSON 不属于任何模板，直接忽略。
      return
    }

    const pending = debounceTimers.get(templatePath)
    if (pending) {
      clearTimeout(pending)
    }

    debounceTimers.set(
      templatePath,
      setTimeout(() => {
        debounceTimers.delete(templatePath)
        broadcast({ templatePath, file: fileName })
      }, 100)
    )
  }

  server.watcher.on('add', notify)
  server.watcher.on('change', notify)
  server.watcher.on('unlink', notify)
}
