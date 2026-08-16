import { describe, expect, it } from 'vitest'

import { isPanelMessage, isSandboxMessage } from '../../src/dev/protocol'

describe('sandbox protocol guards', () => {
  it('recognizes panel and sandbox message sources', () => {
    expect(isPanelMessage({ source: 'ktr-panel', type: 'ktr:select', payload: { path: 'hello/card' } })).toBe(true)
    expect(isSandboxMessage({ source: 'ktr-sandbox', type: 'ktr:ready', payload: { templates: [] } })).toBe(true)
    expect(isPanelMessage({ source: 'other', type: 'ktr:select', payload: {} })).toBe(false)
    expect(isSandboxMessage(null)).toBe(false)
  })
})
