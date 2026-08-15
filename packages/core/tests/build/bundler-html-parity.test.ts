import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(import.meta.dirname, '../..')
const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)

const resolvePackageRoot = (name: string): string => path.dirname(require.resolve(`${name}/package.json`))

const linkPackage = (root: string, name: string, source: string): void => {
  const target = path.join(root, 'node_modules', ...name.split('/'))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.symlinkSync(source, target, 'junction')
}

/** 创建只依赖 ktr 构建插件的最小下游项目，不安装 React/Tailwind 的 Vite 插件。 */
const setupProject = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-bundler-parity-'))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'bundler-parity', type: 'module' }), 'utf8')
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true
      }
    }),
    'utf8'
  )
  fs.writeFileSync(path.join(root, 'karin.template.ts'), 'export default {}\n', 'utf8')

  linkPackage(root, '@karinjs/template-react', packageRoot)
  linkPackage(root, 'react', path.join(packageRoot, 'node_modules', 'react'))
  linkPackage(root, 'react-dom', path.join(packageRoot, 'node_modules', 'react-dom'))
  linkPackage(root, 'vite', resolvePackageRoot('vite'))
  linkPackage(root, 'tsdown', resolvePackageRoot('tsdown'))

  const templateDir = path.join(root, 'ktr', 'template', 'hello', 'card')
  fs.mkdirSync(templateDir, { recursive: true })
  fs.writeFileSync(
    path.join(templateDir, 'index.tsx'),
    `import { useMemo } from 'react'
import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

interface CardData {
  title: string
  items: Array<{ label: string; value: string }>
}

const Card = ({ data }: TemplateProps<CardData>) => {
  const title = useMemo(() => data.title.toUpperCase(), [data.title])
  return (
    <main className="flex bg-accent p-4">
      <h1>{title}</h1>
      {data.items.map((item) => <p key={item.label}>{item.label}: {item.value}</p>)}
    </main>
  )
}

export default defineTemplate<CardData>({ component: Card })
`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(root, 'ktr', 'template', 'style.css'),
    "@import 'tailwindcss';\n@import '@karinjs/template-react/styles';\n@source './**/*.{ts,tsx}';\n",
    'utf8'
  )
  fs.writeFileSync(
    path.join(root, 'entry.ts'),
    `import { fileURLToPath } from 'node:url'

import { createRenderer } from '@karinjs/template-react'
import { templates } from './.ktr/template-registry'

export const renderFixture = async () => {
  const render = createRenderer(templates, {
    cssPath: fileURLToPath(new URL('./style.css', import.meta.url)),
    outputDir: fileURLToPath(new URL('./html', import.meta.url))
  })

  return render(
    'hello/card',
    { title: 'bundler parity', items: [{ label: 'status', value: 'ok' }] },
    { scale: 1.25, theme: { mode: 'dark', accent: '#123456' } }
  )
}
`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(root, 'vite.config.ts'),
    `import { defineConfig } from 'vite'
import { ktrBuildPlugin } from '@karinjs/template-react/plugin'

export default defineConfig({
  plugins: [ktrBuildPlugin()],
  build: {
    ssr: true,
    outDir: 'vite-dist',
    lib: { entry: 'entry.ts', formats: ['es'] },
    rollupOptions: {
      external: [/^node:/],
      output: { entryFileNames: 'index.mjs' }
    }
  }
})
`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(root, 'tsdown.config.ts'),
    `import { defineConfig } from 'tsdown'
import { ktrBuildPlugin } from '@karinjs/template-react/plugin'

export default defineConfig({
  entry: { index: './entry.ts' },
  plugins: [ktrBuildPlugin()],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  outDir: 'tsdown-dist',
  clean: true,
  outExtensions: () => ({ js: '.mjs' })
})
`,
    'utf8'
  )

  return root
}

const runBundler = async (root: string, name: 'vite' | 'tsdown'): Promise<void> => {
  const packageDir = resolvePackageRoot(name)
  const entry = name === 'vite' ? path.join(packageDir, 'bin', 'vite.js') : path.join(packageDir, 'dist', 'run.mjs')
  const args = name === 'vite' ? [entry, 'build', '--config', 'vite.config.ts'] : [entry, '--config', 'tsdown.config.ts']
  await execFileAsync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    maxBuffer: 10 * 1024 * 1024
  })
}

const renderBuiltEntry = async (entryPath: string): Promise<string> => {
  const runtime = (await import(`${pathToFileURL(entryPath).href}?test=${Date.now()}`)) as {
    renderFixture: () => Promise<{ success: boolean; htmlPath: string; error?: string }>
  }
  const result = await runtime.renderFixture()
  expect(result.success, result.error).toBe(true)
  return fs.readFileSync(result.htmlPath, 'utf8')
}

describe('下游打包器 HTML 一致性', () => {
  it('Vite 与 tsdown 只挂 ktrBuildPlugin 时生成相同 HTML', async () => {
    const root = setupProject()
    const viteOutDir = path.join(root, 'vite-dist')
    const tsdownOutDir = path.join(root, 'tsdown-dist')

    // 分别启动真实 CLI 进程，避免 Tailwind 编译器在同一进程内复用扫描状态。
    await runBundler(root, 'vite')
    await runBundler(root, 'tsdown')

    const viteHtml = await renderBuiltEntry(path.join(viteOutDir, 'index.mjs'))
    const tsdownHtml = await renderBuiltEntry(path.join(tsdownOutDir, 'index.mjs'))

    expect(viteHtml).toBe(tsdownHtml)
    expect(viteHtml).toContain('<body class="dark" data-theme="dark"')
    expect(viteHtml).toContain('--accent: #123456')
    expect(viteHtml).toContain('<div id="container"><main class="flex bg-accent p-4">')
    expect(viteHtml).toContain('<h1>BUNDLER PARITY</h1>')
    expect(viteHtml).toContain('.flex')
    expect(viteHtml).toContain('.bg-accent')
  }, 90_000)
})
