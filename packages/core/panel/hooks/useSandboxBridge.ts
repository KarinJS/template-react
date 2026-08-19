import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import type { RegisterProgress, SandboxMessage, TemplateMeta } from '../types'

/** 面板发往沙盒的消息来源标记，沙盒据此过滤非面板消息。 */
const panelSource = 'ktr-panel'

/** 沙盒上行消息的处理回调集合，每个回调对应一种 ktr:* 消息。 */
interface SandboxBridgeHandlers {
  /** 沙盒完成初始化并上报模板清单。 */
  onReady: (templates: TemplateMeta[]) => void
  /** 约定模板注册进度上报（注册完成一个就推一次）。 */
  onRegisterProgress: (progress: RegisterProgress) => void
  /** 单个模板渲染完成，附带耗时和实际内容尺寸。 */
  onRendered: (payload: { path: string; elapsed: number; size?: { width: number; height: number } }) => void
  /** 沙盒内渲染或运行出错。 */
  onError: (payload: { path?: string; message: string; stack?: string }) => void
  /** 用户组件热更新完成。 */
  onHmr: (payload: { path: string }) => void
  /** 沙盒内按住/松开 Shift+Alt 的上行同步（焦点在 iframe 内时顶层监听不到按键）。 */
  onInspectHold: (held: boolean) => void
}

/** useSandboxBridge 的入参：iframe 引用加上行消息回调。 */
interface UseSandboxBridgeOptions extends SandboxBridgeHandlers {
  /** 预览 iframe 的引用，postMessage 的目标窗口来源。 */
  iframeRef: RefObject<HTMLIFrameElement | null>
}

/**
 * 面板与 iframe 沙盒的通信桥：
 * 下行用 postSandbox 发指令（source='ktr-panel'），上行挂一次 window message 监听
 * （校验 origin + source='ktr-sandbox'）分发到各回调。
 *
 * 回调经 ref 同步最新闭包，message 监听只挂一次，不随渲染重复订阅。
 *
 * @returns postSandbox 发送函数和 sandboxReadyTick（沙盒每就绪一次自增，供副作用依赖重发主题等）。
 */
export const useSandboxBridge = ({
  iframeRef,
  onReady,
  onRegisterProgress,
  onRendered,
  onError,
  onHmr,
  onInspectHold
}: UseSandboxBridgeOptions) => {
  const [sandboxReadyTick, setSandboxReadyTick] = useState(0)
  // 回调放进 ref：监听只建立一次，回调内始终读到最新闭包。
  const handlersRef = useRef<SandboxBridgeHandlers>({ onReady, onRegisterProgress, onRendered, onError, onHmr, onInspectHold })
  handlersRef.current = { onReady, onRegisterProgress, onRendered, onError, onHmr, onInspectHold }

  /** 向 iframe 沙盒发送渲染指令或主题数据。 */
  const postSandbox = useCallback(
    (type: string, payload: unknown) => {
      iframeRef.current?.contentWindow?.postMessage({ source: panelSource, type, payload }, window.location.origin)
    },
    [iframeRef]
  )

  // 监听 iframe 沙盒回传的消息，驱动模板清单、状态栏和画布尺寸更新。
  useEffect(() => {
    const onMessage = (event: MessageEvent<SandboxMessage>) => {
      if (event.origin !== window.location.origin || event.data?.source !== 'ktr-sandbox') {
        return
      }

      const handlers = handlersRef.current
      switch (event.data.type) {
        case 'ktr:ready':
          handlers.onReady(event.data.payload.templates)
          setSandboxReadyTick((tick) => tick + 1)
          break
        case 'ktr:register-progress':
          handlers.onRegisterProgress(event.data.payload)
          break
        case 'ktr:rendered':
          handlers.onRendered(event.data.payload)
          break
        case 'ktr:error':
          handlers.onError(event.data.payload)
          break
        case 'ktr:hmr':
          handlers.onHmr(event.data.payload)
          break
        case 'ktr:inspect-hold':
          handlers.onInspectHold(event.data.payload.held)
          break
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return { postSandbox, sandboxReadyTick }
}
