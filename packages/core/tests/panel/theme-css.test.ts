import { describe, expect, it } from 'vitest'

import { generateExportCss, generateSandboxCss } from '../../panel/theme/css'
import { defaultKnobs } from '../../panel/theme/knobs'

const sandbox = generateSandboxCss(defaultKnobs)
const exported = generateExportCss(defaultKnobs)

describe('generateSandboxCss', () => {
  it('明暗两套一次性下发，切换靠选择器命中而非重算', () => {
    expect(sandbox).toContain(":root,\n.light,\n[data-theme='light']")
    expect(sandbox).toContain(".dark,\n[data-theme='dark']")
  })

  it('包含主色及其前景', () => {
    expect(sandbox).toMatch(/--accent:\s*oklch\(/)
    expect(sandbox).toMatch(/--accent-foreground:\s*oklch\(/)
  })

  it('语义色三件套齐全', () => {
    for (const name of ['success', 'warning', 'danger']) {
      expect(sandbox).toMatch(new RegExp(`--${name}:\\s*oklch\\(`))
      expect(sandbox).toMatch(new RegExp(`--${name}-foreground:\\s*oklch\\(`))
    }
  })

  it('派生色用 color-mix，随主色自动跟随', () => {
    expect(sandbox).toContain('--accent-hover: color-mix(in oklab')
    expect(sandbox).toContain('--accent-soft: color-mix(in oklab')
  })

  it('圆角阶梯基于 --radius 计算，改一个值全局生效', () => {
    expect(sandbox).toContain('--radius-xl: calc(var(--radius) * 1.5)')
    expect(sandbox).toContain('--radius-field: var(--field-radius, var(--radius-xl))')
  })

  it('字体变量落到 --font-sans / --font-mono', () => {
    expect(sandbox).toContain(`--font-sans: ${defaultKnobs.fontSans}`)
    expect(sandbox).toContain(`--font-mono: ${defaultKnobs.fontMono}`)
  })

  it('camelCase 调色板键转成 kebab-case 变量名', () => {
    expect(sandbox).toMatch(/--surface-secondary:\s*oklch\(/)
    expect(sandbox).toMatch(/--field-background:\s*oklch\(/)
    expect(sandbox).not.toContain('--surfaceSecondary')
  })

  it('不生成 --color-* 变量，避免与 HeroUI 的 @theme inline 桥接冲突', () => {
    // 面板下发的是元素级变量；写成 --color-* 会盖掉 HeroUI 的桥接，
    // token 被固化到 :root 后主题注入就失效了。
    expect(sandbox).not.toContain('--color-accent')
  })
})

describe('generateExportCss', () => {
  it('带说明注释，指明粘贴位置', () => {
    expect(exported).toContain('template/style.css')
  })

  it('暗色块声明 color-scheme，让原生控件跟随', () => {
    expect(exported).toMatch(/\.dark,[\s\S]*?color-scheme:\s*dark/)
  })

  it('只含需覆盖的变量，不重复派生色与圆角阶梯', () => {
    // 这些由 @karinjs/template-react/styles 提供，
    // 重复导出只会让用户要维护的代码变长。
    expect(exported).not.toContain('--accent-hover')
    expect(exported).not.toContain('--radius-xl:')
  })

  it('仍包含主色、语义色和字体等必要覆盖项', () => {
    expect(exported).toMatch(/--accent:\s*oklch\(/)
    expect(exported).toMatch(/--danger:\s*oklch\(/)
    expect(exported).toContain('--font-sans:')
    expect(exported).toContain('--radius:')
  })
})

describe('旋钮对输出的影响', () => {
  it('改色相后主色随之变化', () => {
    const shifted = generateSandboxCss({ ...defaultKnobs, hue: 30 })
    expect(shifted).not.toBe(sandbox)
    expect(shifted).toMatch(/--accent:\s*oklch\([\d.]+% [\d.]+ 30\.00\)/)
  })

  it('base 为 0 时中性色不染色（彩度归零）', () => {
    const neutral = generateSandboxCss({ ...defaultKnobs, base: 0 })
    expect(neutral).toMatch(/--background:\s*oklch\([\d.]+% 0\.0000 /)
  })

  it('base 增大让中性色带上主色彩度', () => {
    const tinted = generateSandboxCss({ ...defaultKnobs, base: 0.02 })
    expect(tinted).not.toMatch(/--background:\s*oklch\([\d.]+% 0\.0000 /)
  })

  it('圆角旋钮直接写入 --radius', () => {
    expect(generateSandboxCss({ ...defaultKnobs, radius: '0rem' })).toContain('--radius: 0rem')
  })

  it('相同输入产生相同输出，保证 useMemo 缓存有效', () => {
    expect(generateSandboxCss(defaultKnobs)).toBe(sandbox)
  })
})
