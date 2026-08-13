import fs from 'node:fs'
import path from 'node:path'

import fg from 'fast-glob'

import type { ResolvedKtrConfig } from '../types'

const generatedHeader = '// 此文件由 @karinjs/template-react 自动生成，请不要手动修改。'
const generatedNotice = '// 按约定维护 ktr/template/ 下的组件、mock 与 JSON 数据，运行 ktr sync/dev/build 会自动刷新这里。'

const normalizePath = (filePath: string): string => filePath.replace(/\\/g, '/')

/**
 * Node 18 没有 Array#toSorted，这里集中复制后排序，避免修改 fast-glob 返回值。
 * @param items 待排序的数组。
 * @param compare 比较函数，返回值小于 0 表示 left 排在前面。
 * @returns 排序后的新数组。
 */
const sortedBy = <T>(items: T[], compare: (left: T, right: T) => number): T[] => {
  const sorted: T[] = []
  for (const item of items) {
    let index = 0
    while (index < sorted.length && compare(sorted[index] as T, item) <= 0) {
      index += 1
    }
    sorted.splice(index, 0, item)
  }
  return sorted
}

const stripExtension = (filePath: string): string => filePath.replace(/\.[cm]?[jt]sx?$/, '')

/**
 * 把模板文件路径转换成面板路由。
 * @param filePath 相对模板根目录的文件路径。
 * @returns 归一化后的路由，例如 hello/card。
 */
const toRoutePath = (filePath: string): string => {
  const route = stripExtension(normalizePath(filePath))
  // /index 归一化：hello/card/index.tsx 与 hello/card.tsx 是同一个路由。
  return route.endsWith('/index') ? route.slice(0, -'/index'.length) : route
}

/**
 * 把路由转成合法的 import 标识符，非法字符替换为下划线。
 * @param routePath 模板路由。
 * @param index 路由序号，标识符为空时兜底使用。
 * @returns 生成的 import 变量名。
 */
const toImportName = (routePath: string, index: number): string => {
  const safeName = routePath.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^([^a-zA-Z_$])/, '_$1')
  return safeName ? `template_${safeName}` : `template_${index}`
}

/**
 * 判断目标文件是否是框架生成的产物。
 * @param filePath 待检查的注册表文件路径。
 * @returns 可以安全覆盖返回 true，用户手改过的文件返回 false。
 */
const isGeneratedFile = (filePath: string): boolean => {
  // 文件不存在视为可生成，方便首次写入。
  if (!fs.existsSync(filePath)) {
    return true
  }

  // 防手改判断：只有带自动生成头的文件才允许覆盖，避免破坏用户手动修改。
  const content = fs.readFileSync(filePath, 'utf-8')
  return content.startsWith(generatedHeader)
}

const ensureParentDir = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

const extensionPattern = /\.[cm]?[jt]sx?$/

const withoutExtension = (filePath: string): string => filePath.replace(extensionPattern, '')

/**
 * 计算注册表到目标文件的相对模块路径，并去掉扩展名。
 * @param fromFile 引用方文件（注册表）的绝对路径。
 * @param toFile 被引用模块的绝对路径。
 * @returns 以 ./ 或 ../ 开头的相对模块路径。
 */
const relativeModulePath = (fromFile: string, toFile: string): string => {
  const fromDir = path.dirname(fromFile)
  const withoutExt = withoutExtension(toFile)
  const relative = normalizePath(path.relative(fromDir, withoutExt))
  return relative.startsWith('.') ? relative : `./${relative}`
}

/**
 * 模板注册表的隐藏缓存路径。
 * @param config 已解析的 ktr 配置。
 * @returns template-registry.ts 的绝对路径。
 */
export const templateRegistryPath = (config: ResolvedKtrConfig): string => path.join(config.cacheDir, 'template-registry.ts')

/**
 * mock 导出和 JSON 清单的隐藏缓存路径。
 * @param config 已解析的 ktr 配置。
 * @returns mock-registry.ts 的绝对路径。
 */
export const mockRegistryPath = (config: ResolvedKtrConfig): string => path.join(config.cacheDir, 'mock-registry.ts')

/**
 * 注册表类型增强文件的隐藏缓存路径，向 ProjectRegistry 注入逐路由精确类型。
 * @param config 已解析的 ktr 配置。
 * @returns registry-types.d.ts 的绝对路径。
 */
export const registryTypesPath = (config: ResolvedKtrConfig): string => path.join(config.cacheDir, 'registry-types.d.ts')

/** 自动注册同步结果。 */
export interface TemplateRegistryResult {
  /** 本次是否写入了自动注册文件。 */
  generated: boolean
  /** 自动注册文件的绝对路径。 */
  registryPath: string
  /** 扫描到的模板路由列表。 */
  routes: string[]
}

/**
 * 扫描模板根目录，并把文件路径转换为面板路由。
 * 强约定（App Router 风格）：只有 <板块>/<模板>/index.tsx 注册为路由，目录即路由，文件名固定；
 * 裸写的 <板块>/<模板>.tsx 不注册。components/ 是模板内部组件/逻辑的固定存放目录，不参与路由。
 * @param templatesDir 模板根目录绝对路径。
 * @returns 按路由排序后的文件和路由列表。
 */
export const discoverTemplateRoutes = async (templatesDir: string): Promise<Array<{ file: string; route: string }>> => {
  if (!fs.existsSync(templatesDir)) {
    return []
  }

  // 下划线开头目录与 components/ 都是内部辅助目录，不参与路由。
  const files = await fg(['**/index.{tsx,jsx}'], {
    cwd: templatesDir,
    onlyFiles: true,
    ignore: ['**/_*/**', '**/components/**']
  })

  return sortedBy(
    files.map((file) => ({ file, route: toRoutePath(file) })).filter((item) => item.route.length > 0),
    (left, right) => left.route.localeCompare(right.route)
  )
}

/**
 * 生成隐藏缓存中的模板注册表，用户源码目录不会出现 index.ts。
 * @param config 已解析的 ktr 配置。
 * @returns 本次同步结果；注册表被用户手改过时 generated 为 false。
 */
export const ensureTemplateRegistry = async (config: ResolvedKtrConfig): Promise<TemplateRegistryResult> => {
  const registryPath = templateRegistryPath(config)
  const routes = await discoverTemplateRoutes(config.templateDir)

  // 注册表被手动修改过时直接跳过，防止覆盖用户改动。
  if (!isGeneratedFile(registryPath)) {
    return { generated: false, registryPath, routes: [] }
  }

  ensureParentDir(registryPath)
  // 逐路由生成 default import，供下方 templates 映射表引用组件。
  const imports = routes.map((item, index) => {
    const absoluteFile = path.join(config.templateDir, item.file)
    return `import ${toImportName(item.route, index)} from '${relativeModulePath(registryPath, absoluteFile)}'`
  })
  // 透传模板文件的具名导出，下游可以直接从注册表模块导入。
  const exports = routes.map((item) => {
    const absoluteFile = path.join(config.templateDir, item.file)
    return `export * from '${relativeModulePath(registryPath, absoluteFile)}'`
  })
  const registryItems = routes.map((item, index) => `  '${item.route}': ${toImportName(item.route, index)}`)
  // 显式标注为宽松的注册表类型：逐路由精确类型由 registry-types.d.ts 的模块增强提供，
  // 这里如果靠 as const 推断，模板的未导出数据接口会让 declaration 输出报 TS4023。
  const content = `${generatedHeader}
${generatedNotice}
import type { TemplateDef } from '@karinjs/template-react'
${imports.join('\n')}

${exports.join('\n')}

export const templates: Record<string, TemplateDef<any>> = {
${registryItems.join(',\n')}
}

export type TemplateRegistry = typeof templates
`

  fs.writeFileSync(registryPath, content, 'utf-8')

  // 同步生成类型增强文件：以 typeof import() 引用各模板 default 导出的 TemplateDef<D>，
  // 通过模块增强注入 ProjectRegistry，下游无需 import .ktr 即可获得严格类型。
  const typesPath = registryTypesPath(config)
  if (isGeneratedFile(typesPath)) {
    const typeItems = routes.map((item) => {
      const absoluteFile = path.join(config.templateDir, item.file)
      return `    '${item.route}': typeof import('${relativeModulePath(typesPath, absoluteFile)}').default`
    })
    // export {} 让本文件成为模块，使 declare module 按模块增强（而非新建环境模块）处理。
    const typesContent = `${generatedHeader}
${generatedNotice}
// 下游源码无需 import .ktr：ktr sync 会把逐路由精确类型注入 @karinjs/template-react/registry-types。
export {}

declare module '@karinjs/template-react/registry-types' {
  interface ProjectRegistry {
${typeItems.join('\n')}
  }
}
`
    fs.writeFileSync(typesPath, typesContent, 'utf-8')
  }

  return { generated: true, registryPath, routes: routes.map((item) => item.route) }
}

/**
 * 生成隐藏缓存中的 mock 注册表和 JSON 清单，用于类型导出和面板提示。
 * @param config 已解析的 ktr 配置。
 * @returns mock-registry.ts 的绝对路径；mock 目录不存在时返回 undefined。
 */
export const ensureMockRegistry = async (config: ResolvedKtrConfig): Promise<string | undefined> => {
  if (!fs.existsSync(config.mockDataDir)) {
    return undefined
  }

  const registryPath = mockRegistryPath(config)
  // 防手改：注册表被手动修改过时保留原文件，不再覆盖。
  if (!isGeneratedFile(registryPath)) {
    return registryPath
  }

  const mockFiles = await fg(['**/mock.{ts,tsx,js,jsx}'], {
    cwd: config.mockDataDir,
    onlyFiles: true,
    ignore: ['mock.ts', 'mock.tsx', 'mock.js', 'mock.jsx', '**/components/**']
  })
  // JSON mock 统一收在各模板目录的 data/ 子目录中，避免与 index.tsx 混在同一层。
  const jsonFiles = await fg(['**/data/*.json'], {
    cwd: config.mockDataDir,
    onlyFiles: true,
    ignore: ['**/components/**']
  })

  ensureParentDir(registryPath)
  const exports = sortedBy(mockFiles, (left, right) => left.localeCompare(right)).map(
    (file) => `export * from '${relativeModulePath(registryPath, path.join(config.mockDataDir, file))}'`
  )
  // 按模板路由聚合 JSON 文件名（去掉 data/ 段），面板据此展示可编辑的数据清单。
  const manifest = sortedBy(jsonFiles, (left, right) => left.localeCompare(right)).reduce<Record<string, string[]>>((acc, file) => {
    const route = normalizePath(path.dirname(path.dirname(file)))
    const name = path.basename(file)
    acc[route] = [...(acc[route] ?? []), name]
    return acc
  }, {})
  const manifestItems = Object.entries(manifest).map(([route, files]) => `  '${route}': [${files.map((file) => `'${file}'`).join(', ')}]`)
  // 拼装注册表内容：生成头 + TS mock 统一 re-export + mockDataFiles 清单。
  const content = `${generatedHeader}
${generatedNotice}
${exports.join('\n')}

export const mockDataFiles = {
${manifestItems.join(',\n')}
} as const
`
  fs.writeFileSync(registryPath, content, 'utf-8')
  return registryPath
}

/**
 * 同步全部约定产物，ktr sync/dev/build 都会调用这里。
 * @param config 已解析的 ktr 配置。
 * @returns 模板注册表的同步结果。
 */
export const ensureConventions = async (config: ResolvedKtrConfig): Promise<TemplateRegistryResult> => {
  const result = await ensureTemplateRegistry(config)
  await ensureMockRegistry(config)
  return result
}
