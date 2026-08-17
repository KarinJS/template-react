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

  // ctx 允许携带自定义字段，原样透传给模板和插件；已知字段仍保持精确类型
  await renderTemplate('hello/card', { title: 't', items: [] }, { useDarkTheme: true })
  await renderTemplate('hello/card', { title: 't', items: [] }, { scale: 2, theme: { mode: 'dark' }, requestId: 'r-1' })

  // @ts-expect-error ctx 已知字段不接受错误类型
  await renderTemplate('hello/card', { title: 't', items: [] }, { scale: 'big' })

  expectTypeOf<DataOf<(typeof templates)['hello/card']>>().toEqualTypeOf<{
    title: string
    items: Array<{ label: string; value: string }>
  }>()
  expectTypeOf<keyof typeof templates>().toEqualTypeOf<'hello/card' | 'hello/broken'>()
  expectTypeOf<NonNullable<TemplateProps<{ ok: boolean }>['ctx']['theme']>['mode']>().toEqualTypeOf<'light' | 'dark' | undefined>()
  expectTypeOf<NonNullable<TemplateProps<{ ok: boolean }>['ctx']['theme']>['accent']>().toEqualTypeOf<string | undefined>()
  expectTypeOf<RenderContextInput>().toMatchTypeOf<{ theme?: { accent?: string } }>()
  expectTypeOf<TemplateProps<{ ok: boolean }>['ctx']['scale']>().toEqualTypeOf<number>()
  // 自定义扩展字段读取时为 unknown，由调用方自行收窄
  expectTypeOf<TemplateProps<{ ok: boolean }>['ctx']['anythingCustom']>().toEqualTypeOf<unknown>()

  const cardMock = defineMock<DataOf<(typeof templates)['hello/card']>>({ title: 'typed mock', items: [] })
  expectTypeOf(cardMock.title).toEqualTypeOf<string>()

  // @ts-expect-error mock data follows the selected template data type
  defineMock<DataOf<(typeof templates)['hello/card']>>({ title: 123, items: [] })
})
