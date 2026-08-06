---
name: karin-template-react
description: 为 Karin 机器人插件开发 React 截图模板（@karinjs/template-react，替代 art-template）。当用户要创建、调试或迁移 Karin 图片模板，或提到 defineTemplate、ktr、模板注册表、mock 数据、截图模板时使用。会先获取最新官方文档再动手，避免按过时记忆回答。
license: MIT
metadata:
  author: KarinJS,ikenxuan
  version: "0.1.0"
---

# Karin Template React 开发技能

帮助用户使用 `@karinjs/template-react`（React + Tailwind CSS + TypeScript）为 Karin 插件编写"数据到图片"的截图模板，替代旧的 art-template 写法。

## 第一步：获取最新文档（必做）

本工具链迭代很快，**不要凭记忆回答**。开始任何接入、迁移、排错工作前，先拉取最新文档：

1. 全文打包（首选）：`https://karinjs.github.io/template-react/llms-full.txt`
2. 页面索引：`https://karinjs.github.io/template-react/llms.txt`
3. 单页 markdown：`https://karinjs.github.io/template-react/llms.mdx/docs/<页面路径>/content.md`，例如快速开始是 `llms.mdx/docs/quick-start/content.md`
4. 上述地址不可达时的兜底（仓库原始文件）：`https://raw.githubusercontent.com/KarinJS/template-react/main/packages/docs/content/docs/<页面>.mdx`

用 curl 或 WebFetch 抓取即可。拿到全文后再回答或改代码；改完后以文档约定校验自己的产出。

## 核心约定速查（与文档冲突时以最新文档为准）

- 模板组件：`template/<板块>/<模板>/index.tsx`，默认导出 `defineTemplate({...})`；目录即路由，裸 `.tsx` 不注册。
- TS mock：同目录 `mock.ts`（固定名），具名导出 + `satisfies`，面板只读。
- JSON mock：同目录 `data/*.json`（必须在 `data/` 子目录），面板可编辑。
- 捕获数据：`data/captured.json`，真实渲染自动滚动覆盖，面板自动刷新并选中。
- 组件根元素不要写 `id="container"`（包装器提供截图边界）；圆角由根元素 `rounded-*` 决定（裁剪配 `overflow-hidden`）。
- 框架不注入默认主题色；深色判断用 `ctx.theme.mode`。
- 胶水层：`createTemplateRenderer(import.meta.url, ...)` 装配 + `renderImage(route, data, options?)` 出图。
- 命令：`ktr sync` / `ktr dev` / `ktr build`；面板默认 `http://localhost:5180/__ktr/panel/`。
- 构建：`ktr sync && tsdown`；`.ktr` 注册表要打进产物目录（默认 `lib/`，可自定义 outDir——加载器按 `bundledDir` 选项 → package.json `main` 目录 → 根目录扫描自动发现）；react/react-dom、core 运行时、组件库全部随产物打包（同一份产物内只有一份 React 副本，hooks 才正常——切勿只打包组件却外部引用 core 运行时）；只有 `node-karin` 由宿主提供。

## 典型任务流程

### 接入 / 迁移（art-template → React 模板）

1. 抓取 `llms-full.txt`，重点读 quick-start 与 internals/migration-from-art。
2. 按文档顺序执行：装依赖 → `karin.template.ts` → 模板 `index.tsx` → mock 数据 → 胶水层 `renderImage` → `ktr dev` 验证。
3. 完成后逐项自查：路由是否注册（`ktr sync` 输出）、类型是否生效（错误 data 应报 tsc 错）、面板预览是否正常。

### 新模板开发

1. 抓取对应页面（guide/template、guide/data、guide/styling）。
2. 按约定创建目录结构与文件，提醒用户跑 `npx ktr sync` 并在面板预览。

### 排错

先抓最新文档比对约定；常见高频问题：裸 `.tsx` 未注册、JSON 没放 `data/`、重复打包 react、手动 import `.ktr`、给组件根元素写了 `id="container"`。
