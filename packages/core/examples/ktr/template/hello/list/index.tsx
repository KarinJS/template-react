import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** Hello 列表模板的数据结构，演示重复行和表格类截图。 */
export interface HelloListData {
  /** 列表标题。 */
  title: string
  /** 排行或成员列表数据。 */
  users: Array<{ name: string; role: string; score: number }>
}

const HelloList = ({ data }: TemplateProps<HelloListData>) => (
  <div className="w-[640px] bg-background p-7 text-foreground">
    <h1 className="mb-5 text-2xl font-bold">{data.title}</h1>
    <div className="overflow-hidden rounded-md border border-border">
      {data.users.map((user, index) => (
        <div
          key={user.name}
          className="grid grid-cols-[44px_1fr_80px] items-center gap-3 border-b border-border bg-surface px-4 py-3 odd:bg-background even:bg-accent-soft last:border-b-0"
        >
          <span className="text-sm font-semibold text-accent">#{index + 1}</span>
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-muted">{user.role}</p>
          </div>
          <strong className="text-right text-lg text-accent">{user.score}</strong>
        </div>
      ))}
    </div>
  </div>
)

export default defineTemplate({
  name: '成员榜单',
  description: '多行重复的列表截图示例',
  component: HelloList
})
