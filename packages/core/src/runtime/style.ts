import fs from 'node:fs'
import path from 'node:path'

/**
 * 根据当前环境选择模板 CSS，开发时优先缓存，生产时优先 dist/template。
 * @param options 可选的 dist 目录和缓存路径覆盖。
 * @returns 最终使用的 CSS 文件绝对路径。
 */
export const resolveTemplateStyle = (options?: { distDir?: string; cachePath?: string }): string => {
  const cachePath = path.resolve(options?.cachePath ?? path.join('node_modules', '.cache', 'ktr', 'style.css'))
  const distPath = path.resolve(options?.distDir ?? path.join('dist', 'template'), 'style.css')

  if (process.env.NODE_ENV === 'development') {
    return cachePath
  }

  if (!fs.existsSync(distPath)) {
    return cachePath
  }

  if (!fs.existsSync(cachePath)) {
    return distPath
  }

  // 两份 CSS 都存在时取修改时间较新的一份，避免重新构建后还在用旧缓存。
  const cacheStat = fs.statSync(cachePath)
  const distStat = fs.statSync(distPath)
  return cacheStat.mtimeMs >= distStat.mtimeMs ? cachePath : distPath
}
