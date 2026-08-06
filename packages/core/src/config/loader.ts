import fs from 'node:fs'
import path from 'node:path'

import { defu } from 'defu'
import { createJiti } from 'jiti'

import type { KtrConfig, ResolvedKtrConfig, ResolveConfigOptions } from '../types'

// 按优先级查找的配置文件名，TS 版本优先于 JS 版本。
const configNames = ['karin.template.ts', 'karin.template.mts', 'karin.template.js', 'karin.template.mjs']

/** 无配置项目使用的默认值，核心体验围绕 template/ 和 .ktr/ 展开。 */
const defaults: KtrConfig = {
  templateDir: 'template',
  cacheDir: '.ktr',
  assetsDir: 'resources',
  outDir: 'dist/template',
  extraStylePaths: [],
  dev: {
    port: 5180,
    host: 'localhost',
    open: true
  },
  html: {
    headExtra: ''
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
 * 通过 jiti 加载 TS/JS 配置，避免要求下游先编译配置文件。
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
    // moduleCache 关闭以便重复加载时拿到最新配置，interopDefault 兼容 CJS/ESM 默认导出。
    const jiti = createJiti(import.meta.url, {
      moduleCache: false,
      interopDefault: true
    })
    const config = await jiti.import<KtrConfig>(filePath, { default: true })
    return config ?? {}
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load karin template config at ${filePath}: ${detail}`, { cause: error })
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

  const templateDirValue = merged.templateDir ?? 'template'
  const mockDataDirValue = merged.mockDataDir ?? templateDirValue
  const templateDir = resolvePath(root, templateDirValue)
  const mockDataDir = resolvePath(root, mockDataDirValue)
  const cacheDir = resolvePath(root, merged.cacheDir ?? '.ktr')
  const assetsDir = resolvePath(root, merged.assetsDir ?? 'resources')
  const outDir = resolvePath(root, merged.outDir ?? 'dist/template')
  const extraStylePaths = (merged.extraStylePaths ?? []).map((item) => resolvePath(root, item))
  const cssEntry = detectCssEntry(root, templateDir, merged.cssEntry)

  const resolved: ResolvedKtrConfig = {
    root,
    templateDir,
    cacheDir,
    mockDataDir,
    assetsDir,
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
    }
  }

  if (merged.vite) {
    resolved.vite = merged.vite
  }

  return resolved
}
