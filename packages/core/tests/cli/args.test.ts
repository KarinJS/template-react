import { describe, expect, it } from 'vitest'

import { explicitOpenFlag } from '../../src/cli/args'

describe('explicitOpenFlag', () => {
  it('returns true only when --open is passed explicitly', () => {
    expect(explicitOpenFlag(['node', 'ktr', 'dev', '--open'])).toBe(true)
    expect(explicitOpenFlag(['node', 'ktr', 'dev', '--no-open'])).toBe(false)
    // 未显式传参时必须返回 undefined，让 karin.template.ts 的 open 配置生效。
    expect(explicitOpenFlag(['node', 'ktr', 'dev'])).toBeUndefined()
    expect(explicitOpenFlag(['node', 'ktr', 'dev', '--port', '5180'])).toBeUndefined()
  })
})
