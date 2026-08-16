import { expectTypeOf, test } from 'vitest'

import { createRenderer, loadTemplateRegistry, type DataOf } from '../../src/runtime'
import type { TemplateDef } from '../../src/types'

// 模拟 ktr sync 生成的 .ktr/registry-types.d.ts：通过模块增强注入逐路由精确类型。
declare module '../../src/registry-types' {
  interface ProjectRegistry {
    'hello/card': TemplateDef<{ title: string; items: Array<{ label: string; value: string }> }>
  }
}

// 只取 loadTemplateRegistry 的返回类型做断言；运行时给一个同形的真实对象，
// 因为本仓库 vitest include 会让 test-d.ts 的回调也真实执行。
const templates = {
  'hello/card': {
    component: () => null
  }
} as unknown as Awaited<ReturnType<typeof loadTemplateRegistry>>

test('convention-loaded registry becomes precisely typed via module augmentation', async () => {
  // 模块增强生效后，keyof 收窄为字面量联合，不再是宽松的 string。
  expectTypeOf<keyof typeof templates & string>().toEqualTypeOf<'hello/card'>()
  expectTypeOf<DataOf<(typeof templates)['hello/card']>>().toEqualTypeOf<{
    title: string
    items: Array<{ label: string; value: string }>
  }>()

  // createRenderer 直接接受增强后的注册表（无索引签名），并保持逐路由类型绑定。
  const renderTemplate = createRenderer(templates, { cssPath: 'style.css', outputDir: 'dist' })
  await renderTemplate('hello/card', { title: 't', items: [] })

  // @ts-expect-error nonexistent template name
  await renderTemplate('hello/cars', { title: 't', items: [] })

  // @ts-expect-error missing required field
  await renderTemplate('hello/card', { title: 't' })

  // @ts-expect-error wrong field type
  await renderTemplate('hello/card', { title: 123, items: [] })
})
