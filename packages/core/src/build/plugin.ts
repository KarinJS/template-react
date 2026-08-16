import path from 'node:path'

import consola from 'consola'
import type { Plugin } from 'vite'

import { resolveConfig } from '../config'
import { ensureConventions } from '../conventions/registry'
import { ktrAssetsManifestFileName } from '../runtime/registry-loader'
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
 * - `generateBundle`：内存编译模板 CSS 并以 asset 形式 emit 进打包器自己的 bundle——
 *   style.css 出现在打包器自身的输出文件列表里，不再另起一行独立打印；
 * - `outputOptions`：缺省把打包器自己的输出目录当作模板产物目录，
 *   下游改 outDir 时不需要同步改任何 ktr 配置。
 */
export const ktrBuildPlugin = (options: KtrBuildPluginOptions = {}): Plugin => {
  let outDir = options.outDir
  // copyAssets: false 时资源目录随包发布、不复制进产物，这里记下它的位置，构建期写成清单。
  let publishedAssetsDir: string | undefined

  return {
    name: 'ktr-template-build',
    // vite 专用字段：只在 build 时生效，dev server 不触发；rolldown/tsdown 会忽略它。
    apply: 'build' as const,

    async buildStart() {
      const config = await resolveConfig({ cwd: options.root ?? process.cwd() })
      if (!config.copyAssets) {
        publishedAssetsDir = config.assetsDir
      }
      const result = await ensureConventions(config)
      consola.success(`模板注册表已就绪：${result.routes.length} 个模板 -> ${result.registryPath}`)
    },

    outputOptions(output: { dir?: string }) {
      outDir ??= typeof output.dir === 'string' ? path.resolve(output.dir) : undefined
    },

    // 在每个产物 chunk 顶部注入 bundle 标记：渲染器据此切换到生产语义
    //（不读 karin.template.ts、不看 .ktr 源码，tsx 完全不参与）。
    // 用 renderChunk 而不是 define——不依赖下游打包配置合并，vite / tsdown(rolldown) 都生效。
    renderChunk(code) {
      return { code: `globalThis.__KTR_BUNDLED__ = true;\n${code}`, map: null }
    },

    async generateBundle() {
      // 资源不复制时在产物根写位置清单：渲染时据此定位随包发布的资源目录，全包只有一份资源。
      if (publishedAssetsDir && outDir) {
        const relative = path.relative(outDir, publishedAssetsDir).replace(/\\/g, '/')
        this.emitFile({ type: 'asset', fileName: ktrAssetsManifestFileName, source: `${JSON.stringify({ assetsDir: relative })}\n` })
      }

      if (options.css === false) return

      const result = await buildTemplates({
        ...(options.root ? { root: options.root } : {}),
        ...(outDir ? { outDir } : {}),
        // 显式指定 outDir 时产物可能要在 bundle 目录之外，无法 emit，保持直接落盘。
        write: options.outDir !== undefined
      })
      for (const output of result.outputs) {
        this.emitFile({ type: 'asset', fileName: output.fileName, source: output.source })
      }
    }
  }
}
