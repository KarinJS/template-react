import fs from 'node:fs'
import path from 'node:path'

import { createJiti } from 'jiti'

import { resolveConfig, type ResolveConfigOptions } from '../config'
import { mockRegistryPath, templateRegistryPath } from '../conventions/registry'
import type { LoadedRegistry } from '../types'

/** 约定注册表的加载选项。 */
export interface LoadRegistryOptions {
  /** 项目根目录，默认取当前工作目录。 */
  root?: string
  /** 约定缓存目录（相对 root 或绝对路径），默认 .ktr。 */
  cacheDir?: string
  /** 显式指定 karin.template 配置文件路径。 */
  configFile?: string
}

/**
 * 按加载选项解析 ktr 配置，得到约定缓存目录的绝对路径。
 * @param options 加载选项。
 * @returns 全部路径已解析为绝对路径的 ktr 配置。
 */
const resolveRegistryConfig = async (options?: LoadRegistryOptions) => {
  // root 映射为 resolveConfig 的 cwd，cacheDir 走 overrides 覆盖用户配置；
  // exactOptionalPropertyTypes 下不能显式传 undefined，这里按需组装选项。
  const resolveOptions: ResolveConfigOptions = {}
  if (options?.root) {
    resolveOptions.cwd = options.root
  }
  if (options?.configFile) {
    resolveOptions.configFile = options.configFile
  }
  if (options?.cacheDir) {
    resolveOptions.overrides = { cacheDir: options.cacheDir }
  }
  return resolveConfig(resolveOptions)
}

/**
 * 挑选实际加载的注册表文件：开发态用 .ktr 源码，生产环境用随插件打包进 lib/ 的产物。
 * 两份同时存在时取修改时间较新的一份——ktr sync 在开发期不断刷新 .ktr，
 * 生产发布时只带 lib/，自然命中打包产物。
 * @param root 项目根目录。
 * @param sourcePath .ktr 中的注册表源文件路径。
 * @returns 实际应加载的文件路径（可能不存在，由调用方报错）。
 */
const pickRegistryFile = (root: string, sourcePath: string): string => {
  const bundledPath = path.join(root, 'lib', path.basename(sourcePath, path.extname(sourcePath)) + '.js')
  const sourceExists = fs.existsSync(sourcePath)
  const bundledExists = fs.existsSync(bundledPath)

  if (sourceExists && bundledExists) {
    return fs.statSync(sourcePath).mtimeMs >= fs.statSync(bundledPath).mtimeMs ? sourcePath : bundledPath
  }

  return sourceExists ? sourcePath : bundledPath
}

/**
 * 用 jiti 加载约定生成的注册表文件并返回模块命名空间。
 * @param filePath 注册表文件的绝对路径。
 * @returns 注册表模块的命名空间对象。
 * @throws 注册表文件不存在时抛出错误，提示先运行 ktr sync。
 */
const importRegistryModule = async <T>(filePath: string): Promise<T> => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[ktr] 约定注册表文件不存在：${filePath}，请先运行 ktr sync 生成自动注册表（生产环境请先执行构建）。`)
  }

  // moduleCache 关闭保证开发期每次读到最新注册表，interopDefault 兼容 CJS/ESM 导出；
  // 模板组件含 JSX，开启 JSX 转换，automatic 运行时与 tsconfig 的 react-jsx 及面板 Vite 管道一致。
  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    interopDefault: true,
    jsx: { runtime: 'automatic' }
  })
  return jiti.import<T>(filePath)
}

/**
 * 加载约定缓存目录中的模板注册表，供 karin 插件胶水层在 Node 环境中使用。
 * 返回 templates 路由映射本身；返回类型是 LoadedRegistry——
 * ktr sync 生成的模块增强生效时为逐路由精确类型，未增强时退化为 AnyRegistry。
 * 刻意不用泛型默认值：ReturnType 对泛型签名会按约束实例化，反而丢掉增强后的精确类型。
 * @param options 加载选项，可指定项目根目录、缓存目录和配置文件。
 * @returns 模板路由到模板定义的映射表。
 * @throws 注册表文件不存在时抛出错误，提示先运行 ktr sync。
 */
export const loadTemplateRegistry = async (options?: LoadRegistryOptions): Promise<LoadedRegistry> => {
  const config = await resolveRegistryConfig(options)
  // 注册表模块命名空间上挂着 templates 映射，这里直接解出来，调用方拿到的是路由映射本身。
  const mod = await importRegistryModule<{ templates: LoadedRegistry }>(pickRegistryFile(config.root, templateRegistryPath(config)))
  return mod.templates
}

/**
 * 加载约定缓存目录中的 mock 注册表，供 karin 插件胶水层读取示例数据。
 * @param options 加载选项，可指定项目根目录、缓存目录和配置文件。
 * @returns mock 注册表模块命名空间，包含 TS mock 导出和 mockDataFiles 清单。
 * @throws 注册表文件不存在时抛出错误，提示先运行 ktr sync。
 */
export const loadMockRegistry = async <M extends Record<string, unknown> = Record<string, unknown>>(
  options?: LoadRegistryOptions
): Promise<M> => {
  const config = await resolveRegistryConfig(options)
  return importRegistryModule<M>(pickRegistryFile(config.root, mockRegistryPath(config)))
}
