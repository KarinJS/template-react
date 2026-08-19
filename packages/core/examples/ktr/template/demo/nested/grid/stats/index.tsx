import { Activity, MessagesSquare, TriangleAlert, Users } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 统计网格中的单个指标项。 */
interface StatMetric {
  /** 指标名称。 */
  label: string
  /** 当前指标值。 */
  value: string
  /** 环比变化文案。 */
  delta: string
  /** 环比方向，决定涨跌配色（正绿负红）。 */
  trend: 'up' | 'down'
}

/** 2x2 bento 统计网格模板的数据结构。 */
interface StatsGridData {
  /** 卡片标题。 */
  title: string
  /** 四个统计指标。 */
  metrics: StatMetric[]
}

/** 指标按序轮转的图标，避免数据里写组件引用。 */
const METRIC_ICONS = [Users, MessagesSquare, Activity, TriangleAlert]

const StatsGrid = ({ data }: TemplateProps<StatsGridData>) => (
  <div className="w-140 overflow-hidden rounded-2xl border border-border bg-background p-8 text-foreground">
    <h1 className="text-2xl font-bold tracking-normal">{data.title}</h1>
    <div className="mt-6 grid grid-cols-2 gap-4">
      {data.metrics.map((metric, index) => {
        const Icon = METRIC_ICONS[index % METRIC_ICONS.length]
        return (
          <div key={metric.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              <span className="grid size-7 place-items-center rounded-md bg-accent-soft text-accent">
                <Icon size={15} />
              </span>
              {metric.label}
            </div>
            <div className="mt-3 text-3xl font-black">{metric.value}</div>
            <div className={`mt-1 text-xs font-bold ${metric.trend === 'up' ? 'text-success' : 'text-danger'}`}>
              {metric.delta} 环比上周
            </div>
          </div>
        )
      })}
    </div>
  </div>
)

export default defineTemplate({
  name: '统计网格',
  description: '2x2 bento 风格统计指标卡',
  component: StatsGrid
})
