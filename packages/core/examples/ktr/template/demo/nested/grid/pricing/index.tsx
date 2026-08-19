import { Chip } from '@heroui/react'
import { Check } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 定价卡片中的一档方案。 */
interface PricingPlan {
  /** 方案名称。 */
  name: string
  /** 价格文案。 */
  price: string
  /** 价格单位，如 /月。 */
  unit: string
  /** 特性列表。 */
  features: string[]
  /** 是否推荐档，推荐档用 accent 高亮。 */
  recommended?: boolean
}

/** 三列定价方案模板的数据结构。 */
interface PricingData {
  /** 卡片标题。 */
  title: string
  /** 方案列表，建议三档。 */
  plans: PricingPlan[]
}

const Pricing = ({ data }: TemplateProps<PricingData>) => (
  <div className="overflow-hidden rounded-2xl border border-border bg-background p-8 text-foreground">
    <h1 className="text-center text-2xl font-bold tracking-normal">{data.title}</h1>
    <div className="mt-6 grid grid-cols-3 gap-4">
      {data.plans.map((plan) => (
        <div
          key={plan.name}
          className={`rounded-xl border p-5 ${plan.recommended ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{plan.name}</span>
            {plan.recommended && (
              <Chip className="bg-accent text-accent-foreground" size="sm" variant="tertiary">
                推荐
              </Chip>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-black">{plan.price}</span>
            <span className="text-xs text-muted">{plan.unit}</span>
          </div>
          <ul className="mt-4 grid gap-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-xs text-muted">
                <Check size={14} className="shrink-0 text-accent" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
)

export default defineTemplate({
  name: '定价方案',
  description: '三列定价卡片，中间推荐档高亮',
  component: Pricing
})
