/** 面板中展示的模板元信息，来自沙盒自动注册表。 */
export interface TemplateMeta {
  /** 约定路由，例如 hello/card 或 desktop/dashboard。 */
  path: string
  /** 侧边栏展示名称。 */
  name?: string
  /** 模板用途说明。 */
  description?: string
}

/** 单个 mock 数据文件条目。 */
export interface DataEntry {
  /** 数据文件名或 TS mock 导出名。 */
  name: string
  /** 数据来源，JSON 可以在面板中编辑，TS mock 只读。 */
  source: 'ts' | 'json'
  /** 是否禁止在面板内直接写回。 */
  readonly: boolean
}

/** iframe 沙盒向 React 面板回传的消息。 */
export type SandboxMessage =
  | {
      /** 固定来源标记，面板据此过滤非沙盒消息。 */
      source: 'ktr-sandbox'
      /** 沙盒完成初始化并上报模板清单。 */
      type: 'ktr:ready'
      /** 约定扫描到的全部模板元信息。 */
      payload: { templates: TemplateMeta[] }
    }
  | {
      /** 固定来源标记，面板据此过滤非沙盒消息。 */
      source: 'ktr-sandbox'
      /** 单个模板渲染完成。 */
      type: 'ktr:rendered'
      /** path 为模板路由；elapsed 为渲染耗时毫秒数；size 为用户组件实际尺寸，供画布适应缩放。 */
      payload: { path: string; elapsed: number; size?: { width: number; height: number } }
    }
  | {
      /** 固定来源标记，面板据此过滤非沙盒消息。 */
      source: 'ktr-sandbox'
      /** 沙盒内渲染或运行出错。 */
      type: 'ktr:error'
      /** message 为错误信息；path/stack 在可用时附带定位信息。 */
      payload: { path?: string; message: string; stack?: string }
    }
  | {
      /** 固定来源标记，面板据此过滤非沙盒消息。 */
      source: 'ktr-sandbox'
      /** 用户组件热更新完成。 */
      type: 'ktr:hmr'
      /** 发生热更新的模板路由。 */
      payload: { path: string }
    }
  | {
      /** 固定来源标记，面板据此过滤非沙盒消息。 */
      source: 'ktr-sandbox'
      /** 沙盒内按住/松开 Shift+Alt 的上行同步（焦点在 iframe 内时顶层监听不到按键）。 */
      type: 'ktr:inspect-hold'
      /** held 为 true 表示检查热键正在按住。 */
      payload: { held: boolean }
    }
