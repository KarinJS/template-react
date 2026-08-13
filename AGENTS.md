# AGENTS.md

## 项目定位

本仓库是 `@karinjs/template-react` 的 monorepo。目标是让 Karin 插件开发者用 React + Tailwind CSS + TypeScript 编写“数据到图片”的截图模板，并提供 SSR 渲染、开发面板、mock 数据管理和生产构建能力。

核心设计是：面板是预构建静态应用，用户模板在 iframe 沙盒中渲染，CSS 和运行时上下文通过明确协议传递，避免面板样式污染用户组件。

## 工作区结构

- `packages/core`：发布包 `@karinjs/template-react`，包含公共类型、CLI、配置加载、约定扫描、开发服务器、SSR 运行时和面板源码。
- `packages/docs`：文档站工程（Fumadocs，GitHub Pages 静态部署）。
- `skills/`：Agent Skills 技能包（`karin-template-react`，供下游通过 `npx skills add` 安装）。

下游插件开发模板（fixture）不随仓库发布，开发期在本地按需搭建验证。

## 下游模板约定

下游开发者只需要维护一个 `template/` 文件夹（App Router 式强约定：目录即路由，文件名固定）：

- `template/<板块>/<模板>/index.tsx`：模板组件，默认导出 `defineTemplate(...)`；只有这个固定写法会注册为 `<板块>/<模板>`，裸写的 `.tsx` 不注册。
- `template/<板块>/<模板>/mock.ts`：类型安全的 TS mock（固定文件名），会被自动导出，面板中只读。
- `template/<板块>/<模板>/data/*.json`：JSON mock 统一收在 `data/` 子目录，可在面板中筛选、编辑和保存。
- `template/<板块>/<模板>/data/captured.json`：真实渲染时自动捕获的本次数据，滚动覆盖单文件；开发服务器会把变更实时推送给面板，面板自动刷新并选中。
- `template/<板块>/<模板>/components/`：模板内部子组件和逻辑文件的固定存放目录（可选），不会被扫描为路由；复杂模板在这里自由分层，`index.tsx` 只做总装。
- `template/style.css`：下游模板的 Tailwind CSS 入口，固定三行（`tailwindcss` + `@karinjs/template-react/styles` + `@source`）。不写也能跑，首次启动由 `ensureCssEntry` 自动补。
- 组件根元素**不要**写 `id="container"`：截图边界由 HtmlWrapper 统一提供。想要圆角截图时给根元素加 `rounded-*` 类（需要裁剪内容时配合 `overflow-hidden`），框架不会强加或剥离任何外观。
- `template/**/_*`：以下划线开头的目录视为内部辅助目录，不会被当作模板路由扫描。

`karin.template.ts` 只配置 `@karinjs/template-react` 自身行为，例如端口、输出目录、Vite 扩展配置。不要在这里手写模板清单。

下游初始化由 `ktr init`（已有项目）和 `ktr create <name>`（新建项目）负责，交互层用 `@clack/prompts`（打包时内联，不进发布依赖），生成逻辑拆成纯函数放在 `src/cli/scaffold/`（`files.ts` 算文件内容、`apply.ts` 落盘和打补丁、`prompts.ts` 交互），便于不走交互直接测试。示例模板不是手写的：`build/scaffold-examples.ts` 的构建插件把 `packages/core/examples` 扫描成虚拟模块 `virtual:ktr-scaffold-examples`（排除 `captured.json`），tsdown 构建和 vitest 都挂同一个插件，改了 examples 后无需任何手动同步，也不存在签入的生成物。

## 自动生成目录

`ktr sync`、`ktr dev`、`ktr build` 会按约定扫描 `template/`，并写入隐藏缓存目录 `.ktr/`：

- `.ktr/template-registry.ts`：模板路由到组件的自动注册表。
- `.ktr/mock-registry.ts`：TS mock 导出和 JSON 文件清单。
- `.ktr/registry-types.d.ts`：模块增强声明，把逐路由精确类型注入 `@karinjs/template-react/registry-types`，下游无需 import `.ktr` 即可获得 `renderImage` 的严格类型。

`.ktr/` 类似 Next.js 的 `.next/`，属于框架产物，不要手动编辑，也不要提交。下游源码不要直接 import `.ktr`：运行时注册表用 `@karinjs/template-react` 的 `loadTemplateRegistry()`/`loadMockRegistry()` 按约定加载，类型由 `registry-types.d.ts` 的模块增强自动提供。

## 常用命令

- `pnpm --filter @karinjs/template-react run typecheck`：检查 core 类型。
- `pnpm --filter @karinjs/template-react run test`：运行 core 单元测试和类型测试。
- `pnpm --filter @karinjs/template-react run build`：构建 runtime/CLI 和 panel 静态产物。
- `pnpm --filter @karinjs/template-react run demo`：启动 `packages/core/examples`（7 个示例模板）的开发面板，供面板/约定改动联调。
- `pnpm --filter template-react-docs run build`：构建文档站静态产物（`out/`）。
- `pnpm lint` / `pnpm format:check`：全仓 oxlint / oxfmt 检查。

## 开发规范

- 优先遵循现有代码风格；涉及面板外观时参考 `D:\GitHub\karin-plugin-kkk\packages\template\src\dev`。
- 保持 `template/` 约定大于配置，不把生成注册表写回用户源码目录。
- 不要给 iframe 沙盒或用户组件外层强加圆角、阴影、背景或额外缩放；用户组件样式必须由用户自己完全控制。
- 颜色体系继承 HeroUI：`@heroui/styles` 是 core 的正式 dependency，通过 `@karinjs/template-react/styles` 子路径导出给下游。**任何地方都不要再写普通 `@theme { --color-*: var(--*) }` 映射块**——HeroUI 的 `themes/shared/theme.css` 已用 `@theme inline` 桥接，普通 `@theme` 会把它盖掉，导致 token 编译成 `var(--color-*)` 并固化到 `:root`，元素级主题注入失效。
- 面板主题只影响开发面板外壳；传给用户组件的主题色通过 `ctx.theme` 写成 CSS 变量生效，变量名与 HeroUI 语义色一一对应（`accent` → `--accent`）。框架不发明默认主题色：未显式设置时 SSR 和沙盒都不注入任何颜色变量，HeroUI 自身主题生效。
- 修改约定扫描、mock API、构建路径或沙盒协议时，要同时补测试。
- 公共接口、核心流程和示例模板数据接口使用中文注释，便于下游开发者直接阅读源码。
- 手动编辑文件使用 `apply_patch`；格式化、测试和构建用项目脚本完成。

## 验证要求

**每次修改代码后都必须做到单测通过、类型检查通过、构建通过**，至少执行：

- `pnpm --filter @karinjs/template-react run typecheck`
- `pnpm --filter @karinjs/template-react run test`（或仓库根目录 `pnpm test`，两条路径都要能跑通）
- `pnpm --filter @karinjs/template-react run build`
- `pnpm --filter template-react-docs run build`（涉及文档站时）

涉及开发面板交互时，还需要在本地下游项目中启动面板，检查模板切换、数据切换、主题切换、滚轮缩放、双击适应和截图目标。
