import { CircleCheck, ReceiptText } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 窄长收据模板的数据结构，演示非固定高度截图。 */
interface ReceiptTallData {
  /** 店铺或服务名称。 */
  shop: string
  /** 订单编号。 */
  orderId: string
  /** 收据明细行。 */
  rows: Array<{ label: string; value: string }>
  /** 合计金额或总结值。 */
  total: string
}

const ReceiptTall = ({ data }: TemplateProps<ReceiptTallData>) => (
  <div className="w-[430px] bg-background p-6 text-foreground">
    <div className="border border-border bg-surface p-6">
      <header className="border-b border-border pb-6 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center bg-accent text-accent-foreground">
          <ReceiptText size={26} />
        </div>
        <h1 className="text-2xl font-black tracking-normal">{data.shop}</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{data.orderId}</p>
      </header>

      <main className="divide-y divide-border">
        {data.rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 py-4 text-sm">
            <span className="text-muted">{row.label}</span>
            <strong className="text-right">{row.value}</strong>
          </div>
        ))}
      </main>

      <footer className="border-t border-border pt-5">
        <div className="flex items-center justify-between text-lg font-black">
          <span>合计</span>
          <span>{data.total}</span>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 bg-accent-soft py-3 text-sm font-bold text-accent">
          <CircleCheck size={18} />
          本地截图生成
        </div>
      </footer>
    </div>
  </div>
)

export default defineTemplate({
  name: '长条小票',
  description: '窄长小票版式的长截图',
  component: ReceiptTall,
  validate: (data): data is ReceiptTallData =>
    typeof data === 'object' &&
    data !== null &&
    typeof (data as ReceiptTallData).shop === 'string' &&
    Array.isArray((data as ReceiptTallData).rows)
})
