import { Camera, Database, Package, PanelsTopLeft } from 'lucide-react'
import Link from 'next/link'

const features = [
  {
    icon: PanelsTopLeft,
    title: '模板即组件',
    description: 'React + Tailwind CSS + TypeScript，目录即路由。'
  },
  {
    icon: Camera,
    title: '面板实时预览',
    description: '切换模板、数据和主题即改即见，一键截图。'
  },
  {
    icon: Database,
    title: '数据自动捕获',
    description: '真实渲染数据自动写回，面板即时回放。'
  },
  {
    icon: Package,
    title: '构建零安装',
    description: '整包进 lib/，生产环境零依赖安装。'
  }
] as const

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-14 px-6 py-16 text-center">
      <div>
        <p className="mb-4 text-sm font-semibold tracking-widest text-fd-muted-foreground">@karinjs/template-react</p>
        <h1 className="mb-4 text-4xl font-bold">用 React 写 Karin 截图模板</h1>
        <p className="mx-auto mb-8 max-w-xl text-fd-muted-foreground">全链路类型 · 面板实时预览 · 数据自动捕获</p>
        <div className="flex justify-center gap-3">
          <Link href="/docs/quick-start" className="rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground">
            快速开始
          </Link>
          <Link href="/docs" className="rounded-lg border border-fd-border px-5 py-2.5 font-medium">
            阅读文档
          </Link>
        </div>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border border-fd-border p-5 text-left">
            <feature.icon className="mb-3 size-5 text-fd-primary" />
            <div className="mb-1 font-semibold">{feature.title}</div>
            <p className="text-sm text-fd-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border border-fd-border px-5 py-3 font-mono text-sm text-fd-muted-foreground">
        <span>pnpm add -D @karinjs/template-react</span>
        <span className="text-fd-border">→</span>
        <span>ktr/template/**/index.tsx</span>
        <span className="text-fd-border">→</span>
        <span>ktr dev</span>
      </div>
    </div>
  )
}
