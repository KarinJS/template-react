import { Card, Chip } from '@heroui/react'
import { Braces, Layers3, Sparkles } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** Hello 卡片模板的数据结构，适合固定宽度的信息摘要截图。 */
type HelloCardData = {
  /** 主标题。 */
  title: string
  /** 可选副标题。 */
  subtitle?: string
  /** 展示在卡片内容区的键值对。 */
  items: Array<{ label: string; value: string }>
}

const HelloCard = ({ data }: TemplateProps<HelloCardData>) => (
  <Card className="w-155 gap-0 overflow-hidden rounded-3xl border border-border bg-background p-0 text-foreground">
    <Card.Header className="flex-row items-start justify-between gap-4 border-b border-border px-8 py-7">
      <div className="min-w-0">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-accent">
          <Sparkles size={16} />
          Karin 模板示例
        </div>
        <Card.Title className="text-3xl font-bold tracking-normal">{data.title}</Card.Title>
        {data.subtitle && <Card.Description className="mt-2 text-sm text-accent">{data.subtitle}</Card.Description>}
      </div>

      <Chip className="bg-accent text-accent-foreground" size="md" variant="tertiary">
        <Layers3 size={14} />
        HeroUI
      </Chip>
    </Card.Header>

    <Card.Content className="grid gap-3 px-8 py-7">
      {data.items.map((item, index) => (
        <div key={item.label} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
              {index === 0 ? <Braces size={16} /> : <Layers3 size={16} />}
            </span>
            <span className="truncate text-sm text-muted">{item.label}</span>
          </div>
          <strong className="text-base">{item.value}</strong>
        </div>
      ))}
    </Card.Content>
  </Card>
)

export default defineTemplate({
  name: '问候卡片',
  description: 'HeroUI + lucide-react 截图卡片',
  component: HelloCard
})
