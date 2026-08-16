# @karinjs/template-react

Karin 插件的 React 截图模板工具链：用 React + Tailwind CSS + TypeScript 编写"数据到图片"的模板，提供 SSR 渲染、开发面板、mock 数据管理和生产构建能力。文档与教程见 **[文档站](https://karinjs.github.io/template-react/)**。

## 安装

```bash
pnpm add @karinjs/template-react react react-dom
```

> [!IMPORTANT]
> 推荐把本包与 react 一起打进你的插件产物（tsdown 整包，渲染器与组件共享产物内同一份 React 副本，生产零安装）。只有在**外部引用**本包运行时的场景，才需要把 `react` / `react-dom` 装为直接依赖（hooks 依赖单例，两种模式不要混用）。

## 用法一览

```tsx title="ktr/template/hello/card/index.tsx —— 模板组件（目录即路由）"
import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

interface CardData {
  title: string
}

const Card = ({ data }: TemplateProps<CardData>) => <h1 className="text-3xl font-bold">{data.title}</h1>

export default defineTemplate({ name: '问候卡片', component: Card })
```

```ts title="src/utils/render.ts —— karin 胶水层"
import path from 'node:path'
import { karinPathHtml, render, segment } from 'node-karin'
import { createTemplateRenderer } from '@karinjs/template-react'

const renderTemplate = createTemplateRenderer(import.meta.url, {
  renderer: { outputDir: path.join(karinPathHtml, 'my-plugin') }
})

export const renderImage = async (templatePath, data, options) => {
  const { success, htmlPath, error } = await renderTemplate(templatePath, data)
  if (!success) throw new Error(error)
  const img = await render.render({ file: htmlPath, selector: '#container', type: 'png', omitBackground: true, ...options })
  return [segment.image(`base64://${img}`)]
}
```

## CLI

| 命令         | 说明                                                             |
| ------------ | ---------------------------------------------------------------- |
| `ktr create` | 新建一个模板项目（交互式脚手架，可选官方示例模板）               |
| `ktr init`   | 在当前项目里初始化模板开发环境（目录结构、配置文件、渲染胶水层） |
| `ktr dev`    | 启动开发面板（`--port` / `--host` / `--open` / `--no-open`）     |
| `ktr sync`   | 扫描 `ktr/template/`，在 `.ktr/` 生成注册表与类型增强声明        |
| `ktr build`  | 构建可被 Node.js 直接导入的独立模板运行包（不需要打包器时用）    |

已有打包流程时不需要单独的构建命令：在打包配置里挂 `ktrBuildPlugin()`（`@karinjs/template-react/plugin`），注册表同步和 CSS 编译随 `vite build` / `tsdown` 自动完成，产物目录跟随打包器的 outDir，`style.css` 作为 bundle asset 出现在打包器自己的输出列表里。

## 关键约定

- 模板组件必须写在 `ktr/template/<板块>/<模板>/index.tsx`；裸 `.tsx` 不注册。
- 子组件与逻辑文件放同目录 `components/`（不参与路由）；TS mock 固定为 `mock.ts`；JSON mock 放 `data/` 子目录。
- 静态资源放 `ktr/public/`，模板里用 `/xxx` 引用（等于 `ktr/public/xxx`）：dev 直接可访问，构建复制到产物 `assets/`，SSR 产出 HTML 时按 `html.assetsInlineLimit`（默认 4KB，语义同 Vite）自动内联为 base64 或转 `file://` 绝对路径——开发、打包、生产截图三态位置都正确。
- 组件根元素不要写 `id="container"`（截图边界由框架提供）；圆角用根元素 `rounded-*` 类（裁剪配 `overflow-hidden`）。
- 框架不注入默认主题色；深色模式读 `ctx.theme.mode`。
- 不要手动 import `.ktr/`——用 `@karinjs/template-react` 的 `loadTemplateRegistry()` / `loadMockRegistry()` 按约定加载。

更多内容（目录约定、mock 数据、开发面板、API 参考）：**https://karinjs.github.io/template-react/**
