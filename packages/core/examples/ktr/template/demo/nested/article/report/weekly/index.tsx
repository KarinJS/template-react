import { CalendarRange, PenLine } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 周报封面模板的数据结构，验证四级目录嵌套扫描。 */
interface WeeklyReportData {
  /** 周报标题。 */
  title: string
  /** 统计周期，如 2026.08.10 - 2026.08.16。 */
  period: string
  /** 本周要点列表。 */
  highlights: string[]
  /** 底部署名。 */
  author: string
}

const WeeklyReport = ({ data }: TemplateProps<WeeklyReportData>) => (
  <div className="w-140 overflow-hidden rounded-2xl border border-border bg-background p-8 text-foreground">
    <header className="border-b border-border pb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">demo/nested/article/report/weekly</p>
      <h1 className="text-3xl font-bold tracking-normal">{data.title}</h1>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted">
        <CalendarRange size={15} />
        {data.period}
      </div>
    </header>

    <main className="mt-6 grid gap-3">
      {data.highlights.map((item, index) => (
        <div key={item} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-sm font-black text-accent">
            {index + 1}
          </span>
          <span className="text-sm font-medium">{item}</span>
        </div>
      ))}
    </main>

    <footer className="mt-6 flex items-center justify-between rounded-xl bg-accent px-5 py-3 text-sm font-bold text-accent-foreground">
      <span className="flex items-center gap-2">
        <PenLine size={15} />
        {data.author}
      </span>
      <span>周报自动生成</span>
    </footer>
  </div>
)

export default defineTemplate({
  name: '周报封面',
  description: '四级嵌套路由的周报封面卡片',
  component: WeeklyReport
})
