import { useEffect, useRef } from 'react'

/** dev server 推送数据文件变更时使用的 WebSocket 自定义事件名，与 src/dev/data-watch.ts 保持一致。 */
const dataFilesChangedEvent = 'ktr:data-files-changed'

/** 数据文件变更事件的负载：模板路由和发生变化的文件名。 */
export interface DataFilesChangedPayload {
  /** 模板路由，例如 hello/card。 */
  templatePath: string
  /** 发生变更的数据文件名，例如 captured.json。 */
  file: string
}

/**
 * 通过 Vite HMR 的 WebSocket 通道订阅 mock 数据文件变更事件，断线后自动重连。
 * @param onEvent 收到数据文件变更时的回调。
 * @returns 无返回值。
 */
export const useDataFileSync = (onEvent: (payload: DataFilesChangedPayload) => void): void => {
  // 用 ref 保存最新回调，WebSocket 闭包内始终调用当前渲染的回调，避免闭包过期。
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    // 卸载标记：组件卸载后关闭连接并停止重连。
    let stopped = false

    const connect = () => {
      if (stopped) {
        return
      }

      // 复用 vite-hmr 子协议，直接挂在 dev server 的 HMR WebSocket 端点上。
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${protocol}://${window.location.host}`, 'vite-hmr')

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; event?: string; data?: DataFilesChangedPayload }
          // 只处理数据文件变更事件，HMR 通道上的其他报文原样忽略。
          if (message.type === 'custom' && message.event === dataFilesChangedEvent && message.data) {
            onEventRef.current(message.data)
          }
        } catch {
          // 非 JSON 报文不影响面板，直接忽略。
        }
      })

      socket.addEventListener('close', () => {
        socket = null
        if (!stopped) {
          // dev server 重启等原因断线后 1s 自动重连。
          reconnectTimer = window.setTimeout(connect, 1000)
        }
      })
    }

    connect()

    return () => {
      stopped = true
      window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])
}
