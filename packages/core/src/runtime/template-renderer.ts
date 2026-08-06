import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveConfig } from '../config'
import type { DataOf, LoadedRegistry, RenderContextInput, RendererOptions, RenderResult } from '../types'
import { createRenderer } from './renderer'
import { loadTemplateRegistry } from './registry-loader'
import { resolveTemplateStyle } from './style'

/** createTemplateRenderer 的可选覆盖项。 */
export interface TemplateRendererOptions {
  /** 透传给 createRenderer 的覆盖项（如 outputDir、extraStylePaths、plugins、htmlFileName），在约定默认值之上合并。 */
  renderer?: Partial<RendererOptions>
}

/**
 * createTemplateRenderer 返回的渲染函数类型。
 * 路由补全和 data 类型由 .ktr/registry-types.d.ts 的模块增强驱动，未增强时放宽为约定注册表。
 */
export type TemplateRenderFn = <K extends keyof LoadedRegistry & string>(
  templatePath: K,
  data: DataOf<LoadedRegistry[K]>,
  ctx?: RenderContextInput
) => Promise<RenderResult>

/**
 * 从调用方目录向上定位最近的 package.json，确定插件包根目录和包名。
 * @param startDir 调用方文件所在目录。
 * @returns 插件包根目录绝对路径和包名（无 name 字段时回退目录名）。
 */
const findPackageRoot = (startDir: string): { root: string; pluginName: string } => {
  let current = startDir
  // 最多向上 10 层，防止异常目录结构下死循环。
  for (let depth = 0; depth < 10; depth += 1) {
    const pkgPath = path.join(current, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string }
        return { root: current, pluginName: pkg.name ?? path.basename(current) }
      } catch {
        // package.json 损坏时仍能工作，包名回退为目录名。
        return { root: current, pluginName: path.basename(current) }
      }
    }

    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  throw new Error(`[ktr] 无法从 ${startDir} 向上定位插件 package.json，请确认 createTemplateRenderer 的调用方在插件包内。`)
}

/**
 * 按约定创建模板渲染函数：包根定位、配置解析、约定注册表加载、CSS 定位和捕获目录全部自动处理，
 * 下游胶水层只需要关心各自领域的逻辑（如 karin 截图与消息封装）。
 * 与 karin 等宿主框架无关；HTML 输出目录等宿主相关位置通过 options.renderer 覆盖。
 * @param callerUrl 调用方模块的 import.meta.url，用来向上定位插件包根目录。
 * @param options 可选覆盖项，renderer 会合并进 createRenderer 的约定默认值。
 * @returns 类型安全的模板渲染函数；惰性初始化，首次调用时才解析配置和注册表。
 */
export const createTemplateRenderer = (callerUrl: string, options?: TemplateRendererOptions): TemplateRenderFn => {
  // 包根定位是纯路径运算，工厂调用时同步完成；开发（tsx 跑 src）和生产（tsup 产物 lib）都能向上命中插件 package.json。
  const { root } = findPackageRoot(path.dirname(fileURLToPath(callerUrl)))

  // 惰性初始化一次：首次渲染时才解析配置、加载注册表并创建渲染器，避免模块加载期的 IO 顺序问题。
  let rendererPromise: Promise<ReturnType<typeof createRenderer>> | undefined
  const initRenderer = () => {
    rendererPromise ??= (async () => {
      const config = await resolveConfig({ cwd: root })
      const templates = await loadTemplateRegistry({ root })
      return createRenderer(templates, {
        // resolveTemplateStyle 的默认路径是 cwd 相对的，宿主进程 cwd 不一定是插件目录，必须显式按包根定位；
        // 生产 CSS 由 tsdown 编译进 lib/style.css，开发缓存仍在 node_modules/.cache/ktr。
        cssPath: resolveTemplateStyle({
          cachePath: path.join(root, 'node_modules', '.cache', 'ktr', 'style.css'),
          distDir: path.join(root, 'lib')
        }),
        outputDir: path.join(config.outDir, 'html'),
        captureDir: config.templateDir,
        // karin.template.ts 的 html 配置（圆角、headExtra）透传给渲染器。
        html: config.html,
        ...options?.renderer
      })
    })()
    return rendererPromise
  }

  return async (templatePath, data, ctx) => {
    const renderTemplate = await initRenderer()
    return renderTemplate(templatePath, data, ctx)
  }
}
