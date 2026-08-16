---
name: karin-template-react
description: 为 Karin 机器人插件开发 React 截图模板（@karinjs/template-react，替代 art-template）。当用户要创建、调试或迁移 Karin 图片模板，或提到 defineTemplate、ktr、模板注册表、mock 数据、截图模板时使用。会先获取最新官方文档再动手，避免按过时记忆回答。
license: MIT
metadata:
  author: KarinJS,ikenxuan
  version: '0.1.0'
---

# Karin Template React 开发技能

帮助用户使用 `@karinjs/template-react`（React + Tailwind CSS + TypeScript）为 Karin 插件编写"数据到图片"的截图模板，替代旧的 art-template 写法。

## 第一步：获取最新文档（必做）

本工具链迭代很快，**不要凭记忆回答，也不要用自带的 WebFetch/搜索现查**（不稳定）。开始任何接入、迁移、排错工作前，先运行本技能自带的脚本拉取最新文档（零依赖，Node ≥ 18）：

```bash
# 全文打包（首选，写入 .cache/llms-full.txt 并打印绝对路径）
node <本技能目录>/scripts/fetch-docs.mjs

# 只查某一页，如快速开始、模板指南、数据指南
node <本技能目录>/scripts/fetch-docs.mjs quick-start
node <本技能目录>/scripts/fetch-docs.mjs guide/template

# 页面索引
node <本技能目录>/scripts/fetch-docs.mjs --list
```

脚本按「文档站 → GitHub 原始文件」自动降级，成功后打印缓存文件路径，**用 Read 读那个文件**。拿到文档后再回答或改代码；改完后以文档约定校验自己的产出。脚本拉取失败时把错误信息原样告诉用户，不要凭记忆硬答。

## 核心约定速查（与文档冲突时以最新文档为准）

- 模板组件：`ktr/template/<板块>/<模板>/index.tsx`，默认导出 `defineTemplate({...})`；目录即路由，裸 `.tsx` 不注册。
- TS mock：同目录 `mock.ts`（固定名），具名导出 + `satisfies`，面板只读。
- JSON mock：同目录 `data/*.json`（必须在 `data/` 子目录），面板可编辑；同名时 JSON 优先于 TS mock。
- 捕获数据：`data/captured.json`，真实渲染自动滚动覆盖 `{ data, ctx }` 快照，面板自动刷新并选中。
- 组件根元素不要写 `id="container"`（包装器提供截图边界）；圆角由根元素 `rounded-*` 决定（裁剪配 `overflow-hidden`）。
- 样式入口 `ktr/template/style.css` 固定三行：`@import 'tailwindcss'` + `@import '@karinjs/template-react/styles'` + `@source './**/*.{ts,tsx}'`。**不要再写 `@theme { --color-accent: var(--accent); ... }` 这类映射块**——HeroUI 已用 `@theme inline` 桥接，再写普通 `@theme` 会把它盖掉（token 编译成 `var(--color-*)` 并固化到 `:root`，元素级主题注入失效）。
- 颜色一律用继承自 HeroUI 的语义类：`bg-background`、`text-foreground`、`bg-surface`、`text-muted`、`text-accent`、`bg-accent-soft`、`border-border`、`bg-success/warning/danger` 等；不要写 `bg-white`、`text-zinc-500`。换肤在下游 `style.css` 里覆盖 `:root` / `.dark` 的 `--accent`、`--radius` 等变量。
- 框架不注入默认主题色（不传 theme 时 HeroUI 默认主题生效）；深色判断用 `ctx.theme?.mode`。`ThemeContext` 字段名与 HeroUI 变量一一对应，圆角/字体等经 `theme.vars` 直通。
- 胶水层：`createTemplateRenderer(import.meta.url, ...)` 装配 + 插件本地封装的 `renderImage(route, data, options?)` 出图（渲染结果 `{ success, htmlPath, error }`）。
- 命令：`ktr init`（已有项目初始化）/ `ktr create <name>`（新建项目）/ `ktr sync` / `ktr dev`；面板默认 `http://localhost:5180/__ktr/panel/`。`init` 和 `create` 需要真实终端，不能用管道喂输入。**没有 `ktr build`**：构建走下游自己的打包器（vite/tsdown），在配置里挂 `ktrBuildPlugin()`（`@karinjs/template-react/plugin`）。
- 构建产物目录跟随打包器 outDir（karin 惯例 `lib/`）：`ktrBuildPlugin` 把 CSS 编到 `<outDir>/style.css`、资源复制到 `<outDir>/assets/`；`.ktr` 注册表作为打包入口编进产物。运行时按 `bundledDir` 选项 → package.json `main` 目录 → 根目录扫描自动发现，CSS 默认按 `lib/style.css` 发现（自定义 outDir 时传 `bundledDir` + `renderer.cssPath`）。react/react-dom、core 运行时、组件库全部随产物打包（同一份产物内只有一份 React 副本，hooks 才正常）；只有 `node-karin` 由宿主提供。

## 典型任务流程

### 接入 / 迁移（art-template → React 模板）

1. 运行 `node <本技能目录>/scripts/fetch-docs.mjs` 抓全文，重点读 quick-start 与 guide/karin-integration。
2. 脚手架能一步到位的部分交给用户跑 `npx @karinjs/template-react init`（它需要交互终端，你不能代跑）：装依赖、`karin.template.ts`、`ktr/template/style.css`、`tsconfig` 的 `jsx`、示例模板与胶水层都在里面。用户不愿意交互时，按 quick-start 的"附：手动配置"逐项手写。
3. 之后接着做：模板 `index.tsx` → mock 数据 → 胶水层 `renderImage` → `ktr dev` 验证。
4. 完成后逐项自查：路由是否注册（`ktr sync` 输出）、类型是否生效（错误 data 应报 tsc 错）、面板预览是否正常。

### 新模板开发

1. 用脚本抓取对应页面（`guide/template`、`guide/data`、`guide/styling`）。
2. 按约定创建目录结构与文件，提醒用户跑 `npx ktr sync` 并在面板预览。

### 排错

先抓最新文档比对约定；常见高频问题：裸 `.tsx` 未注册、JSON 没放 `data/`、重复打包 react、手动 import `.ktr`、给组件根元素写了 `id="container"`、样式入口里残留旧版的 `@theme` 颜色映射块（导致主题色改了不生效）。
