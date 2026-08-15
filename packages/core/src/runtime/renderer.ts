import fs from 'node:fs'
import path from 'node:path'

import React from 'react'
import { renderToReadableStream } from 'react-dom/server'

import type { DataOf, RenderContext, RenderContextInput, RendererOptions, RenderResult, TemplateDef } from '../types'
import { saveCapturedData } from './capture'
import { HtmlWrapper } from './html-wrapper'
import { PluginContainer } from './plugins'

/**
 * 合并调用方传入的局部上下文。框架不发明默认主题色：
 * 只保留调用方显式提供的 theme 字段，缺省时组件库自身主题生效。
 * @param ctx 调用方可选的局部上下文覆盖。
 * @returns 合并后的渲染上下文。
 */
const mergeContext = (ctx?: RenderContextInput): RenderContext => {
  const merged: RenderContext = {
    scale: 1,
    ...ctx
  }
  if (ctx?.theme) {
    merged.theme = { ...ctx.theme }
  }
  return merged
}

/**
 * 把模板路由转换成安全文件名。
 * @param templatePath 模板路由。
 * @returns 只含字母、数字、_ . - 的文件名主干。
 */
const safeFileStem = (templatePath: string): string => templatePath.replace(/[/\\:]/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '_')

/**
 * 按 htmlFileName 选项解析输出 HTML 的文件名。
 * @param option RendererOptions 的 htmlFileName 配置，未传时按 'fixed' 处理。
 * @param templatePath 模板路由。
 * @returns 含 .html 扩展名的输出文件名。
 */
const resolveHtmlFileName = (option: RendererOptions['htmlFileName'], templatePath: string): string => {
  // 函数形式完全自定义，返回值是不含扩展名的文件主名。
  if (typeof option === 'function') {
    return `${option(templatePath)}.html`
  }
  // 'timestamp' 保留旧的 Date.now() 随机命名，适合并发渲染同一模板的场景。
  if (option === 'timestamp') {
    return `${safeFileStem(templatePath)}_${Date.now()}.html`
  }
  // 默认 'fixed'：每个模板固定一个 HTML 文件覆盖写，输出目录不再随机堆积。
  return `${safeFileStem(templatePath)}.html`
}

/**
 * 只有显式传入 captureDir 才捕获；未传时仅开发环境默认捕获到 ktr/template/。
 * @param captureDir 捕获目录，可能未配置。
 * @returns 需要捕获时返回 true。
 */
const shouldCapture = (captureDir: string | undefined): captureDir is string => {
  return captureDir !== undefined
}

/** 负责把注册表中的 React 模板渲染成独立 HTML 文件。 */
// 约束用映射形式而非 AnyRegistry：模块增强后的精确注册表接口没有索引签名，但每个已知键都是 TemplateDef。
class SSRRenderer<R extends Record<keyof R, TemplateDef<any>>> {
  private readonly templates: R
  private readonly options: RendererOptions
  private readonly htmlWrapper: HtmlWrapper
  private readonly pluginContainer: PluginContainer

  /**
   * @param templates 约定扫描生成的模板注册表。
   * @param options 渲染器初始化选项。
   */
  constructor(templates: R, options: RendererOptions) {
    this.templates = templates
    this.options = options
    this.htmlWrapper = new HtmlWrapper({
      ...(options.cssPath ? { cssPath: options.cssPath } : {}),
      ...(options.cssText ? { cssText: options.cssText } : {}),
      extraStylePaths: options.extraStylePaths ?? [],
      headExtra: options.html?.headExtra ?? ''
    })
    this.pluginContainer = new PluginContainer(options.plugins ?? [])
  }

  /**
   * 渲染单个模板，并在成功后可选捕获本次真实数据。
   * @param templatePath 模板路由，必须是注册表中的键。
   * @param data 模板数据，类型由注册表推导。
   * @param ctx 可选的运行时上下文覆盖。
   * @returns 渲染结果，失败时 error 带原因。
   */
  async render<K extends keyof R & string>(templatePath: K, data: DataOf<R[K]>, ctx?: RenderContextInput): Promise<RenderResult> {
    try {
      const template = this.templates[templatePath]
      if (!template) {
        throw new Error(`Template is not registered: ${templatePath}`)
      }

      // 模板自带 validate 时先校验数据，避免把脏数据渲染进截图。
      if (template.validate && !template.validate(data)) {
        throw new Error(`Template data validation failed: ${templatePath}`)
      }

      const renderContext = mergeContext(ctx)

      const pluginContext = {
        path: templatePath,
        data,
        ctx: renderContext,
        outputDir: this.options.outputDir
      }

      await this.pluginContainer.runBefore(pluginContext)

      const element = React.createElement(template.component, {
        data,
        ctx: renderContext
      })
      // React 流式 SSR：先创建 ReadableStream，等 allReady 后一次性读出完整 HTML。
      const stream = await renderToReadableStream(element)
      await stream.allReady
      const htmlContent = await new Response(stream).text()
      // afterRender 插件串行传递 HTML，可在写文件前统一加工片段。
      const html = await this.pluginContainer.runAfter({ ...pluginContext, html: htmlContent })

      fs.mkdirSync(this.options.outputDir, { recursive: true })
      const htmlPath = path.join(this.options.outputDir, resolveHtmlFileName(this.options.htmlFileName, templatePath))
      const fullHtml = this.htmlWrapper.wrapContent(html, renderContext)
      fs.writeFileSync(htmlPath, fullHtml, 'utf-8')

      // 捕获触发条件：显式配置了 captureDir，或开发环境下默认捕获到 ktr/template/ 目录。
      const captureDir = this.options.captureDir ?? (process.env.NODE_ENV === 'development' ? path.resolve('ktr/template') : undefined)
      if (shouldCapture(captureDir)) {
        // data 与 renderContext 都可能被 beforeRender 插件加工过，捕获的是加工后的完整快照。
        saveCapturedData(captureDir, templatePath, data, renderContext)
      }

      return {
        success: true,
        htmlPath
      }
    } catch (error) {
      return {
        success: false,
        htmlPath: '',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * 创建类型安全的模板渲染函数，模板路径和 data 类型都来自注册表。
 * @param templates 约定扫描生成的模板注册表。
 * @param options 渲染器初始化选项。
 * @returns 类型安全的 render 函数。
 */
export const createRenderer = <R extends Record<keyof R, TemplateDef<any>>>(templates: R, options: RendererOptions) => {
  const renderer = new SSRRenderer(templates, options)

  return async <K extends keyof R & string>(templatePath: K, data: DataOf<R[K]>, ctx?: RenderContextInput): Promise<RenderResult> => {
    return renderer.render(templatePath, data, ctx)
  }
}
