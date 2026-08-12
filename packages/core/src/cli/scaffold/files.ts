import { templateCssEntryContent } from '../../conventions/css-entry'

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
// 模板、mock 和 JSON 数据全部按 template/ 目录约定自动发现，不需要手写清单。
export default defineConfig({
  dev: {
    port: ${port},
    host: 'localhost',
    open: true
  }
})
`

/** 示例模板组件。 */
const exampleTemplate = (): string => `import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 卡片模板的数据结构。 */
export interface HelloCardData {
  /** 主标题。 */
  title: string
  /** 副标题。 */
  subtitle?: string
  /** 键值对列表。 */
  items: Array<{ label: string; value: string }>
}

/**
 * 示例模板：用 HeroUI 的语义色 token 写样式，改主题时会自动跟随。
 * 圆角写在根元素上（截图边界由 ktr 外壳的 #container 提供，它不加任何外观）。
 */
const HelloCard = ({ data }: TemplateProps<HelloCardData>) => (
  <div className="w-155 overflow-hidden rounded-2xl bg-background p-8 text-foreground">
    <h1 className="text-3xl font-bold">{data.title}</h1>
    {data.subtitle && <p className="mt-2 text-sm text-muted">{data.subtitle}</p>}

    <div className="mt-6 grid gap-3">
      {data.items.map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
          <span className="text-sm text-muted">{item.label}</span>
          <strong className="text-accent">{item.value}</strong>
        </div>
      ))}
    </div>
  </div>
)

export default defineTemplate({
  name: '问候卡片',
  description: '我的第一个 React 截图模板',
  component: HelloCard
})
`

/** 示例模板的 JSON 数据。 */
const exampleData = (): string => `${JSON.stringify(
  {
    title: '我的第一张卡片',
    subtitle: 'React + Tailwind CSS',
    items: [
      { label: '框架', value: '@karinjs/template-react' },
      { label: '渲染', value: 'SSR HTML' }
    ]
  },
  null,
  2
)}
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
    { path: 'template/style.css', content: templateCssEntryContent(options.style === 'custom') }
  ]

  if (options.withExample) {
    files.push(
      { path: 'template/hello/card/index.tsx', content: exampleTemplate() },
      { path: 'template/hello/card/data/default.json', content: exampleData() }
    )
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
  'template:build': 'ktr build --outDir lib'
}
