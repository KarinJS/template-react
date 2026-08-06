# @karinjs/template-react

Karin 插件的 React 截图模板工具链：用 React + Tailwind CSS + TypeScript 编写"数据到图片"的模板，提供 SSR 渲染、开发面板、mock 数据管理和生产构建能力。文档与教程见 **[文档站](https://karinjs.github.io/template-react/)**。

## 安装

```bash
pnpm add @karinjs/template-react react react-dom
```

> [!IMPORTANT]
> 推荐把本包与 react 一起打进你的插件产物（tsdown 整包，渲染器与组件共享产物内同一份 React 副本，生产零安装）。只有在**外部引用**本包运行时的场景，才需要把 `react` / `react-dom` 装为直接依赖（hooks 依赖单例，两种模式不要混用）。

## 用法一览

```tsx title="template/hello/card/index.tsx —— 模板组件（目录即路由）"
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

| 命令        | 说明                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `ktr sync`  | 扫描 `template/`，在 `.ktr/` 生成注册表与类型增强声明                    |
| `ktr dev`   | 启动开发面板（`--port` / `--host` / `--open` / `--no-open`）             |
| `ktr build` | 仅编译模板 Tailwind CSS（完整的 JS+CSS 产物建议直接用 tsdown，见文档站） |

## 关键约定

- 模板组件必须写在 `template/<板块>/<模板>/index.tsx`；裸 `.tsx` 不注册。
- 子组件与逻辑文件放同目录 `components/`（不参与路由）；TS mock 固定为 `mock.ts`；JSON mock 放 `data/` 子目录。
- 组件根元素不要写 `id="container"`（截图边界由框架提供）；圆角用根元素 `rounded-*` 类（裁剪配 `overflow-hidden`）。
- 框架不注入默认主题色；深色模式读 `ctx.theme.mode`。
- 不要手动 import `.ktr/`——用 `@karinjs/template-react` 的 `loadTemplateRegistry()` / `loadMockRegistry()` 按约定加载。

更多内容（mock 数据、开发面板、API 参考、art-template 迁移）：**https://karinjs.github.io/template-react/**
