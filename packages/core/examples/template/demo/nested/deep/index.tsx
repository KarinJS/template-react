import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 深层目录示例的数据结构，验证约定扫描可以处理嵌套路由。 */
export interface DeepDemoData {
  /** 模板标题。 */
  title: string
  /** 主体提示文案。 */
  message: string
  /** 标签列表。 */
  tags: string[]
}

const DeepDemo = async ({ data }: TemplateProps<DeepDemoData>) => {
  await Promise.resolve()

  return (
    <div className="w-130 bg-background p-8 text-foreground">
      <p className="mb-3 text-xs font-semibold uppercase tracking-normal text-accent">demo/nested/deep</p>
      <h1 className="text-3xl font-bold">{data.title}</h1>
      <p className="mt-4 rounded-md border border-border bg-accent-soft p-4 text-sm leading-6">{data.message}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {data.tags.map((tag) => (
          <span key={tag} className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export default defineTemplate({
  name: '深层嵌套',
  description: '嵌套路由与异步组件示例',
  component: DeepDemo
})
