import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 示例模板来源：`packages/core/examples/template/` 是唯一事实源。
 *
 * 本模块被 tsdown（构建 CLI）和 vitest（跑测试）共用：
 * 以虚拟模块 `virtual:ktr-scaffold-examples` 把示例内容直接编进产物，
 * 没有需要签入的生成文件，也不存在「忘了重新生成」的漂移窗口。
 */

/** 一个示例文件：path 相对下游项目根目录，content 为文件全文。 */
export interface ExampleTemplateFile {
  path: string
  content: string
}

/** examples 模板目录（packages/core/examples/template）。 */
const examplesTemplateDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../examples/template')

/**
 * 递归扫描示例模板。
 *
 * 排除：隐藏文件、顶层 `style.css`（下游的样式入口由样式方案决定，不能随示例下发）、
 * `data/captured.json`（真实渲染的运行时捕获，不属于示例内容）。
 */
export const collectExampleTemplateFiles = (): ExampleTemplateFile[] => {
  const files: ExampleTemplateFile[] = []

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(absolute)
        continue
      }
      const relative = path.relative(examplesTemplateDir, absolute).split(path.sep).join('/')
      if (relative === 'style.css') continue
      if (relative.endsWith('data/captured.json')) continue
      files.push({ path: `template/${relative}`, content: fs.readFileSync(absolute, 'utf-8') })
    }
  }

  walk(examplesTemplateDir)
  // 稳定排序：保证产物内容与扫描顺序无关（lib 目标是 ES2022，还用不了 toSorted）。
  files.sort((a, b) => a.path.localeCompare(b.path))
  return files
}

/** 虚拟模块 id（\0 前缀是约定，防止被当作真实文件解析）。 */
const virtualId = 'virtual:ktr-scaffold-examples'
const resolvedVirtualId = `\0${virtualId}`

/**
 * 把示例模板编进产物的插件（rolldown / vite 通用）。
 *
 * 使用时 `import { exampleTemplateFiles } from 'virtual:ktr-scaffold-examples'`，
 * 类型声明见 src/virtual-modules.d.ts。
 */
export const scaffoldExamplesPlugin = () => ({
  name: 'ktr-scaffold-examples',
  resolveId(id: string) {
    if (id === virtualId) return resolvedVirtualId
    return null
  },
  load(id: string) {
    if (id !== resolvedVirtualId) return null
    return `export const exampleTemplateFiles = ${JSON.stringify(collectExampleTemplateFiles(), null, 2)}\n`
  }
})
