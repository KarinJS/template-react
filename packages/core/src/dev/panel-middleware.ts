import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ViteDevServer } from 'vite'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
// 兼容源码（src/dev）和产物（dist）两种布局，向上两级都尝试定位 panel/dist。
const packageDirCandidates = [path.resolve(moduleDir, '..'), path.resolve(moduleDir, '../..')]

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
}

// 面板产物缺失时展示的兜底提示页，引导用户先构建 panel。
const fallbackPanelHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karin Template React</title>
  <style>
    body { margin: 0; font-family: Inter, "Segoe UI", sans-serif; background: #f7f7f8; color: #171717; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
    section { max-width: 560px; }
    code { background: #ececef; border-radius: 4px; padding: 2px 5px; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>Karin Template Panel</h1>
      <p>Panel assets have not been built yet. Run <code>pnpm --filter @karinjs/template-react build:panel</code>, then start <code>ktr dev</code> again.</p>
      <p>The sandbox is already available at <a href="/__ktr/sandbox">/__ktr/sandbox</a>.</p>
    </section>
  </main>
</body>
</html>`

const panelDistDir = (): string => {
  for (const packageDir of packageDirCandidates) {
    const distDir = path.resolve(packageDir, 'panel', 'dist')
    if (fs.existsSync(distDir)) {
      return distDir
    }
  }

  return path.resolve(packageDirCandidates[0] ?? moduleDir, 'panel', 'dist')
}

/**
 * 挂载面板静态资源，并在缺少构建产物时显示可读的提示页。
 * @param server Vite 开发服务器。
 * @returns 无返回值。
 */
export const registerPanelMiddleware = (server: ViteDevServer): void => {
  server.middlewares.use((req, res, next) => {
    // API、沙盒和 Vite 内部路径直接放行，这里只处理面板自身的静态资源请求。
    if (
      !req.url ||
      req.url.startsWith('/__ktr/api') ||
      req.url.startsWith('/__ktr/sandbox') ||
      req.url.startsWith('/@') ||
      req.url.startsWith('/src/') ||
      req.url.includes('__vite')
    ) {
      next()
      return
    }

    const url = new URL(req.url, 'http://ktr.local')
    const pathname = decodeURIComponent(url.pathname)
    const panelPathname = pathname.startsWith('/__ktr/panel') ? pathname.replace(/^\/__ktr\/panel\/?/, '/') : pathname
    const distDir = panelDistDir()

    if (pathname === '/') {
      res.statusCode = 302
      res.setHeader('Location', '/__ktr/panel/')
      res.end()
      return
    }

    if (!fs.existsSync(distDir)) {
      if (panelPathname === '/' || panelPathname === '/index.html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(fallbackPanelHtml)
        return
      }

      next()
      return
    }

    const relativePath = panelPathname === '/' ? 'index.html' : panelPathname.replace(/^\/+/, '')
    const filePath = path.resolve(distDir, relativePath)
    // 路径穿越防护 + SPA 兜底：越出 dist 或未命中静态文件时回退 index.html，交给前端路由。
    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const fallbackPath = path.join(distDir, 'index.html')
      if (fs.existsSync(fallbackPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(fs.readFileSync(fallbackPath))
        return
      }

      next()
      return
    }

    res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] ?? 'application/octet-stream')
    res.end(fs.readFileSync(filePath))
  })
}
