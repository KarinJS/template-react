import path from 'node:path'

import consola from 'consola'

import { resolveConfig } from '../config'
import { ensureConventions } from '../conventions/registry'
import { buildTemplates } from './index'

/** ktr 构建插件的选项。 */
export interface KtrBuildPluginOptions {
  /** 项目根目录（含 karin.template.ts），缺省用打包器进程的 cwd。 */
  root?: string
  /** 模板产物输出目录，缺省跟随打包器自身的输出目录（vite build.outDir / rolldown output.dir）。 */
  outDir?: string
  /** 是否编译模板 CSS，默认 true。CSS 走其他管线（如 tsdown 自己的 CSS 插件）时设为 false。 */
  css?: boolean
}

/**
 * ktr 构建插件（vite / tsdown(rolldown) 通用）。
 *
 * 挂进下游自己的打包配置后，构建命令只剩打包器本身：
 * - `buildStart`：刷新 `.ktr` 约定注册表（替代 `ktr sync`）——早于模块解析，
 *   打包入口 import `.ktr` 时文件已经存在；
 * - `closeBundle`：编译模板 CSS 到产物目录（替代 `ktr build --outDir`）——
 *   晚于打包器清空和写入产物目录，不会被清掉也不会覆盖 JS 产物；
 * - `outputOptions`：缺省把打包器自己的输出目录当作模板产物目录，
 *   下游改 outDir 时不需要同步改任何 ktr 配置。
 */
export const ktrBuildPlugin = (options: KtrBuildPluginOptions = {}) => {
  let outDir = options.outDir

  return {
    name: 'ktr-template-build',
    // vite 专用字段：只在 build 时生效，dev server 不触发；rolldown/tsdown 会忽略它。
    apply: 'build' as const,

    async buildStart() {
      const config = await resolveConfig({ cwd: options.root ?? process.cwd() })
      const result = await ensureConventions(config)
      consola.success(`模板注册表已就绪：${result.routes.length} 个模板 -> ${result.registryPath}`)
    },

    outputOptions(output: { dir?: string }) {
      outDir ??= typeof output.dir === 'string' ? path.resolve(output.dir) : undefined
    },

    async closeBundle() {
      if (options.css === false) return

      await buildTemplates({
        ...(options.root ? { root: options.root } : {}),
        ...(outDir ? { outDir } : {})
      })
    }
  }
}
