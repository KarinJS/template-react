import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // GitHub Pages 静态部署：整站导出为纯静态文件，不依赖 Node 服务
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // 项目页部署在 /<repo>/ 子路径，CI 注入 DOCS_BASE_PATH；本地开发默认为空
  basePath: process.env.DOCS_BASE_PATH ?? ''
}

export default withMDX(config)
