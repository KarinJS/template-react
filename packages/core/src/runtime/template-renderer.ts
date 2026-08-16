import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveConfig } from '../config'
import type { DataOf, LoadedRegistry, RenderContextInput, RendererOptions, RenderResult, ResolvedKtrConfig } from '../types'
import { createRenderer } from './renderer'
import {
  discoverBundledDirs,
  ktrAssetsManifestFileName,
  loadTemplateRegistry,
  pickTemplateRegistryFile,
  type LoadRegistryOptions
} from './registry-loader'
import { resolveTemplateStyle } from './style'

/** createTemplateRenderer 的可选覆盖项。 */
export interface TemplateRendererOptions {
  /** 透传给 createRenderer 的覆盖项（如 outputDir、extraStylePaths、plugins、htmlFileName），在约定默认值之上合并。 */
  renderer?: Partial<RendererOptions>
  /** 生产打包产物所在目录（相对包根或绝对路径），默认按 main 字段和根目录扫描自动发现。 */
  bundledDir?: string
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
 * 渲染器是否跑在下游 bundle 里：生产构建时 ktrBuildPlugin 会在产物 chunk 顶部注入
 * `globalThis.__KTR_BUNDLED__ = true`（renderChunk，vite / tsdown 都生效）。
 * 命中即生产语义：发布产物里没有 .ktr 和 karin.template.ts，
 * 直接用打包产物注册表 + 默认配置 + 位置清单，完全不触发 TS 加载（tsx），
 * 也避免"仓库里跑生产"时误用源码注册表（慢，且调试器下 tsx hooks 会让 import 挂起）。
 * @returns 渲染器来自下游 bundle 时返回 true。
 */
export const isBundledRuntime = (): boolean => (globalThis as { __KTR_BUNDLED__?: boolean }).__KTR_BUNDLED__ === true

/**
 * 定位标记资源（<img src="/..."> 等）的根目录，与注册表加载共享同一套产物目录发现：
 * 1. dir.assets 源码目录存在时优先（开发态改动即时生效；资源随包发布、copyAssets: false 的生产包也走这里）；
 * 2. 否则在产物候选目录下找 assets/（构建插件把 dir.assets 原样复制到这里）。
 * 不依赖 chunk 位置——单 chunk 或 core_chunk/ 子目录都不影响，发现的是产物根目录。
 * @param config 已解析的 ktr 配置。
 * @param bundledDir 调用方显式指定的产物目录。
 * @param preferBundled 生产 bundle 场景为 true：先查产物（清单/assets/），源码目录只作兜底。
 * @returns 资源根目录绝对路径；都找不到时返回 undefined（渲染时不做标记资源改写）。
 */
export const discoverAssetsDir = (
  config: Pick<ResolvedKtrConfig, 'root' | 'assetsDir'>,
  bundledDir?: string,
  preferBundled = false
): string | undefined => {
  if (!preferBundled && fs.existsSync(config.assetsDir)) {
    return config.assetsDir
  }

  for (const dir of discoverBundledDirs(config.root, bundledDir)) {
    // copyAssets: false 的包带位置清单，指向随包发布的资源目录（相对产物目录）。
    const manifestPath = path.join(dir, ktrAssetsManifestFileName)
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { assetsDir?: string }
        if (typeof manifest.assetsDir === 'string') {
          const resolved = path.resolve(dir, manifest.assetsDir)
          if (fs.existsSync(resolved)) {
            return resolved
          }
        }
      } catch {
        // 清单损坏时继续按默认位置探测。
      }
    }

    const candidate = path.join(dir, 'assets')
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  // bundle 模式下产物里没找到时，源码目录兜底（比如资源随包发布但构建版本过旧没有清单）。
  if (preferBundled && fs.existsSync(config.assetsDir)) {
    return config.assetsDir
  }

  return undefined
}

/**
 * 从下游插件包根解析 SSR 用的 React 运行时。
 * ktr 被 link 进下游开发时，渲染器自身的静态导入会从 ktr 仓库的 node_modules 再解析出一份
 * react / react-dom，与模板组件（从下游源码树解析）不是同一个实例，hooks 立刻崩溃
 * （Invalid hook call）。从包根解析保证渲染器与组件始终共用同一份 React。
 * @param root 插件包根目录。
 * @returns 可用的 SSR 运行时；解析失败（如生产 bundle 环境没有独立 node_modules）返回 undefined，
 *   调用方回落到渲染器自身的静态导入。
 */
export const resolveDownstreamSsrRuntime = async (root: string): Promise<RendererOptions['ssrRuntime'] | undefined> => {
  try {
    const require = createRequire(path.join(root, 'package.json'))
    const reactModule = await import(pathToFileURL(require.resolve('react')).href)
    const serverModule = await import(pathToFileURL(require.resolve('react-dom/server')).href)
    // CJS 动态导入的命名空间上 default 是 module.exports，两份都兼容取。
    const react = (reactModule.default ?? reactModule) as typeof import('react')
    const server = (serverModule.default ?? serverModule) as typeof import('react-dom/server')
    if (typeof react.createElement !== 'function' || typeof server.renderToReadableStream !== 'function') {
      return undefined
    }
    return { createElement: react.createElement, renderToReadableStream: server.renderToReadableStream }
  } catch {
    return undefined
  }
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
      // 渲染器自身在下游 bundle 里时按纯生产语义装配：产物没有 .ktr 和 karin.template.ts，
      // 跳过 TS 配置与源码注册表，tsx 完全不参与（调试器下 tsx hooks 会让动态 import 挂起）。
      const bundledRuntime = isBundledRuntime()
      const config = await resolveConfig(bundledRuntime ? { cwd: root, skipUserConfig: true } : { cwd: root })
      const registryOptions: LoadRegistryOptions = { root, preferSource: !bundledRuntime }
      if (options?.bundledDir) {
        registryOptions.bundledDir = options.bundledDir
      }
      const templates = await loadTemplateRegistry(registryOptions)
      const assetsDir = discoverAssetsDir(config, options?.bundledDir, bundledRuntime)
      // 加载的是 .ts 源注册表时，组件从下游源码树解析依赖（dev / ktr 被 link 的场景），
      // 渲染器必须改用下游包根解析出的 React，否则双副本导致 hooks 崩溃；
      // 生产产物（.js 注册表）里组件与渲染器同在一份 bundle，保持静态导入。
      const registryFile = pickTemplateRegistryFile(config, options?.bundledDir, !bundledRuntime)
      const ssrRuntime = registryFile.endsWith('.ts') ? await resolveDownstreamSsrRuntime(root) : undefined
      return createRenderer(templates, {
        // resolveTemplateStyle 的默认路径是 cwd 相对的，宿主进程 cwd 不一定是插件目录，必须显式按包根定位；
        // 生产 CSS 由 tsdown 编译进 lib/style.css，开发缓存仍在 node_modules/.cache/ktr。
        cssPath: resolveTemplateStyle({
          cachePath: path.join(root, 'node_modules', '.cache', 'ktr', 'style.css'),
          distDir: path.join(root, 'lib')
        }),
        // 标记资源根目录：开发态是 dir.assets 源码目录，生产态是产物里的 assets/，与 chunk 位置无关。
        ...(assetsDir ? { assetsDir } : {}),
        assetsInlineLimit: config.html.assetsInlineLimit,
        ...(ssrRuntime ? { ssrRuntime } : {}),
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
