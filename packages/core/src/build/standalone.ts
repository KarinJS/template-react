import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import consola from 'consola'
import fg from 'fast-glob'
import { build, mergeConfig, type Alias, type AliasOptions, type InlineConfig } from 'vite'

import { resolveKtrViteConfig } from '../config/vite'
import { discoverTemplateRoutes, ensureConventions } from '../conventions/registry'
import { tailwindCssAlias } from '../tailwind'
import type { ResolvedKtrConfig, StandaloneBuildResult } from '../types'
import { HtmlWrapper } from '../runtime/html-wrapper'
import { buildTemplates } from './index'

const generatedHeader = '// 此文件由 @karinjs/template-react 自动生成，请不要手动修改。'

/** 从当前 core 安装位置解析出可供独立入口打包的 core runtime。 */
const resolveCoreRuntimeEntry = (): string => {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let index = 0; index < 10; index += 1) {
    const packagePath = path.join(dir, 'package.json')
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { name?: string }
        if (pkg.name === '@karinjs/template-react') {
          const sourceEntry = path.join(dir, 'src', 'index.ts')
          return fs.existsSync(sourceEntry) ? sourceEntry : path.join(dir, 'dist', 'index.mjs')
        }
      } catch {
        // 继续向上查找包根。
      }
    }

    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  throw new Error('[ktr] 无法定位 @karinjs/template-react runtime 入口。')
}

const normalizePath = (value: string): string => value.replace(/\\/g, '/')

const stripExtension = (value: string): string => value.replace(/\.[cm]?[jt]sx?$/, '')

const relativeModulePath = (fromFile: string, toFile: string): string => {
  const relative = normalizePath(path.relative(path.dirname(fromFile), stripExtension(toFile)))
  return relative.startsWith('.') ? relative : `./${relative}`
}

const toImportName = (routePath: string, index: number): string => {
  const safeName = routePath.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^([^a-zA-Z_$])/, '_$1')
  return safeName ? `template_${safeName}` : `template_${index}`
}

/** 生成独立入口，同时让 TypeScript 在构建前验证每个模板的数据类型。 */
const generateStandaloneEntry = (config: ResolvedKtrConfig, routes: Array<{ file: string; route: string }>, cssText: string): string => {
  const entryPath = path.join(config.cacheDir, 'standalone-entry.ts')
  const imports = routes.map((item, index) => {
    const source = path.join(config.templateDir, item.file)
    return `import ${toImportName(item.route, index)} from '${relativeModulePath(entryPath, source)}'`
  })
  const registryItems = routes.map((item, index) => `  '${item.route}': ${toImportName(item.route, index)}`)
  const dataItems = routes.map((item, index) => `  '${item.route}': DataOf<typeof ${toImportName(item.route, index)}>`)
  const typeChecks = routes.map(
    (item) => `type __KtrTypeCheck_${toImportName(item.route, 0)} = __KtrAssert<__KtrIsTyped<TemplateDataMap['${item.route}']>>`
  )
  const content = `${generatedHeader}
import { fileURLToPath } from 'node:url'
import { createRenderer } from '@karinjs/template-react'
import type { DataOf, RenderContextInput, RenderResult, RendererOptions } from '@karinjs/template-react'
${imports.join('\n')}

const templates = {
${registryItems.join(',\n')}
}

type TemplateDataMap = {
${dataItems.join(',\n')}
}

type __KtrIsAny<T> = 0 extends 1 & T ? true : false
type __KtrIsUnknown<T> = __KtrIsAny<T> extends true ? false : unknown extends T ? ([keyof T] extends [never] ? true : false) : false
type __KtrIsNever<T> = [T] extends [never] ? true : false
type __KtrIsTyped<T> = __KtrIsAny<T> extends true
  ? false
  : __KtrIsUnknown<T> extends true
    ? false
    : __KtrIsNever<T> extends true
      ? false
      : true
type __KtrAssert<T extends true> = T
${typeChecks.join('\n')}

export type StandaloneRendererOptions = Omit<Partial<RendererOptions>, 'cssPath' | 'cssText'>
export type TemplatePath = keyof TemplateDataMap & string
export type TemplateData<K extends TemplatePath> = TemplateDataMap[K]
export type TemplateRenderFn = <K extends TemplatePath>(
  templatePath: K,
  data: TemplateData<K>,
  ctx?: RenderContextInput
) => Promise<RenderResult>

const embeddedCss = ${JSON.stringify(cssText)}
const embeddedHeadExtra = ${JSON.stringify(config.html.headExtra)}
const defaultOutputDir = fileURLToPath(new URL('./html/', import.meta.url))

export const createTemplateRenderer = (options: StandaloneRendererOptions = {}): TemplateRenderFn => {
  const renderer = createRenderer(templates, {
    ...options,
    cssText: embeddedCss,
    outputDir: options.outputDir ?? defaultOutputDir,
    html: {
      headExtra: embeddedHeadExtra,
      ...options.html
    }
  })
  return renderer as TemplateRenderFn
}

export const renderTemplate: TemplateRenderFn = createTemplateRenderer()
`

  fs.mkdirSync(path.dirname(entryPath), { recursive: true })
  fs.writeFileSync(entryPath, content, 'utf8')
  return entryPath
}

/** 生成与独立 ESM 入口并列的精确声明文件。 */
const generateStandaloneTypes = (config: ResolvedKtrConfig, routes: Array<{ file: string; route: string }>, typesPath: string): void => {
  const registryItems = routes.map((item) => {
    const source = path.join(config.templateDir, item.file)
    return `  '${item.route}': typeof import('${relativeModulePath(typesPath, source)}').default`
  })
  const content = `${generatedHeader}
import type { DataOf, RenderContextInput, RendererOptions, RenderResult } from '@karinjs/template-react'

interface TemplateRegistry {
${registryItems.join('\n')}
}

export type TemplatePath = keyof TemplateRegistry & string
export type TemplateDataMap = {
  [K in TemplatePath]: DataOf<TemplateRegistry[K]>
}
export type TemplateData<K extends TemplatePath> = TemplateDataMap[K]
export type StandaloneRendererOptions = Omit<Partial<RendererOptions>, 'cssPath' | 'cssText'>
export type TemplateRenderFn = <K extends TemplatePath>(
  templatePath: K,
  data: TemplateData<K>,
  ctx?: RenderContextInput
) => Promise<RenderResult>

export declare const createTemplateRenderer: (options?: StandaloneRendererOptions) => TemplateRenderFn
export declare const renderTemplate: TemplateRenderFn
`
  fs.mkdirSync(path.dirname(typesPath), { recursive: true })
  fs.writeFileSync(typesPath, content, 'utf8')
}

/** 从下游项目解析 TypeScript，独立构建强制要求模板项目具备 TS 工具链。 */
const loadTypeScript = async (root: string): Promise<typeof import('typescript')> => {
  const candidates = [path.join(root, 'package.json'), path.join(path.dirname(fileURLToPath(import.meta.url)), '../../package.json')]
  const resolved = candidates
    .map((packagePath) => {
      try {
        return createRequire(packagePath).resolve('typescript')
      } catch {
        return undefined
      }
    })
    .find((item): item is string => Boolean(item))

  if (resolved) {
    try {
      const module = await import(pathToFileURL(resolved).href)
      return (module.default ?? module) as typeof import('typescript')
    } catch {
      // 统一落到下方的依赖提示。
    }
  }
  throw new Error('[ktr] ktr build 需要 TypeScript，请先在下游项目安装 typescript。')
}

/** 对生成入口运行严格类型检查。 */
const typecheckStandaloneEntry = async (root: string, entryPath: string): Promise<void> => {
  const ts = await loadTypeScript(root)
  const coreRuntimeEntry = resolveCoreRuntimeEntry()
  const diagnosticsHost: import('typescript').FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
  }
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')
  let compilerOptions: import('typescript').CompilerOptions = {}

  if (configPath) {
    const read = ts.readConfigFile(configPath, ts.sys.readFile)
    if (read.error) {
      throw new Error(ts.formatDiagnosticsWithColorAndContext([read.error], diagnosticsHost))
    }
    compilerOptions = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath), undefined, configPath).options
  }

  compilerOptions = {
    ...compilerOptions,
    noEmit: true,
    strict: true,
    noImplicitAny: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    skipLibCheck: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true
  }

  if (coreRuntimeEntry.endsWith('.ts')) {
    compilerOptions.paths = {
      ...compilerOptions.paths,
      '@karinjs/template-react': [normalizePath(coreRuntimeEntry)]
    }
  }

  const program = ts.createProgram([entryPath], compilerOptions)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticsHost))
  }
}

const inlineCss = (cssPath: string, extraStylePaths: string[]): string => {
  const wrapper = new HtmlWrapper({})
  return [cssPath, ...extraStylePaths]
    .map((filePath) => wrapper.loadInlineCss(filePath))
    .filter(Boolean)
    .join('\n')
}

/** 复制独立产物需要的静态资源。 */
const copyStandaloneAssets = async (config: ResolvedKtrConfig): Promise<void> => {
  if (!config.copyAssets || !fs.existsSync(config.assetsDir)) return
  const files = await fg('**/*', { cwd: config.assetsDir, onlyFiles: true, dot: true })
  for (const file of files) {
    const target = path.join(config.standalone.outDir, 'assets', file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(config.assetsDir, file), target)
  }
}

const normalizeAliases = (alias: AliasOptions | undefined): Alias[] => {
  if (!alias) return []
  if (Array.isArray(alias)) return [...alias]
  return Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))
}

const isAllowedExternal = (specifier: string, external: string[]): boolean => {
  if (specifier.startsWith('node:') || builtinModules.includes(specifier)) return true
  return external.some((item) => specifier === item || specifier.startsWith(`${item}/`))
}

/** 用 Vite SSR/Rolldown 将生成入口打成可直接被 Node import 的单一 ESM。 */
const bundleStandaloneEntry = async (config: ResolvedKtrConfig, entryPath: string): Promise<void> => {
  const coreRuntimeEntry = resolveCoreRuntimeEntry()
  const userViteConfig = await resolveKtrViteConfig(config, 'build', 'production')
  const baseConfig: InlineConfig = {
    root: config.root,
    configFile: false,
    publicDir: false,
    clearScreen: false,
    resolve: {
      alias: [{ find: /^@karinjs\/template-react$/, replacement: coreRuntimeEntry }, tailwindCssAlias],
      dedupe: ['react', 'react-dom']
    },
    ssr: {
      target: 'node',
      noExternal: true,
      external: config.standalone.external
    },
    build: {
      target: config.standalone.target,
      outDir: config.standalone.outDir,
      emptyOutDir: true,
      minify: config.standalone.minify,
      sourcemap: config.standalone.sourcemap,
      ssr: entryPath,
      copyPublicDir: false,
      rollupOptions: {
        input: entryPath,
        output: {
          format: 'es',
          entryFileNames: 'index.mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
          assetFileNames: 'assets/[name]-[hash][extname]',
          codeSplitting: !config.standalone.singleChunk
        }
      }
    }
  }

  const merged = mergeConfig(baseConfig, userViteConfig)
  const userAliases = normalizeAliases(userViteConfig.resolve?.alias)
  merged.resolve = {
    ...merged.resolve,
    alias: [{ find: /^@karinjs\/template-react$/, replacement: coreRuntimeEntry }, tailwindCssAlias, ...userAliases],
    dedupe: [...new Set([...(merged.resolve?.dedupe ?? []), 'react', 'react-dom'])]
  }
  merged.ssr = {
    ...(typeof merged.ssr === 'object' ? merged.ssr : {}),
    target: 'node',
    noExternal: true,
    external: config.standalone.external
  }
  merged.build = {
    ...merged.build,
    target: config.standalone.target,
    outDir: config.standalone.outDir,
    emptyOutDir: true,
    minify: config.standalone.minify,
    sourcemap: config.standalone.sourcemap,
    ssr: entryPath,
    copyPublicDir: false,
    rollupOptions: {
      ...merged.build?.rollupOptions,
      input: entryPath,
      output: {
        ...merged.build?.rollupOptions?.output,
        format: 'es',
        entryFileNames: 'index.mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        assetFileNames: 'assets/[name]-[hash][extname]',
        codeSplitting: !config.standalone.singleChunk
      }
    }
  }

  const result = await build(merged)
  const bundles = Array.isArray(result) ? result : [result]
  const outputs = bundles.flatMap((bundle) => (bundle as unknown as { output?: unknown[] }).output ?? []) as Array<{
    type?: string
    imports?: string[]
    dynamicImports?: string[]
    fileName?: string
  }>
  const chunks = outputs.filter((item) => item.type === 'chunk')
  if (config.standalone.singleChunk && chunks.length !== 1) {
    throw new Error(`[ktr] 独立构建要求单一 JavaScript chunk，实际生成 ${chunks.length} 个。请移除模板中的动态 import。`)
  }

  const externalImports = chunks.flatMap((chunk) => (chunk.imports ?? []).concat(chunk.dynamicImports ?? []))
  const unexpected = externalImports.filter((specifier) => !isAllowedExternal(specifier, config.standalone.external))
  if (unexpected.length > 0) {
    throw new Error(`[ktr] 独立产物包含未声明的外部依赖：${[...new Set(unexpected)].join(', ')}`)
  }
}

/** 执行完整的 ktr 独立模板构建。 */
export const buildStandalone = async (config: ResolvedKtrConfig): Promise<StandaloneBuildResult> => {
  if (config.standalone.format !== 'esm') {
    throw new Error('[ktr] 当前独立构建只支持 ESM。')
  }

  const routes = await discoverTemplateRoutes(config.templateDir)
  if (routes.length === 0) {
    throw new Error(`[ktr] 未找到模板：${config.templateDir}（只扫描 **/index.tsx）`)
  }

  await ensureConventions(config)

  const cssBuildDir = path.join(config.cacheDir, 'standalone-css')
  fs.rmSync(cssBuildDir, { recursive: true, force: true })
  const cssResult = await buildTemplates({ root: config.root, outDir: cssBuildDir, copyAssets: false })
  const cssText = inlineCss(cssResult.cssPath, config.extraStylePaths)
  const entryPath = generateStandaloneEntry(config, routes, cssText)
  const typesPath = path.join(config.standalone.outDir, 'index.d.mts')

  await typecheckStandaloneEntry(config.root, entryPath)
  await bundleStandaloneEntry(config, entryPath)
  generateStandaloneTypes(config, routes, typesPath)
  await copyStandaloneAssets(config)
  fs.rmSync(cssBuildDir, { recursive: true, force: true })

  const entryOutputPath = path.join(config.standalone.outDir, 'index.mjs')
  if (!fs.existsSync(entryOutputPath)) {
    throw new Error(`[ktr] 独立构建完成但找不到入口：${entryOutputPath}`)
  }

  consola.success(`独立模板运行包已生成：${entryOutputPath}`)
  return {
    outDir: config.standalone.outDir,
    entryPath: entryOutputPath,
    typesPath,
    templatesCount: routes.length,
    cssSize: Buffer.byteLength(cssText)
  }
}
