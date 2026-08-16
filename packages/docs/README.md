# template-react-docs

`@karinjs/template-react` 的文档站，基于 **Next.js + Fumadocs**（MDX 内容，静态导出），通过 GitHub Actions 自动部署到 GitHub Pages。

- 线上地址：https://karinjs.github.io/template-react/
- 内容目录：`content/docs/`（页面为 `.mdx`，导航由各级 `meta.json` 控制）

## 本地开发

```bash
pnpm --filter template-react-docs run dev     # 启动开发服务器
pnpm --filter template-react-docs run build   # 静态导出到 out/
```

## 写作约定

- 组件（`Callout`、`Cards`、`Steps`、`Tabs`、`Files`、`Accordions` 等）已全局注册，MDX 里直接使用，无需 import。
- frontmatter 的 `description` 若以 `@` 开头必须加英文双引号（YAML 限制）。
- 面向零基础读者：步骤要给出完整命令、完整代码和"成功后能看到什么"；重点约束用 `Callout` 标出。
- 示例代码必须自包含，不引用仓库内其他子包的文件路径。

## 部署

`.github/workflows/deploy-docs.yml`：推送到 `main` 且涉及 `packages/docs/**` 时自动构建并部署 `out/` 到 GitHub Pages（`DOCS_BASE_PATH` 取仓库名）。仓库 Settings → Pages 需选择 GitHub Actions 作为来源。

每页同时提供 LLM 友好的 markdown（`/llms.txt`、`/llms-full.txt`、`/llms.mdx/docs/<slug>/content.md`），供 `skills/karin-template-react` 技能包抓取。
