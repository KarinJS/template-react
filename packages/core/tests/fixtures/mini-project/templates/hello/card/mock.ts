import type { HelloCardData } from './index'
export const valid = {
  title: 'Typed mock',
  items: [{ label: 'a', value: 'b' }]
} satisfies HelloCardData

export const typedOnly = {
  title: 'Typed-only mock',
  items: [{ label: 'x', value: 'y' }]
} satisfies HelloCardData
