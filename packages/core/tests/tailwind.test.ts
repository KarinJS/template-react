import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { templateCssEntryContent } from '../src/conventions/css-entry'
import { tailwindSourceScopePlugin } from '../src/tailwind'

type Transform = (code: string, id: string) => { code: string } | null

describe('Tailwind 扫描范围', () => {
  it('下游 CSS 使用标准 import，构建时才在内存中限制扫描范围', () => {
    const cssEntry = path.resolve('ktr/template/style.css')
    const content = templateCssEntryContent()
    const transform = tailwindSourceScopePlugin(cssEntry).transform as Transform

    expect(content).toContain("@import 'tailwindcss';")
    expect(content).not.toContain('source(none)')
    expect(transform(content, cssEntry)?.code).toContain("@import 'tailwindcss' source(none);")
  })

  it('没有显式 @source 的自定义入口继续使用 Tailwind 自动扫描', () => {
    const cssEntry = path.resolve('src/styles/main.css')
    const transform = tailwindSourceScopePlugin(cssEntry).transform as Transform

    expect(transform("@import 'tailwindcss';\n", cssEntry)).toBeNull()
    expect(transform("@import 'tailwindcss';\n@source './src';\n", path.resolve('other.css'))).toBeNull()
  })
})
