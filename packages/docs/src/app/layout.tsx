import { RootProvider } from 'fumadocs-ui/provider/next'
import './global.css'
import { Inter } from 'next/font/google'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const inter = Inter({
  subsets: ['latin']
})

// og 图片等绝对地址的解析基准；CI 部署时通过 DOCS_BASE_URL 注入站点地址
export const metadata: Metadata = {
  metadataBase: new URL(process.env.DOCS_BASE_URL ?? 'https://karinjs.github.io/template-react')
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
