import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="mb-4 text-sm font-semibold tracking-widest text-fd-muted-foreground">@karinjs/template-react</p>
      <h1 className="mb-4 text-4xl font-bold">用 React 写 Karin 截图模板</h1>
      <p className="mb-8 max-w-xl text-fd-muted-foreground">
        以 React + Tailwind CSS + TypeScript 替代 art-template：全链路类型、开发面板实时预览、真实数据自动捕获。
      </p>
      <div className="flex gap-3">
        <Link href="/docs/quick-start" className="rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground">
          快速开始
        </Link>
        <Link href="/docs" className="rounded-lg border border-fd-border px-5 py-2.5 font-medium">
          阅读文档
        </Link>
      </div>
    </div>
  )
}
