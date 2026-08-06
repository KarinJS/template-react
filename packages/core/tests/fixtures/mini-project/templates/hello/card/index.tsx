import { defineTemplate, type TemplateProps } from '../../../../../../src'

export interface HelloCardData {
  title: string
  items: Array<{ label: string; value: string }>
}

const Card = ({ data, ctx }: TemplateProps<HelloCardData>) => (
  <div id="container" className={`flex ${ctx.theme?.mode === 'dark' ? 'dark' : ''}`} data-scale={ctx.scale}>
    <h1>{data.title}</h1>
    {data.items.map((item) => (
      <p key={item.label}>
        {item.label}: {item.value}
      </p>
    ))}
  </div>
)

export default defineTemplate<HelloCardData>({
  name: 'Card',
  component: Card,
  validate: (data): data is HelloCardData => {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof (data as HelloCardData).title === 'string' &&
      Array.isArray((data as HelloCardData).items)
    )
  }
})
