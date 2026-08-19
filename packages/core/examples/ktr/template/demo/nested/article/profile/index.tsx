import { Chip } from '@heroui/react'

import { defineTemplate, type TemplateProps } from '@karinjs/template-react'

/** 作者卡片模板的数据结构。 */
interface AuthorProfileData {
  /** 作者名字，头像位自动取首字。 */
  name: string
  /** 头衔或一句话定位。 */
  title: string
  /** 作者简介。 */
  bio: string
  /** 底部标签列表。 */
  tags: string[]
}

const AuthorProfile = ({ data }: TemplateProps<AuthorProfileData>) => (
  <div className="w-140 overflow-hidden rounded-2xl border border-border bg-background p-8 text-foreground">
    <div className="flex items-center gap-5">
      <div
        className="grid size-20 shrink-0 place-items-center rounded-full text-3xl font-black text-accent-foreground"
        style={{ backgroundImage: 'linear-gradient(135deg, var(--accent), var(--accent-soft))' }}
      >
        {data.name.charAt(0)}
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-normal">{data.name}</h1>
        <p className="mt-1 text-sm text-accent">{data.title}</p>
      </div>
    </div>
    <p className="mt-6 text-sm leading-6 text-muted">{data.bio}</p>
    <div className="mt-6 flex flex-wrap gap-2">
      {data.tags.map((tag) => (
        <Chip key={tag} className="bg-accent-soft text-accent" size="sm" variant="tertiary">
          {tag}
        </Chip>
      ))}
    </div>
  </div>
)

export default defineTemplate({
  name: '作者卡片',
  description: '带头像位的作者简介卡片',
  component: AuthorProfile
})
