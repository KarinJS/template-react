import { templateCssEntryContent } from '../../conventions/css-entry'

import { exampleTemplateFiles } from 'virtual:ktr-scaffold-examples'

/** 模板样式来源。 */
export type ScaffoldStyle = 'builtin' | 'custom'

/** 脚手架选项。 */
export interface ScaffoldOptions {
  /** 模板样式来源。 */
  style: ScaffoldStyle
  /** 是否生成示例模板。 */
  withExample: boolean
  /** 是否生成 Karin 胶水层。 */
  withGlue: boolean
  /** 开发面板端口。 */
  port: number
  /** 插件名，用于胶水层的输出目录和截图命名。 */
  pluginName: string
}

/** 一个待写入的脚手架文件。 */
export interface ScaffoldFile {
  /** 相对项目根目录的路径。 */
  path: string
  /** 文件内容。 */
  content: string
}

/** karin.template.ts 的内容。 */
const configFile = (port: number): string => `import { defineConfig } from '@karinjs/template-react'

// 这里只配置 @karinjs/template-react 自身行为；
// 模板、mock 和 JSON 数据全部按 ktr/template/ 目录约定自动发现，不需要手写清单。
export default defineConfig({
  dev: {
    port: ${port},
    host: 'localhost',
    open: true
  }
})
`

/** src/utils/render.ts 胶水层。 */
const glueFile = (pluginName: string): string => `import path from 'node:path'

import { karinPathHtml, render, segment, type ImageElement } from 'node-karin'
import { createTemplateRenderer, type DataOf, type LoadedRegistry } from '@karinjs/template-react'

// ktr 侧按约定装配（包根定位、配置解析、注册表加载、CSS 定位、捕获目录）；
// outputDir 是 karin 领域的位置，由插件显式指定。
const renderTemplate = createTemplateRenderer(import.meta.url, {
  renderer: { outputDir: path.join(karinPathHtml, '${pluginName}') }
})

/** 注册表类型：.ktr/registry-types.d.ts 模块增强生效后为逐路由精确类型。 */
type Registry = LoadedRegistry

/**
 * 渲染模板并交给 Karin Puppeteer 截图。
 * @param templatePath 模板路由，如 hello/card。
 * @param data 模板数据，类型由模板组件推导。
 * @param options 透传给 render.render 的额外截图参数。
 * @returns 可直接 reply 的图片消息元素。
 */
export const renderImage = async <K extends keyof Registry & string>(
  templatePath: K,
  data: DataOf<Registry[K]>,
  options?: Record<string, unknown>
): Promise<ImageElement[]> => {
  const { success, htmlPath, error } = await renderTemplate(templatePath, data)
  if (!success) {
    throw new Error(\`模板渲染失败 \${templatePath}：\${error}\`)
  }

  const result = await render.render({
    name: \`${pluginName}/\${templatePath}\`,
    file: htmlPath,
    selector: '#container',
    type: 'png',
    omitBackground: true,
    ...options
  })

  const list = Array.isArray(result) ? result : [result]
  return list.map((img) => segment.image(\`base64://\${img}\`))
}
`

/**
 * 计算脚手架要写入的全部文件，纯函数便于测试。
 * @param options 脚手架选项。
 * @returns 待写入的文件列表。
 */
export const scaffoldFiles = (options: ScaffoldOptions): ScaffoldFile[] => {
  const files: ScaffoldFile[] = [
    { path: 'karin.template.ts', content: configFile(options.port) },
    { path: 'ktr/template/style.css', content: templateCssEntryContent(options.style === 'custom') }
  ]

  if (options.withExample) {
    // 示例模板由构建插件从 packages/core/examples 扫描注入（虚拟模块，见 build/scaffold-examples.ts）。
    files.push(...exampleTemplateFiles)
  }

  if (options.withGlue) {
    files.push({ path: 'src/utils/render.ts', content: glueFile(options.pluginName) })
  }

  return files
}

/** 脚手架需要写入下游 package.json 的开发依赖。 */
export const scaffoldDevDependencies: Record<string, string> = {
  '@heroui/react': '^3.2.3',
  '@karinjs/template-react': 'latest',
  '@types/react': '^19.2.18',
  '@types/react-dom': '^19.2.4',
  '@vitejs/plugin-react': '^6.0.5',
  react: '^19.2.8',
  'react-dom': '^19.2.8'
}

/** 脚手架需要写入下游 package.json 的脚本。 */
export const scaffoldScripts: Record<string, string> = {
  template: 'ktr sync && ktr dev',
  'template:build': 'vite build'
}

/** withExample 时额外写入的开发依赖（示例模板用了 lucide 图标，版本与 packages/core 对齐）。 */
export const scaffoldExampleDependencies: Record<string, string> = {
  'lucide-react': '^1.28.0'
}
