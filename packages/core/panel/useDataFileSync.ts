import { useEffect, useRef } from 'react'

/** 数据文件变更事件名，与 dev 服务端 data-watch 保持一致。 */
const dataFilesChangedEvent = 'ktr:data-files-changed'

/** SSE 事件流端点，与 dev 服务端 mock-api 的 /stream 路由保持一致。 */
const dataStreamPath = '/__ktr/api/stream'

/** 数据文件变更负载。 */
export interface DataFilesChangedPayload {
  /** 模板路由，例如 bilibili/videoInfo。 */
  templatePath: string
  /** 发生变更的数据文件名，例如 captured.json。 */
  file: string
}

/**
 * 订阅 dev 服务端的数据文件变更事件，用于面板无感刷新当前画布。
 *
 * 走 SSE 而不是 Vite 的 HMR WebSocket：Vite 8 对浏览器同源的 HMR 连接强制校验 token，
 * 面板是静态产物、拿不到那个 token，手写 WS 客户端能连上但永远收不到任何帧。
 * EventSource 自带断线重连，服务端重启后无需手动恢复。
 *
 * @param onEvent 收到变更事件时的回调。
 * @returns 无返回值。
 */
export const useDataFileSync = (onEvent: (payload: DataFilesChangedPayload) => void): void => {
  // 回调放进 ref：订阅只建立一次，避免每次渲染重连导致事件丢失。
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const source = new EventSource(dataStreamPath)

    const handle = (event: MessageEvent<string>): void => {
      try {
        const payload = JSON.parse(event.data) as DataFilesChangedPayload
        if (payload && typeof payload.templatePath === 'string' && typeof payload.file === 'string') {
          onEventRef.current(payload)
        }
      } catch {
        // 非法负载直接忽略，不影响后续事件。
      }
    }

    source.addEventListener(dataFilesChangedEvent, handle as EventListener)

    return () => {
      source.removeEventListener(dataFilesChangedEvent, handle as EventListener)
      source.close()
    }
  }, [])
}
