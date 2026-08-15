import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveConfig, type ResolveConfigOptions } from '../config'
import { mockRegistryPath, templateRegistryPath } from '../conventions/registry'
import { importTsModule } from '../ts-import'
import type { LoadedRegistry, ResolvedKtrConfig } from '../types'

/** 约定注册表的加载选项。 */
export interface LoadRegistryOptions {
  /** 项目根目录，默认取当前工作目录。 */
  root?: string
  /** 显式指定 karin.template 配置文件路径。 */
  configFile?: string
  /** 生产打包产物所在目录（相对 root 或绝对路径），默认按 main 字段和根目录扫描自动发现。 */
  bundledDir?: string
}

/**
 * 按加载选项解析 ktr 配置，得到约定缓存目录的绝对路径。
 * @param options 加载选项。
 * @returns 全部路径已解析为绝对路径的 ktr 配置。
 */
const resolveRegistryConfig = async (options?: LoadRegistryOptions) => {
  // root 映射为 resolveConfig 的 cwd；缓存目录固定为项目根的 .ktr，不提供覆盖。
  // exactOptionalPropertyTypes 下不能显式传 undefined，这里按需组装选项。
  const resolveOptions: ResolveConfigOptions = {}
  if (options?.root) {
    resolveOptions.cwd = options.root
  }
  if (options?.configFile) {
    resolveOptions.configFile = options.configFile
  }
  return resolveConfig(resolveOptions)
}

/** 产物目录自动发现时跳过的目录（源码、资源、隐藏目录都不是构建产物）。 */
const nonOutputDirs = new Set(['node_modules', 'src', 'template', 'templates', 'ktr', 'resources', 'config', 'scripts'])

/**
 * 静态资源位置清单的文件名（产物根目录下）。
 * `dir.copyAssets: false` 时构建插件把 dir.assets 相对产物目录的位置写进这个文件，
 * 渲染时据此定位随包发布的资源目录，全包只保留一份资源。
 */
export const ktrAssetsManifestFileName = 'ktr-assets.json'

/**
 * 收集生产产物目录候选。产物目录由下游构建工具决定，框架不做假设，按优先级发现：
 * 1. 调用方显式传入的 bundledDir；
 * 2. package.json 的 main 字段所在目录（如 lib/index.js → lib/）；
 * 3. 根目录下一层目录扫描（排除源码/资源/隐藏目录）。
 * @param root 项目根目录。
 * @param bundledDir 调用方显式指定的产物目录。
 * @returns 按优先级排序的候选目录绝对路径列表。
 */
export const discoverBundledDirs = (root: string, bundledDir?: string): string[] => {
  const candidateDirs: string[] = []

  if (bundledDir) {
    candidateDirs.push(path.isAbsolute(bundledDir) ? bundledDir : path.resolve(root, bundledDir))
  }

  // main 字段是产物目录最可靠的线索（ karin 插件通常指向 lib/index.js ）。
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as { main?: string }
    if (typeof pkg.main === 'string' && pkg.main.length > 0) {
      candidateDirs.push(path.dirname(path.resolve(root, pkg.main)))
    }
  } catch {
    // package.json 缺失或损坏时继续走目录扫描。
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || nonOutputDirs.has(entry.name)) {
      continue
    }
    candidateDirs.push(path.join(root, entry.name))
  }

  return candidateDirs
}

/**
 * 在下游项目中定位打包产物里的注册表文件，候选目录由 discoverBundledDirs 按优先级给出。
 * @param root 项目根目录。
 * @param fileName 注册表文件名（如 template-registry.js）。
 * @param bundledDir 调用方显式指定的产物目录。
 * @returns 找到的文件绝对路径；找不到时返回 undefined。
 */
const findBundledRegistry = (root: string, fileName: string, bundledDir?: string): string | undefined => {
  for (const dir of discoverBundledDirs(root, bundledDir)) {
    const candidate = path.join(dir, fileName)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return undefined
}

/**
 * 挑选实际加载的注册表文件：.ktr 源文件存在时永远优先（开发态由 tsx 加载源码组件，
 * 与外部渲染器共享 node_modules 里的同一份 React）；.ktr 不存在时（生产环境）回退到
 * 随插件打包的产物（此时渲染器也已内联在同一份 bundle 中），产物目录由 findBundledRegistry 发现。
 * 不能按 mtime 取新——构建后产物比 .ktr 新，但开发态必须用源码注册表，否则包内 React 与
 * 外部渲染器的 React 是两份副本，hooks 会立刻崩溃。
 * @param root 项目根目录。
 * @param sourcePath .ktr 中的注册表源文件路径。
 * @param bundledDir 调用方显式指定的产物目录。
 * @returns 实际应加载的文件路径。
 * @throws 两个候选都不存在时抛出错误，提示先运行 ktr sync 或执行构建。
 */
const pickRegistryFile = (root: string, sourcePath: string, bundledDir?: string): string => {
  if (fs.existsSync(sourcePath)) {
    return sourcePath
  }

  const fileName = path.basename(sourcePath, path.extname(sourcePath)) + '.js'
  const bundled = findBundledRegistry(root, fileName, bundledDir)
  if (bundled) {
    return bundled
  }

  throw new Error(
    `[ktr] 未找到注册表：开发态请先运行 ktr sync 生成 ${sourcePath}；` +
      `生产环境请确认构建产物中包含 ${fileName}（可用 bundledDir 选项显式指定产物目录）。`
  )
}

/**
 * 加载约定生成的注册表文件并返回模块命名空间。
 *
 * 两条路径：`.ktr` 源文件（TS + JSX）走 tsx 即时转译——tsx 惰性注册，
 * 只在开发态触发；生产产物是纯 ESM JS，直接原生 import，不引入任何 TS 运行时，
 * 因此下游打包含 tsx 也是安全的（生产永远不会执行到它）。
 * @param filePath 注册表文件的绝对路径。
 * @returns 注册表模块的命名空间对象。
 */
const importRegistryModule = async <T>(filePath: string): Promise<T> => {
  if (!filePath.endsWith('.ts')) {
    return import(pathToFileURL(filePath).href) as Promise<T>
  }

  return importTsModule<T>(filePath)
}

/**
 * 解析模板注册表实际加载的文件路径（.ts 源码优先，缺失时回退到打包产物 .js）。
 * 调用方（createTemplateRenderer）据此判断组件的加载来源，决定 SSR React 运行时的解析策略。
 * @param config 已解析的 ktr 配置。
 * @param bundledDir 调用方显式指定的产物目录。
 * @returns 注册表文件绝对路径。
 */
export const pickTemplateRegistryFile = (config: ResolvedKtrConfig, bundledDir?: string): string =>
  pickRegistryFile(config.root, templateRegistryPath(config), bundledDir)

/**
 * 加载约定缓存目录中的模板注册表，供 karin 插件胶水层在 Node 环境中使用。
 * 返回 templates 路由映射本身；返回类型是 LoadedRegistry——
 * ktr sync 生成的模块增强生效时为逐路由精确类型，未增强时退化为 AnyRegistry。
 * 刻意不用泛型默认值：ReturnType 对泛型签名会按约束实例化，反而丢掉增强后的精确类型。
 * @param options 加载选项，可指定项目根目录、缓存目录、配置文件和生产产物目录。
 * @returns 模板路由到模板定义的映射表。
 * @throws 注册表文件不存在时抛出错误，提示先运行 ktr sync。
 */
export const loadTemplateRegistry = async (options?: LoadRegistryOptions): Promise<LoadedRegistry> => {
  const config = await resolveRegistryConfig(options)
  // 注册表模块命名空间上挂着 templates 映射，这里直接解出来，调用方拿到的是路由映射本身。
  const mod = await importRegistryModule<{ templates: LoadedRegistry }>(
    pickRegistryFile(config.root, templateRegistryPath(config), options?.bundledDir)
  )
  return mod.templates
}

/**
 * 加载约定缓存目录中的 mock 注册表，供 karin 插件胶水层读取示例数据。
 * @param options 加载选项，可指定项目根目录、缓存目录、配置文件和生产产物目录。
 * @returns mock 注册表模块命名空间，包含 TS mock 导出和 mockDataFiles 清单。
 * @throws 注册表文件不存在时抛出错误，提示先运行 ktr sync。
 */
export const loadMockRegistry = async <M extends Record<string, unknown> = Record<string, unknown>>(
  options?: LoadRegistryOptions
): Promise<M> => {
  const config = await resolveRegistryConfig(options)
  return importRegistryModule<M>(pickRegistryFile(config.root, mockRegistryPath(config), options?.bundledDir))
}
