import fs from 'node:fs'
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import fg from 'fast-glob'
import { build, mergeConfig, type InlineConfig } from 'vite'

import { resolveConfig } from '../config'
import { resolveKtrViteConfig } from '../config/vite'
import { ensureCssEntry } from '../conventions/css-entry'
import type { KtrConfig } from '../types'
import { ensureConventions } from '../conventions/registry'
import { tailwindCssAlias } from '../tailwind'
import type { BuildTemplatesOptions, BuildTemplatesResult, ResolvedKtrConfig } from '../types'

/**
 * 复制下游资源目录，保证生产环境截图能访问图片等静态文件。
 * @param config 已解析的 ktr 配置。
 * @returns 无返回值。
 */
const copyAssets = async (config: ResolvedKtrConfig): Promise<void> => {
  if (!fs.existsSync(config.assetsDir)) {
    return
  }

  const files = await fg('**/*', {
    cwd: config.assetsDir,
    onlyFiles: true,
    dot: true
  })

  for (const file of files) {
    const source = path.join(config.assetsDir, file)
    const target = path.join(config.outDir, 'assets', file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(source, target)
  }
}

/**
 * 统计约定扫描到的模板数量，只数 <板块>/<模板>/index.tsx 强约定文件。
 * @param templatesDir 模板根目录。
 * @returns 模板文件数量。
 */
const countTemplates = async (templatesDir: string): Promise<number> => {
  if (!fs.existsSync(templatesDir)) {
    return 0
  }

  const files = await fg(['**/index.{tsx,jsx}'], {
    cwd: templatesDir,
    onlyFiles: true,
    ignore: ['**/_*/**', '**/components/**']
  })
  return files.length
}

/**
 * 构建模板样式，并在构建前刷新 .ktr 自动注册缓存。
 * @param options 可覆盖任意已解析配置的构建选项。
 * @returns 构建产物统计。
 */
export const buildTemplates = async (options: BuildTemplatesOptions = {}): Promise<BuildTemplatesResult> => {
  // 对外是扁平的已解析字段（Partial<ResolvedKtrConfig>），这里翻译成嵌套的 dir 覆盖项。
  const dirOverrides: NonNullable<KtrConfig['dir']> = {}
  if (options.templateDir !== undefined) dirOverrides.template = options.templateDir
  if (options.cacheDir !== undefined) dirOverrides.cache = options.cacheDir
  if (options.mockDataDir !== undefined) dirOverrides.mockData = options.mockDataDir
  if (options.assetsDir !== undefined) dirOverrides.assets = options.assetsDir
  if (options.outDir !== undefined) dirOverrides.out = options.outDir
  if (options.cssEntry !== undefined) dirOverrides.cssEntry = options.cssEntry

  const overrides: KtrConfig = {
    ...(Object.keys(dirOverrides).length > 0 ? { dir: dirOverrides } : {}),
    ...(options.extraStylePaths ? { extraStylePaths: options.extraStylePaths } : {}),
    ...(options.dev ? { dev: options.dev } : {}),
    ...(options.html ? { html: options.html } : {}),
    ...(options.vite ? { vite: options.vite } : {})
  }

  const resolveOptions = options.root ? { cwd: options.root, overrides } : { overrides }
  const config = await resolveConfig(resolveOptions)
  await ensureConventions(config)
  const cssEntry = ensureCssEntry(config)
  const outputCssPath = path.join(config.outDir, 'style.css')
  fs.mkdirSync(config.outDir, { recursive: true })

  // 手法：写一个只含 <link> 的临时 HTML 作为构建入口，让 Vite 把 Tailwind 编译产物当静态资源输出。
  const tempEntry = path.join(config.outDir, '.ktr-css-entry.html')
  const relativeCssEntry = path.relative(config.outDir, cssEntry).replace(/\\/g, '/')
  fs.writeFileSync(tempEntry, `<link rel="stylesheet" href="${relativeCssEntry}">`, 'utf-8')

  const baseConfig: InlineConfig = {
    root: config.root,
    // 不加载下游项目自己的 vite.config.ts（那是生产打包配置），扩展统一走 karin.template.ts 的 vite 字段。
    configFile: false,
    logLevel: 'silent',
    plugins: [tailwindcss()],
    resolve: {
      alias: [tailwindCssAlias]
    },
    build: {
      emptyOutDir: false,
      rollupOptions: {
        input: tempEntry,
        output: {
          // CSS 产物固定命名为 style.css，其余资源走带 hash 的 assets 目录。
          assetFileNames: (assetInfo) => (assetInfo.name?.endsWith('.css') ? 'style.css' : 'assets/[name]-[hash][extname]'),
          entryFileNames: 'assets/[name].js'
        }
      },
      outDir: config.outDir,
      minify: false
    }
  }

  // 用户 karin.template.ts 的 vite 字段在这里合并，是下游的构建扩展位。
  await build(mergeConfig(baseConfig, await resolveKtrViteConfig(config, 'build', 'production')))

  // 临时入口只在构建期间存在，结束后立即清理，不污染产物目录。
  if (fs.existsSync(tempEntry)) {
    fs.unlinkSync(tempEntry)
  }

  // vite 会把 html 入口按 root 相对路径再 emit 一份到产物目录
  //（如 lib/lib/.ktr-css-entry.html），连同产生的空目录链一并清掉。
  const emittedEntry = path.join(config.outDir, path.relative(config.root, tempEntry))
  if (fs.existsSync(emittedEntry)) {
    fs.unlinkSync(emittedEntry)
    let dir = path.dirname(emittedEntry)
    while (dir !== config.outDir && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir)
      dir = path.dirname(dir)
    }
  }

  await copyAssets(config)

  const cssSize = fs.existsSync(outputCssPath) ? fs.statSync(outputCssPath).size : 0
  const templatesCount = await countTemplates(config.templateDir)
  console.log(`[ktr] 已构建 ${templatesCount} 个模板，CSS ${cssSize} 字节 -> ${outputCssPath}`)

  return {
    cssPath: outputCssPath,
    templatesCount,
    cssSize
  }
}
