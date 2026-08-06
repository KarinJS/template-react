import type { UserConfig as ViteUserConfig } from 'vite'

import type { ResolvedKtrConfig } from '../types'

/**
 * 解析用户传入的 Vite 扩展配置，支持对象或按 dev/build 区分的函数。
 * @param config 已解析的 ktr 配置。
 * @param command 当前命令，serve 表示开发服务，build 表示生产构建。
 * @param mode Vite 运行模式。
 * @returns 可合并进内部配置的 Vite 用户配置。
 */
export const resolveKtrViteConfig = async (
  config: ResolvedKtrConfig,
  command: 'serve' | 'build',
  mode: string
): Promise<ViteUserConfig> => {
  if (!config.vite) {
    return {}
  }

  if (typeof config.vite === 'function') {
    return config.vite({ command, mode, config })
  }

  return config.vite
}
