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
import { tailwindCssAlias, tailwindSourceScopePlugin } from '../tailwind'
import type { BuildTemplatesOptions, BuildTemplatesOutput, BuildTemplatesResult, ResolvedKtrConfig } from '../types'

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

  const files = await fg(['**/index.tsx'], {
    cwd: templatesDir,
    onlyFiles: true,
    ignore: ['**/_*/**', '**/components/**']
  })
  return files.length
}

/** 删除 CSS 构建入口以及旧版本遗留的 HTML 入口和空目录。 */
const cleanupCssEntries = async (root: string, outDir: string, tempEntry: string): Promise<void> => {
  const entries = new Set([tempEntry])
  const legacyEntry = path.resolve(outDir, path.relative(root, path.join(outDir, '.ktr-css-entry.html')))
  const legacyRelative = path.relative(outDir, legacyEntry)
  if (legacyRelative && !legacyRelative.startsWith('..') && !path.isAbsolute(legacyRelative)) {
    entries.add(legacyEntry)
  }
  if (fs.existsSync(outDir)) {
    const generated = await fg(['**/.ktr-css-entry.html', '**/.ktr-css-entry.{js,mjs}'], {
      absolute: true,
      cwd: outDir,
      dot: true,
      onlyFiles: true
    })
    generated.forEach((filePath) => entries.add(filePath))
  }

  for (const filePath of entries) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    let dir = path.dirname(filePath)
    let relativeDir = path.relative(outDir, dir)
    while (
      relativeDir &&
      !relativeDir.startsWith('..') &&
      !path.isAbsolute(relativeDir) &&
      fs.existsSync(dir) &&
      fs.readdirSync(dir).length === 0
    ) {
      fs.rmdirSync(dir)
      dir = path.dirname(dir)
      relativeDir = path.relative(outDir, dir)
    }
  }
}

/**
 * 构建模板样式，并在构建前刷新 .ktr 自动注册缓存。
 * @param options 可覆盖任意已解析配置的构建选项。
 * @returns 构建产物统计。
 */
export const buildTemplates = async (options: BuildTemplatesOptions = {}): Promise<BuildTemplatesResult> => {
  // 对外是扁平的已解析字段（Partial<ResolvedKtrConfig>），可配的翻译成嵌套的 dir 覆盖项。
  const dirOverrides: NonNullable<KtrConfig['dir']> = {}
  if (options.templateDir !== undefined) dirOverrides.template = options.templateDir
  if (options.assetsDir !== undefined) dirOverrides.assets = options.assetsDir
  if (options.copyAssets !== undefined) dirOverrides.copyAssets = options.copyAssets
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
  // 产物目录固定 dist/template，但内部调用方（dev 缓存、构建插件）可以显式指定落盘位置。
  if (options.outDir !== undefined) {
    config.outDir = path.isAbsolute(options.outDir) ? options.outDir : path.resolve(config.root, options.outDir)
  }
  // write: false 时产物不落盘（供打包器插件 emit 进外层 bundle），也不打印独立日志行。
  const write = options.write !== false
  await ensureConventions(config)
  const cssEntry = ensureCssEntry(config)
  const outputCssPath = path.join(config.outDir, 'style.css')
  fs.mkdirSync(config.outDir, { recursive: true })

  // 用临时 JS import 触发 Vite/Tailwind 编译 CSS，避免 HTML 入口被复制进产物并生成额外目录层级。
  const tempEntry = path.join(config.outDir, '.ktr-css-entry.mjs')
  const relativeCssEntry = path.relative(path.dirname(tempEntry), cssEntry).replace(/\\/g, '/')
  const cssImportPath = relativeCssEntry.startsWith('.') ? relativeCssEntry : `./${relativeCssEntry}`
  fs.writeFileSync(tempEntry, `import ${JSON.stringify(cssImportPath)}\n`, 'utf-8')

  const baseConfig: InlineConfig = {
    root: config.root,
    // 不加载下游项目自己的 vite.config.ts（那是生产打包配置），扩展统一走 karin.template.ts 的 vite 字段。
    configFile: false,
    logLevel: 'silent',
    plugins: [
      tailwindSourceScopePlugin(cssEntry),
      tailwindcss(),
      {
        name: 'ktr-css-entry-cleanup',
        generateBundle(_options, bundle) {
          for (const [fileName, output] of Object.entries(bundle)) {
            if (output.type === 'chunk' && output.facadeModuleId && path.resolve(output.facadeModuleId) === path.resolve(tempEntry)) {
              delete bundle[fileName]
            }
          }
        }
      }
    ],
    resolve: {
      alias: [tailwindCssAlias]
    },
    build: {
      emptyOutDir: false,
      write,
      rollupOptions: {
        input: tempEntry,
        output: {
          // CSS 产物固定命名为 style.css，其余资源走带 hash 的 assets 目录。
          assetFileNames: (assetInfo) => (assetInfo.name?.endsWith('.css') ? 'style.css' : 'assets/[name]-[hash][extname]'),
          entryFileNames: '.ktr-css-entry.js'
        }
      },
      outDir: config.outDir,
      minify: false
    }
  }

  const outputs: BuildTemplatesOutput[] = []
  let cssSize = 0
  try {
    // 用户 karin.template.ts 的 vite 字段在这里合并，是下游的构建扩展位。
    const built = await build(mergeConfig(baseConfig, await resolveKtrViteConfig(config, 'build', 'production')))
    if (write) {
      cssSize = fs.existsSync(outputCssPath) ? fs.statSync(outputCssPath).size : 0
    } else {
      // write: false 时 build 返回内存中的 bundle，收集全部 asset（style.css 及其引用的 hash 资源）。
      const rollupOutputs = (Array.isArray(built) ? built : [built]).flatMap((item) => ('output' in item ? item.output : []))
      for (const item of rollupOutputs) {
        if (item.type !== 'asset') continue
        outputs.push({ fileName: item.fileName, source: item.source })
        if (item.fileName === path.basename(outputCssPath)) {
          cssSize = typeof item.source === 'string' ? Buffer.byteLength(item.source) : item.source.byteLength
        }
      }
    }
  } finally {
    await cleanupCssEntries(config.root, config.outDir, tempEntry)
  }

  // 资源目录已随包发布在固定位置时可以关掉复制（dir.copyAssets: false），避免重复打包。
  if (config.copyAssets) {
    await copyAssets(config)
  }

  const templatesCount = await countTemplates(config.templateDir)
  if (write) {
    console.log(`[ktr] 已构建 ${templatesCount} 个模板，CSS ${cssSize} 字节 -> ${outputCssPath}`)
  }

  return {
    cssPath: outputCssPath,
    templatesCount,
    cssSize,
    outputs
  }
}
