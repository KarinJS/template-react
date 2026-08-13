import { Activity, ArrowUpRight, ServerCog } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 桌面仪表盘中的单个指标卡。 */
interface DashboardMetric {
  /** 指标名称。 */
  label: string
  /** 当前指标值。 */
  value: string
  /** 趋势或变化说明。 */
  delta: string
}

/** 1280x720 宽屏仪表盘模板的数据结构。 */
interface DashboardData {
  /** 主标题。 */
  title: string
  /** 左侧说明文案。 */
  description: string
  /** 顶部指标卡列表。 */
  metrics: DashboardMetric[]
  /** 下方柱状图高度，单位为像素。 */
  bars: number[]
}

const Dashboard = ({ data }: TemplateProps<DashboardData>) => (
  <div className="h-[720px] w-[1280px] bg-background p-10 text-foreground">
    <div className="grid h-full grid-cols-[340px_1fr] gap-8">
      <aside className="flex flex-col justify-between border border-border bg-surface p-8">
        <div>
          <div className="mb-7 flex size-14 items-center justify-center bg-accent text-accent-foreground">
            <ServerCog size={30} />
          </div>
          <h1 className="text-5xl font-black leading-tight tracking-normal">{data.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{data.description}</p>
        </div>
        <div className="flex items-center gap-3 text-accent">
          <Activity size={24} />
          <span className="text-sm font-bold uppercase tracking-[0.18em]">实时概览</span>
        </div>
      </aside>

      <main className="grid grid-rows-[auto_1fr] gap-8">
        <section className="grid grid-cols-3 gap-5">
          {data.metrics.map((metric) => (
            <div key={metric.label} className="border border-border bg-surface p-6">
              <div className="flex items-center justify-between text-muted">
                <span className="text-sm font-semibold uppercase tracking-[0.16em]">{metric.label}</span>
                <ArrowUpRight size={18} />
              </div>
              <div className="mt-4 text-4xl font-black">{metric.value}</div>
              <div className="mt-2 text-sm font-bold text-accent">{metric.delta}</div>
            </div>
          ))}
        </section>

        <section className="flex items-end gap-4 border border-border bg-surface p-8">
          {data.bars.map((height, index) => (
            <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center gap-3">
              <div className="w-full bg-accent-soft" style={{ height: `${Math.max(24, height)}px` }}>
                <div className="h-full w-full bg-accent opacity-75" />
              </div>
              <span className="text-xs font-bold text-muted">{index + 1}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  </div>
)

export default defineTemplate({
  name: '宽屏仪表盘',
  description: '1280x720 运营仪表盘截图',
  component: Dashboard,
  validate: (data): data is DashboardData =>
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as DashboardData).metrics) &&
    Array.isArray((data as DashboardData).bars)
})
