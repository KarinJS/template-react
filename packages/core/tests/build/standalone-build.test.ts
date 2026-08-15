import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { buildStandalone } from '../../src/build/standalone'
import { resolveConfig } from '../../src/config'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(testDir, '../..')
const require = createRequire(import.meta.url)

const resolvePackageRoot = (name: string): string => path.dirname(require.resolve(`${name}/package.json`))

const linkPackage = (root: string, name: string, source: string): void => {
  const target = path.join(root, 'node_modules', ...name.split('/'))
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.symlinkSync(source, target, 'junction')
}

const setupProject = (dataType = 'CardData'): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-standalone-'))
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'standalone-fixture', type: 'module' }), 'utf8')
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: true }
    }),
    'utf8'
  )
  fs.writeFileSync(path.join(root, 'karin.template.ts'), "export default { standalone: { outDir: 'build' } }\n", 'utf8')

  linkPackage(root, '@karinjs/template-react', packageRoot)
  linkPackage(root, 'react', path.join(packageRoot, 'node_modules', 'react'))
  linkPackage(root, 'react-dom', path.join(packageRoot, 'node_modules', 'react-dom'))
  linkPackage(root, '@types/node', resolvePackageRoot('@types/node'))
  linkPackage(root, '@types/react', resolvePackageRoot('@types/react'))
  linkPackage(root, '@types/react-dom', resolvePackageRoot('@types/react-dom'))

  const templateDir = path.join(root, 'ktr', 'template', 'hello', 'card')
  fs.mkdirSync(templateDir, { recursive: true })
  const component =
    dataType === 'CardData'
      ? `import { useMemo } from 'react'
import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

export interface CardData {
  title: string
  items: Array<{ label: string; value: string }>
}

const Card = ({ data }: TemplateProps<${dataType}>) => {
  const title = useMemo(() => data.title.toUpperCase(), [data.title])
  return <div className="flex"><h1>{title}</h1></div>
}

export default defineTemplate<${dataType}>({ component: Card })
`
      : `import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

const Card = (_props: TemplateProps<${dataType}>) => <div />

export default defineTemplate<${dataType}>({ component: Card })
`
  fs.writeFileSync(path.join(templateDir, 'index.tsx'), component, 'utf8')

  const profileDir = path.join(root, 'ktr', 'template', 'user', 'profile')
  fs.mkdirSync(profileDir, { recursive: true })
  fs.writeFileSync(
    path.join(profileDir, 'index.tsx'),
    `import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

export interface ProfileData {
  name: string
  active: boolean
}

const Profile = ({ data }: TemplateProps<ProfileData>) => <div>{data.name}:{String(data.active)}</div>

export default defineTemplate<ProfileData>({ component: Profile })
`,
    'utf8'
  )
  fs.writeFileSync(path.join(root, 'ktr', 'template', 'style.css'), "@import 'tailwindcss';\n@source './**/*.{ts,tsx}';\n", 'utf8')
  fs.mkdirSync(path.join(root, 'ktr', 'public', 'image'), { recursive: true })
  fs.writeFileSync(path.join(root, 'ktr', 'public', 'image', 'marker.txt'), 'standalone-asset', 'utf8')
  return root
}

const typecheckConsumer = (root: string, source: string, fileName = 'consumer.ts'): readonly ts.Diagnostic[] => {
  const consumer = path.join(root, fileName)
  const isJavaScript = fileName.endsWith('.js')
  fs.writeFileSync(consumer, source, 'utf8')
  const program = ts.createProgram([consumer], {
    allowJs: isJavaScript,
    checkJs: isJavaScript,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX
  })
  return ts.getPreEmitDiagnostics(program)
}

describe('buildStandalone', () => {
  it('生成单一 ESM、精确声明、内嵌 CSS 和可独立执行的 hooks SSR runtime', async () => {
    const root = setupProject()
    const config = await resolveConfig({ cwd: root })
    const result = await buildStandalone(config)

    expect(fs.existsSync(result.entryPath)).toBe(true)
    expect(fs.existsSync(result.typesPath)).toBe(true)
    expect(fs.existsSync(path.join(result.outDir, 'assets', 'image', 'marker.txt'))).toBe(true)
    expect(fs.readdirSync(result.outDir).filter((file) => file.endsWith('.mjs'))).toEqual(['index.mjs'])
    expect(result.templatesCount).toBe(2)

    const generatedEntry = fs.readFileSync(path.join(root, '.ktr', 'standalone-entry.ts'), 'utf8')
    expect(generatedEntry).toContain("from '../ktr/template/hello/card/index'")
    expect(generatedEntry).toContain("from '../ktr/template/user/profile/index'")
    expect(generatedEntry).toContain("'hello/card': DataOf<typeof template_hello_card>")
    expect(generatedEntry).toContain("'user/profile': DataOf<typeof template_user_profile>")

    const declaration = fs.readFileSync(result.typesPath, 'utf8')
    expect(declaration).toContain("'hello/card': typeof import('../ktr/template/hello/card/index').default")
    expect(declaration).toContain("'user/profile': typeof import('../ktr/template/user/profile/index').default")
    expect(declaration).toContain('export type TemplateData<K extends TemplatePath>')

    fs.rmSync(path.join(root, '.ktr'), { recursive: true, force: true })
    const runtime = (await import(`${pathToFileURL(result.entryPath).href}?test=${Date.now()}`)) as {
      renderTemplate: (route: string, data: unknown) => Promise<{ success: boolean; htmlPath: string; error?: string }>
    }
    const rendered = await runtime.renderTemplate('hello/card', {
      title: 'standalone',
      items: [{ label: 'status', value: 'ok' }]
    })

    expect(rendered.success).toBe(true)
    const html = fs.readFileSync(rendered.htmlPath, 'utf8')
    expect(html).toContain('STANDALONE')
    expect(html).toContain('.flex')

    const validDiagnostics = typecheckConsumer(
      root,
      `import { renderTemplate } from './build/index.mjs'
await renderTemplate('hello/card', { title: 'ok', items: [] })
await renderTemplate('user/profile', { name: 'Karin', active: true })
// @ts-expect-error 不存在的模板路由
await renderTemplate('hello/missing', {})
// @ts-expect-error title 必须是 string
await renderTemplate('hello/card', { title: 1, items: [] })
// @ts-expect-error hello/card 缺少 items
await renderTemplate('hello/card', { title: 'missing items' })
// @ts-expect-error 不同路由的 data 类型不能串用
await renderTemplate('user/profile', { title: 'wrong', items: [] })
`
    )
    expect(validDiagnostics).toEqual([])

    const checkJsDiagnostics = typecheckConsumer(
      root,
      `// @ts-check
import { renderTemplate } from './build/index.mjs'
await renderTemplate('hello/card', { title: 'ok', items: [] })
// @ts-expect-error checkJs 下也应拒绝错误 data
await renderTemplate('hello/card', { title: 1, items: [] })
`,
      'consumer.js'
    )
    expect(checkJsDiagnostics).toEqual([])
  }, 30_000)

  it.each(['any', 'unknown'])(
    `拒绝 data 类型退化为 %s`,
    async (dataType) => {
      const root = setupProject(dataType)
      const config = await resolveConfig({ cwd: root })
      await expect(buildStandalone(config)).rejects.toThrow('does not satisfy the constraint')
    },
    30_000
  )
})
