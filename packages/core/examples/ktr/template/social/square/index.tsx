import { Chip } from '@heroui/react'
import { Heart, MessageCircle, Share2, Sparkles } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 1080x1080 社交媒体方图模板的数据结构。 */
interface SocialSquareData {
  /** 创作者或账号名。 */
  creator: string
  /** 大标题。 */
  headline: string
  /** 正文摘要。 */
  summary: string
  /** 统计数据卡片。 */
  stats: Array<{ label: string; value: string }>
  /** 底部高亮信息标签。 */
  highlights: string[]
}

const SocialSquare = ({ data }: TemplateProps<SocialSquareData>) => (
  <div className="h-[1080px] w-[1080px] bg-background p-16 text-foreground">
    <div className="flex h-full flex-col justify-between border border-border bg-surface p-14">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-5 flex items-center gap-3 text-xl font-semibold text-accent">
            <Sparkles size={28} />
            {data.creator}
          </div>
          <h1 className="max-w-[760px] text-7xl font-black leading-tight tracking-normal">{data.headline}</h1>
        </div>
        <Chip className="bg-accent text-accent-foreground" size="lg" variant="tertiary">
          方图
        </Chip>
      </header>

      <main className="grid gap-8">
        <p className="max-w-[840px] text-3xl leading-relaxed text-muted">{data.summary}</p>
        <div className="grid grid-cols-3 gap-4">
          {data.stats.map((stat) => (
            <div key={stat.label} className="border border-border bg-background p-6">
              <div className="text-4xl font-black">{stat.value}</div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-6 border-t border-border pt-8">
        <div className="flex flex-wrap gap-3">
          {data.highlights.map((item) => (
            <span key={item} className="bg-accent-soft px-4 py-2 text-lg font-semibold text-accent">
              {item}
            </span>
          ))}
        </div>
        <div className="flex gap-4 text-muted">
          <Heart size={30} />
          <MessageCircle size={30} />
          <Share2 size={30} />
        </div>
      </footer>
    </div>
  </div>
)

export default defineTemplate({
  name: '社媒方图',
  description: '1080x1080 社交媒体方形卡片',
  component: SocialSquare,
  validate: (data): data is SocialSquareData =>
    typeof data === 'object' &&
    data !== null &&
    typeof (data as SocialSquareData).creator === 'string' &&
    Array.isArray((data as SocialSquareData).stats)
})
