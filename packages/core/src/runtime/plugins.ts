import type { PluginContext, RenderPlugin } from '../types'

// enforce 数值越小越早执行，保证 pre 插件总能最先拿到上下文。
const order = {
  pre: -1,
  normal: 0,
  post: 1
} as const

/** 按 enforce 顺序执行 SSR 渲染插件。 */
export class PluginContainer {
  private readonly plugins: RenderPlugin[]

  /**
   * @param plugins 渲染插件列表，内部会按 enforce 排序后保存副本。
   */
  constructor(plugins: RenderPlugin[] = []) {
    // 复制后再排序，避免修改调用方传入的数组；pre 最先执行，post 最后执行。
    // oxlint-disable-next-line unicorn/no-array-sort -- Sort a cloned array to keep Node 18 compatibility.
    this.plugins = [...plugins].sort((left, right) => order[left.enforce ?? 'normal'] - order[right.enforce ?? 'normal'])
  }

  /**
   * 单个插件失败时只跳过该插件，避免影响模板本身渲染。
   * @param plugin 待检查的渲染插件。
   * @param path 当前模板路由。
   * @returns 该插件是否作用于当前模板。
   */
  private shouldApply(plugin: RenderPlugin, path: string): boolean {
    try {
      return plugin.apply ? plugin.apply(path) : true
    } catch (error) {
      console.warn(`[ktr] 渲染插件 ${plugin.name} 的 apply() 执行失败，已跳过`, error)
      return false
    }
  }

  /**
   * 串行执行所有插件的 beforeRender 钩子。
   * @param ctx 当前渲染上下文。
   * @returns 无返回值。
   */
  async runBefore(ctx: PluginContext): Promise<void> {
    for (const plugin of this.plugins) {
      if (this.shouldApply(plugin, ctx.path)) {
        // oxlint-disable-next-line no-await-in-loop -- Render hooks must run in declared order.
        await plugin.beforeRender?.(ctx)
      }
    }
  }

  /**
   * 串行执行所有插件的 afterRender 钩子，并返回最终加工后的 HTML。
   * @param ctx 当前渲染上下文和初始 HTML。
   * @returns 经过全部插件处理后的 HTML。
   */
  async runAfter(ctx: PluginContext & { html: string }): Promise<string> {
    let html = ctx.html

    for (const plugin of this.plugins) {
      if (!this.shouldApply(plugin, ctx.path)) {
        continue
      }

      // 每个 afterRender 都会接收上一个插件返回的 HTML，所以必须串行执行。
      // oxlint-disable-next-line no-await-in-loop -- Each hook receives the HTML returned by the previous hook.
      const next = await plugin.afterRender?.({ ...ctx, html })
      if (typeof next === 'string') {
        html = next
      }
    }

    return html
  }
}
