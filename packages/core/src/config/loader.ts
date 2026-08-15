import fs from 'node:fs'
import path from 'node:path'

import { defu } from 'defu'

import { importTsModule } from '../ts-import'
import type { KtrConfig, ResolvedKtrConfig, ResolveConfigOptions } from '../types'

// 按优先级查找的配置文件名，TS 版本优先于 JS 版本。
const configNames = ['karin.template.ts', 'karin.template.mts', 'karin.template.js', 'karin.template.mjs']

/** 无配置项目使用的默认值，核心体验围绕 ktr/ 和 .ktr/ 展开。 */
const defaults: KtrConfig = {
  dir: {
    template: 'ktr/template'
  },
  extraStylePaths: [],
  dev: {
    port: 5180,
    host: 'localhost',
    open: true
  },
  html: {
    headExtra: ''
  },
  standalone: {
    outDir: 'dist/ktr',
    target: 'node18',
    format: 'esm',
    minify: false,
    sourcemap: false,
    assets: 'copy',
    external: [],
    singleChunk: true
  }
}

/**
 * 查找用户配置文件，支持显式传入文件名或默认 karin.template.*。
 * @param cwd 项目根目录。
 * @param configFile 可选的显式配置文件路径。
 * @returns 找到的配置文件绝对路径，找不到时返回 undefined。
 */
const findConfigFile = (cwd: string, configFile?: string): string | undefined => {
  if (configFile) {
    const filePath = path.resolve(cwd, configFile)
    return fs.existsSync(filePath) ? filePath : undefined
  }

  return configNames.map((name) => path.join(cwd, name)).find((filePath) => fs.existsSync(filePath))
}

/**
 * 通过 tsx 加载 TS/JS 配置，避免要求下游先编译配置文件。
 * @param cwd 项目根目录。
 * @param configFile 可选的显式配置文件路径。
 * @returns 用户配置对象，没有配置文件时返回空对象。
 */
const loadUserConfig = async (cwd: string, configFile?: string): Promise<KtrConfig> => {
  const filePath = findConfigFile(cwd, configFile)
  if (!filePath) {
    return {}
  }

  try {
    // tsx 惰性加载：只有真的存在 TS 配置文件才需要它，生产产物里没有配置文件，
    // 顶层不 import 就不会成为运行时的硬依赖。
    const mod = await importTsModule<{ default?: KtrConfig }>(filePath)
    const loaded = (mod.default ?? {}) as KtrConfig & { default?: KtrConfig }
    // 下游项目没有 package.json（或 type 不是 module）时 tsx 会把配置转译成 CJS，
    // node 的 ESM-CJS interop 会再包一层 default（ktr 自身只发布 ESM，这里把这一层解开即可）。
    return loaded.default ?? loaded
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`加载 karin 模板配置失败（${filePath}）：${detail}`, { cause: error })
  }
}

const resolvePath = (root: string, value: string): string => (path.isAbsolute(value) ? value : path.resolve(root, value))

/**
 * 自动探测 CSS 入口，优先使用 template/style.css，再退回任意 CSS 文件。
 * @param root 项目根目录。
 * @param templatesDir 已解析的模板目录。
 * @param cssEntry 用户显式配置的 CSS 入口。
 * @returns CSS 入口绝对路径。
 */
const detectCssEntry = (root: string, templatesDir: string, cssEntry?: string): string => {
  if (cssEntry) {
    return resolvePath(root, cssEntry)
  }

  const commonEntry = path.join(templatesDir, 'style.css')
  if (fs.existsSync(commonEntry)) {
    return commonEntry
  }

  if (!fs.existsSync(templatesDir)) {
    return commonEntry
  }

  // 深度优先遍历模板目录，找到第一个 .css 文件就作为入口。
  const stack = [templatesDir]
  while (stack.length > 0) {
    const dir = stack.pop()
    if (!dir) {
      continue
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.isFile() && entry.name.endsWith('.css')) {
        return entryPath
      }
    }
  }

  return commonEntry
}

/**
 * 解析 ktr 配置，并合并默认值、用户配置和命令行覆盖。
 * @param options 解析选项，可指定根目录、配置文件和临时覆盖项。
 * @returns 全部路径已解析为绝对路径的最终配置。
 */
export const resolveConfig = async (options: ResolveConfigOptions = {}): Promise<ResolvedKtrConfig> => {
  const root = path.resolve(options.cwd ?? process.cwd())
  const userConfig = await loadUserConfig(root, options.configFile)
  const overrideConfig = options.overrides ?? {}
  // defu 合并优先级：命令行覆盖 > karin.template.ts 用户配置 > 默认值。
  const merged = defu(overrideConfig, userConfig, defaults) as KtrConfig

  const mergedDir = merged.dir ?? {}
  const templateDirValue = mergedDir.template ?? 'ktr/template'
  const templateDir = resolvePath(root, templateDirValue)
  // mock 数据与模板共置（各模板自己的 data/ 子目录），缓存目录固定为项目根的 .ktr，都不可配。
  const mockDataDir = templateDir
  const cacheDir = resolvePath(root, '.ktr')
  // 静态资源默认与模板目录同级（ktr/template -> ktr/public）：dev server 把它当 publicDir 服务，构建插件负责复制到产物 assets/。
  const assetsDir = resolvePath(root, mergedDir.assets ?? path.posix.join(path.posix.dirname(templateDirValue), 'public'))
  // 资源目录本身随包发布在固定位置时（如 resources/ 与 package.json 同级），可以关掉复制避免重复打包。
  const copyAssets = mergedDir.copyAssets ?? true
  // 构建产物目录只服务内部约定（SSR HTML 默认落盘等）；打包时的产物目录由构建插件跟随打包器 outDir。
  const outDir = resolvePath(root, 'dist/template')
  const extraStylePaths = (merged.extraStylePaths ?? []).map((item) => resolvePath(root, item))
  const cssEntry = detectCssEntry(root, templateDir, mergedDir.cssEntry)
  const standaloneOutDir = resolvePath(root, merged.standalone?.outDir ?? 'dist/ktr')

  const resolved: ResolvedKtrConfig = {
    root,
    templateDir,
    cacheDir,
    mockDataDir,
    assetsDir,
    copyAssets,
    outDir,
    cssEntry,
    extraStylePaths,
    dev: {
      port: merged.dev?.port ?? 5180,
      host: merged.dev?.host ?? 'localhost',
      open: merged.dev?.open ?? true
    },
    html: {
      headExtra: merged.html?.headExtra ?? ''
    },
    standalone: {
      outDir: standaloneOutDir,
      target: merged.standalone?.target ?? 'node18',
      format: merged.standalone?.format ?? 'esm',
      minify: merged.standalone?.minify ?? false,
      sourcemap: merged.standalone?.sourcemap ?? false,
      assets: merged.standalone?.assets ?? 'copy',
      external: [...(merged.standalone?.external ?? [])],
      singleChunk: merged.standalone?.singleChunk ?? true
    }
  }

  if (merged.vite) {
    resolved.vite = merged.vite
  }

  return resolved
}
