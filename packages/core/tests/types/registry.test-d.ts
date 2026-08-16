import { expectTypeOf, test } from 'vitest'

import { defineMock } from '../../src'
import { createRenderer, type DataOf, type RenderContextInput, type TemplateProps } from '../../src/runtime'
import { templates } from '../fixtures/mini-project/templates'

const renderTemplate = createRenderer(templates, {
  cssPath: 'style.css',
  outputDir: 'dist'
})

test('registry drives template path and data types', async () => {
  await renderTemplate('hello/card', { title: 't', items: [] })

  // @ts-expect-error nonexistent template name
  await renderTemplate('hello/cars', { title: 't', items: [] })

  // @ts-expect-error missing required field
  await renderTemplate('hello/card', { title: 't' })

  // @ts-expect-error wrong field type
  await renderTemplate('hello/card', { title: 123, items: [] })

  // @ts-expect-error excess property on exact object literal
  await renderTemplate('hello/card', { title: 't', items: [], foo: 1 })

  expectTypeOf<DataOf<(typeof templates)['hello/card']>>().toEqualTypeOf<{
    title: string
    items: Array<{ label: string; value: string }>
  }>()
  expectTypeOf<keyof typeof templates>().toEqualTypeOf<'hello/card' | 'hello/broken'>()
  expectTypeOf<NonNullable<TemplateProps<{ ok: boolean }>['ctx']['theme']>['mode']>().toEqualTypeOf<'light' | 'dark' | undefined>()
  expectTypeOf<NonNullable<TemplateProps<{ ok: boolean }>['ctx']['theme']>['accent']>().toEqualTypeOf<string | undefined>()
  expectTypeOf<RenderContextInput>().toMatchTypeOf<{ theme?: { accent?: string } }>()

  const cardMock = defineMock<DataOf<(typeof templates)['hello/card']>>({ title: 'typed mock', items: [] })
  expectTypeOf(cardMock.title).toEqualTypeOf<string>()

  // @ts-expect-error mock data follows the selected template data type
  defineMock<DataOf<(typeof templates)['hello/card']>>({ title: 123, items: [] })
})
