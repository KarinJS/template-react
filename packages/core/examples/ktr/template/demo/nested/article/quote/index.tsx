import { Quote } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 金句卡片模板的数据结构，适合窄版引文截图。 */
interface QuoteCardData {
  /** 引文内容。 */
  quote: string
  /** 署名作者。 */
  author: string
  /** 作者头衔或出处说明。 */
  role?: string
}

const QuoteCard = ({ data }: TemplateProps<QuoteCardData>) => (
  <div className="w-120 overflow-hidden rounded-2xl border border-border bg-background p-10 text-foreground">
    <div className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
      <Quote size={22} />
    </div>
    <blockquote className="mt-6 text-center text-2xl font-bold leading-relaxed">{data.quote}</blockquote>
    <footer className="mt-8 flex items-center justify-center gap-3 border-t border-border pt-6">
      <span className="text-sm font-bold text-accent">{data.author}</span>
      {data.role && <span className="text-xs text-muted">{data.role}</span>}
    </footer>
  </div>
)

export default defineTemplate({
  name: '金句卡片',
  description: '窄版居中引文卡片',
  component: QuoteCard
})
