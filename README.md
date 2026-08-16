# @karinjs/template-react

让 Karin 插件开发者用 **React + Tailwind CSS + TypeScript** 编写"数据到图片"的截图模板，替代 art-template 的传统写法。

[![npm](https://img.shields.io/npm/v/@karinjs/template-react)](https://www.npmjs.com/package/@karinjs/template-react)
[![CI](https://github.com/KarinJS/template-react/actions/workflows/ci.yml/badge.svg)](https://github.com/KarinJS/template-react/actions/workflows/ci.yml)
[![文档](https://img.shields.io/badge/docs-karinjs.github.io-blue)](https://karinjs.github.io/template-react/)

## 特性

- **组件即模板**：`ktr/template/<板块>/<模板>/index.tsx` 目录即路由，自动注册，强类型推导
- **全链路类型**：`renderImage('hello/card', data)` 的路由和 data 都有编译期约束，写错直接报错
- **可视化开发面板**：模板预览、HMR、mock 数据切换/编辑、主题色、缩放、截图预览
- **数据闭环**：真实渲染数据自动捕获为 `captured.json`，面板实时同步并选中
- **样式零污染**：面板预构建 + iframe 沙盒，框架不注入任何默认主题色
- **静态资源全链路**：`ktr/public/` 里的资源用 `/xxx` 引用，开发、打包、生产截图位置始终正确（自动内联或转绝对路径）
- **生产就绪**：`ktrBuildPlugin()` 挂进 vite / tsdown 随包构建（CSS 进打包器输出表），或 `ktr build` 产出独立运行包

## 快速开始

新项目一条命令（交互式脚手架，可选官方示例模板）：

```bash
npx @karinjs/template-react create my-plugin
```

已有项目接入：

```bash
pnpm add @karinjs/template-react react react-dom
pnpm ktr init   # 生成 ktr/template 目录结构、karin.template.ts 与渲染胶水层
```

模板长这样：

```tsx title="ktr/template/hello/card/index.tsx"
import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

interface CardData {
  title: string
  items: Array<{ label: string; value: string }>
}

const Card = ({ data }: TemplateProps<CardData>) => (
  <div className="w-155 bg-white p-8 text-zinc-900">
    <h1 className="text-3xl font-bold">{data.title}</h1>
    {data.items.map((item) => (
      <p key={item.label}>
        {item.label}: {item.value}
      </p>
    ))}
  </div>
)

export default defineTemplate({ name: '问候卡片', component: Card })
```

```bash
pnpm ktr dev    # 打开开发面板 http://localhost:5180/__ktr/panel/（注册表自动同步）
```

完整教程见 **[文档站](https://karinjs.github.io/template-react/)**（含快速开始、开发面板导览、API 参考、art-template 迁移指南）。

## 使用 AI

用 AI 助手开发时，一条命令让它掌握最新文档：

```bash
npx skills add KarinJS/template-react@karin-template-react
```

## 仓库结构

| 路径            | 说明                                                                                |
| --------------- | ----------------------------------------------------------------------------------- |
| `packages/core` | 发布包 `@karinjs/template-react`（CLI、约定扫描、开发服务器、SSR 运行时、面板源码） |
| `packages/docs` | 文档站（Fumadocs，自动部署 GitHub Pages）                                           |
| `skills/`       | Agent 技能包                                                                        |

## 本地开发

```bash
pnpm install
pnpm test          # core 单元测试 + 类型测试
pnpm lint          # oxlint
pnpm format:check  # oxfmt
pnpm build         # 构建全部子包
```

## 发布流程

- **正式版**：由 [release-please](https://github.com/googleapis/release-please-action) 驱动——按 conventional commits 自动维护 release PR，合并后自动打 tag、生成 CHANGELOG 并发布到 npm（仅 core 子包）。
- **预览版**：PR 与 main 推送自动发布到 [pkg.pr.new](https://pkg.pr.new)（PR 发 `alpha`、main 发 `beta`），PR 里会自动评论安装命令：

```bash
pnpm add https://pkg.pr.new/KarinJS/template-react/@karinjs/template-react@<版本号>
```

> [!NOTE]
> 要求 Node.js ≥ 18（构建工具链建议 22+）。下游整包构建（推荐）时所有依赖随产物打进 `lib/`，生产环境零安装；外部引用 core 运行时时，`react` / `react-dom` 需作为直接依赖安装（peer dependencies，≥ 18）。
