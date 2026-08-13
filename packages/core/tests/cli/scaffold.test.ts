import { describe, expect, it } from 'vitest'
import { exampleTemplateFiles } from 'virtual:ktr-scaffold-examples'

import { collectExampleTemplateFiles } from '../../build/scaffold-examples'
import { scaffoldFiles, type ScaffoldOptions } from '../../src/cli/scaffold/files'

const baseOptions: ScaffoldOptions = {
  style: 'builtin',
  withExample: true,
  withGlue: false,
  port: 5180,
  pluginName: 'demo-plugin'
}

/** examples 的 7 条模板路由。 */
const exampleRoutes = ['hello/card', 'hello/list', 'desktop/dashboard', 'mobile/story', 'social/square', 'receipt/tall', 'demo/nested/deep']

describe('scaffoldFiles', () => {
  it('withExample 时覆盖 examples 的全部 7 条路由', () => {
    const paths = scaffoldFiles(baseOptions).map((file) => file.path)

    for (const route of exampleRoutes) {
      expect(paths).toContain(`ktr/template/${route}/index.tsx`)
    }
    // 运行时捕获文件不属于示例内容。
    expect(paths.some((item) => item.endsWith('captured.json'))).toBe(false)
    // TS mock 与 JSON mock 都要带下来。
    expect(paths).toContain('ktr/template/hello/list/mock.ts')
    expect(paths).toContain('ktr/template/demo/nested/deep/mock.ts')
    expect(paths).toContain('ktr/template/hello/card/data/default.json')
    expect(paths.some((item) => /^ktr\/template\/.+\/data\/.+\.json$/.test(item))).toBe(true)
  })

  it('withExample 为 false 时不生成任何模板文件（style.css 入口除外）', () => {
    const paths = scaffoldFiles({ ...baseOptions, withExample: false }).map((file) => file.path)
    const templatePaths = paths.filter((item) => item.startsWith('ktr/template/'))

    expect(templatePaths).toEqual(['ktr/template/style.css'])
  })
})

describe('示例模板虚拟模块', () => {
  it('虚拟模块内容与 examples 目录实时扫描一致', () => {
    // 虚拟模块由 vitest 插件即时生成，两边同源自 collectExampleTemplateFiles；
    // 这条用例钉住的是「插件管线确实接上了」，而不是内容会不会漂移（无签入生成物，天然不漂移）。
    expect(exampleTemplateFiles).toEqual(collectExampleTemplateFiles())
    expect(exampleTemplateFiles.length).toBeGreaterThan(0)
  })

  it('不包含 captured.json 和顶层 style.css', () => {
    const paths = exampleTemplateFiles.map((file) => file.path)

    expect(paths.some((item) => item.endsWith('captured.json'))).toBe(false)
    expect(paths).not.toContain('ktr/template/style.css')
  })
})
