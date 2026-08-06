import fs from 'node:fs'
import path from 'node:path'

import { buildTemplates } from '../build'
import type { ResolvedKtrConfig } from '../types'

/**
 * 开发环境 CSS 缓存文件路径，固定放在 node_modules/.cache 下。
 * @param root 项目根目录。
 * @returns 缓存 CSS 的绝对路径。
 */
export const templateCssCachePath = (root: string): string => path.join(root, 'node_modules', '.cache', 'ktr', 'style.css')

/**
 * 开发环境把 CSS 构建到 node_modules/.cache，避免污染用户模板目录。
 * @param config 已解析的 ktr 配置。
 * @returns 实际可用的 CSS 文件路径。
 */
export const ensureDevCss = async (config: ResolvedKtrConfig): Promise<string> => {
  const cachePath = templateCssCachePath(config.root)
  await buildTemplates({
    ...config,
    outDir: path.dirname(cachePath)
  })

  if (!fs.existsSync(cachePath)) {
    // 构建产物命名有差异时，回退到同目录下实际生成的 style.css。
    const builtPath = path.join(path.dirname(cachePath), 'style.css')
    if (fs.existsSync(builtPath)) {
      return builtPath
    }
  }

  return cachePath
}
