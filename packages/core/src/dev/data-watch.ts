import path from 'node:path'

import type { ViteDevServer } from 'vite'

import type { ResolvedKtrConfig } from '../types'

/** 数据文件变更时推送给面板的 WebSocket 自定义事件名，面板侧按此名称过滤消息。 */
export const dataFilesChangedEvent = 'ktr:data-files-changed'

/**
 * 监听 mock 数据目录下的 JSON 文件变更，按模板路由去抖后通过 Vite WebSocket 通知面板刷新。
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
        server.ws.send(dataFilesChangedEvent, { templatePath, file: fileName })
      }, 100)
    )
  }

  server.watcher.on('add', notify)
  server.watcher.on('change', notify)
  server.watcher.on('unlink', notify)
}
