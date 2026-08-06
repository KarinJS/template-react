import { BadgeCheck, ChevronRight, Smartphone } from 'lucide-react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 1080x1920 竖屏故事图模板的数据结构。 */
interface MobileStoryData {
  /** 主标题。 */
  title: string
  /** 副标题或说明。 */
  subtitle: string
  /** 中间分点内容。 */
  bullets: string[]
  /** 底部行动文案。 */
  cta: string
}

const MobileStory = ({ data }: TemplateProps<MobileStoryData>) => (
  <div className="h-[1920px] w-[1080px] bg-background p-20 text-foreground">
    <div className="flex h-full flex-col justify-between border border-border bg-surface p-16">
      <header>
        <div className="mb-10 inline-flex items-center gap-3 bg-accent text-2xl font-bold text-accent-foreground px-5 py-3">
          <Smartphone size={34} />
          竖屏故事
        </div>
        <h1 className="text-8xl font-black leading-tight tracking-normal">{data.title}</h1>
        <p className="mt-8 text-4xl leading-relaxed text-muted">{data.subtitle}</p>
      </header>

      <main className="grid gap-8">
        {data.bullets.map((item, index) => (
          <div key={item} className="flex items-center gap-6 border border-border bg-background p-7">
            <span className="grid size-16 shrink-0 place-items-center bg-accent-soft text-2xl font-black text-accent">{index + 1}</span>
            <span className="text-3xl font-bold">{item}</span>
          </div>
        ))}
      </main>

      <footer className="flex items-center justify-between border-t border-border pt-10">
        <div className="flex items-center gap-4 text-2xl font-bold text-accent">
          <BadgeCheck size={34} />
          准备就绪，可以截图
        </div>
        <div className="flex items-center gap-3 text-3xl font-black">
          {data.cta}
          <ChevronRight size={42} />
        </div>
      </footer>
    </div>
  </div>
)

export default defineTemplate({
  name: '竖屏故事图',
  description: '1080x1920 竖屏手机故事图',
  component: MobileStory,
  validate: (data): data is MobileStoryData =>
    typeof data === 'object' &&
    data !== null &&
    typeof (data as MobileStoryData).title === 'string' &&
    Array.isArray((data as MobileStoryData).bullets)
})
