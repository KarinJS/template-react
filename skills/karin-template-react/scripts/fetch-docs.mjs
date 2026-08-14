#!/usr/bin/env node
/**
 * 拉取 @karinjs/template-react 最新官方文档到本地缓存，供 Agent 阅读。
 *
 * 零依赖，Node >= 18（全局 fetch）即可运行：
 *
 *   node scripts/fetch-docs.mjs                # 全文打包（llms-full.txt）
 *   node scripts/fetch-docs.mjs quick-start    # 单页（等同 llms.mdx/docs/quick-start/content.md）
 *   node scripts/fetch-docs.mjs guide/data     # 单页支持多级路径
 *   node scripts/fetch-docs.mjs --list         # 页面索引（llms.txt）
 *
 * 成功时打印缓存文件的绝对路径，用 Read 工具读它即可。
 *
 * 源优先级：文档站 → GitHub 原始文件（main 分支）。全文打包的兜底会先通过
 * GitHub Trees API 列出 docs 目录再逐文件拼接。
 *
 * 测试/调试可用环境变量覆盖源地址：KTR_DOCS_SITE / KTR_DOCS_RAW / KTR_DOCS_API。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = (process.env.KTR_DOCS_SITE ?? 'https://karinjs.github.io/template-react').replace(/\/$/, '')
const RAW = (process.env.KTR_DOCS_RAW ?? 'https://raw.githubusercontent.com/KarinJS/template-react/main').replace(/\/$/, '')
const API = (process.env.KTR_DOCS_API ?? 'https://api.github.com/repos/KarinJS/template-react').replace(/\/$/, '')
const DOCS_DIR = 'packages/docs/content/docs'
const TIMEOUT_MS = 20_000

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 带超时的文本抓取；非 200 抛出带状态码的错误。 */
const fetchText = async (url) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'ktr-docs-fetcher' } })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** 依次尝试多个源，返回第一个成功的 { content, source }。 */
const trySources = async (candidates) => {
  const failures = []
  for (const candidate of candidates) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- 源按优先级顺序尝试，不能并行。
      return { content: await candidate.fetch(), source: candidate.label }
    } catch (error) {
      failures.push(`${candidate.label}: ${error.message}`)
    }
  }
  throw new Error(`所有文档源都不可用：\n  ${failures.join('\n  ')}`)
}

/** 兜底：通过 GitHub Trees API 列出全部 mdx 并拼接为全文。 */
const fetchFullFromGitHub = async () => {
  const tree = await fetchText(`${API}/git/trees/main?recursive=1`)
  const paths = JSON.parse(tree)
    .tree.filter((node) => node.type === 'blob' && node.path.startsWith(`${DOCS_DIR}/`) && node.path.endsWith('.mdx'))
    .map((node) => node.path)
    // oxlint-disable-next-line unicorn/no-array-sort -- Sort a fresh mapped array for Node 18 compatibility.
    .sort()
  if (paths.length === 0) {
    throw new Error('GitHub main 分支上还没有文档文件')
  }

  const parts = []
  for (const filePath of paths) {
    // oxlint-disable-next-line no-await-in-loop -- 串行抓取，避免瞬时打满 raw.githubusercontent 的限流。
    const content = await fetchText(`${RAW}/${filePath}`)
    parts.push(`\n\n<!-- ========== ${filePath} ========== -->\n\n${content}`)
  }
  return parts.join('')
}

const tasks = {
  full: {
    fileName: 'llms-full.txt',
    run: () =>
      trySources([
        { label: `${SITE}/llms-full.txt`, fetch: () => fetchText(`${SITE}/llms-full.txt`) },
        { label: 'GitHub trees+raw 拼接', fetch: fetchFullFromGitHub }
      ])
  },
  list: {
    fileName: 'llms.txt',
    run: () =>
      trySources([
        { label: `${SITE}/llms.txt`, fetch: () => fetchText(`${SITE}/llms.txt`) },
        { label: `${RAW}/README.md（索引兜底）`, fetch: () => fetchText(`${RAW}/README.md`) }
      ])
  },
  page: (page) => ({
    fileName: `${page.replace(/\//g, '__')}.md`,
    run: () =>
      trySources([
        { label: `${SITE}/llms.mdx/docs/${page}/content.md`, fetch: () => fetchText(`${SITE}/llms.mdx/docs/${page}/content.md`) },
        { label: `${RAW}/${DOCS_DIR}/${page}.mdx`, fetch: () => fetchText(`${RAW}/${DOCS_DIR}/${page}.mdx`) }
      ])
  })
}

const main = async () => {
  const arg = process.argv[2]
  const outDir = path.resolve(skillDir, '.cache')
  fs.mkdirSync(outDir, { recursive: true })

  let task
  if (!arg) {
    task = tasks.full
  } else if (arg === '--list') {
    task = tasks.list
  } else if (arg === '--help' || arg === '-h') {
    console.log('用法: node scripts/fetch-docs.mjs [--list | <页面路径，如 quick-start 或 guide/data>]')
    return
  } else {
    // 容忍 docs/ 前缀和首尾斜杠
    const page = arg.replace(/^docs\//, '').replace(/^\/+|\/+$/g, '')
    task = tasks.page(page)
  }

  const { content, source } = await task.run()
  const outFile = path.join(outDir, task.fileName)
  fs.writeFileSync(outFile, content, 'utf-8')
  console.log(`来源: ${source}`)
  console.log(`已写入: ${outFile}（${(Buffer.byteLength(content) / 1024).toFixed(1)} KB）`)
}

main().catch((error) => {
  console.error(`获取文档失败：${error.message}`)
  // 不用 process.exit：让 Node 自然收尾，避免 Windows 上未关闭的 socket 句柄触发断言。
  process.exitCode = 1
})
