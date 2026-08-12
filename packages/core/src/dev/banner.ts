/** 启动详情字段。 */
export interface StartupDetail {
  /** 面板本地地址。 */
  panelUrl: string
  /** 面板局域网地址列表。 */
  networkUrls: string[]
  /** 已发现的模板数量。 */
  templateCount: number
  /** 实际监听端口。 */
  port: number
  /** 期望监听端口。 */
  requestedPort: number
  /** 启动耗时（毫秒）。 */
  elapsed: number
  /** 端口冲突详情，未冲突时不传。 */
  portConflict?: {
    /** 占用进程描述列表。 */
    holders: string[]
    /** 可用于释放端口的命令列表。 */
    commands: string[]
  }
}

/** ANSI 颜色包装，终端不支持颜色时自动降级为纯文本。 */
const supportsColor = (): boolean => {
  if (process.env.NO_COLOR || process.env.FORCE_COLOR === '0') return false
  return process.stdout.isTTY === true
}

const wrap = (open: string, text: string): string => (supportsColor() ? `\u001B[${open}m${text}\u001B[0m` : text)

/** 终端着色助手，仅覆盖启动详情用到的几种样式。 */
const color = {
  bold: (text: string) => wrap('1', text),
  dim: (text: string) => wrap('2', text),
  cyan: (text: string) => wrap('36', text),
  green: (text: string) => wrap('32', text),
  yellow: (text: string) => wrap('33', text),
  magenta: (text: string) => wrap('35', text)
}

/**
 * 清空终端旧输出，行为对齐 Vite 的 clearScreen。
 * 依赖预打包、CSS 构建等启动噪声会把真正有用的地址冲到屏幕外，清屏后只留启动详情。
 * @returns 无返回值。
 */
export const clearScreen = (): void => {
  if (!process.stdout.isTTY) return
  process.stdout.write('\u001B[2J\u001B[3J\u001B[H')
}

/**
 * 打印启动完成详情，取代散落的多行日志。
 * @param detail 启动详情字段。
 * @returns 无返回值。
 */
export const printStartupDetail = (detail: StartupDetail): void => {
  const lines: string[] = []
  lines.push('')
  lines.push(`  ${color.bold(color.magenta('KTR'))} ${color.dim('模板开发面板已就绪')}  ${color.dim(`${detail.elapsed}ms`)}`)
  lines.push('')
  lines.push(`  ${color.green('➜')}  ${color.bold('面板')}    ${color.cyan(detail.panelUrl)}`)
  for (const url of detail.networkUrls) {
    lines.push(`  ${color.green('➜')}  ${color.bold('局域网')}  ${color.cyan(url)}`)
  }
  lines.push(`  ${color.dim('➜')}  ${color.dim(`模板    ${detail.templateCount} 个`)}`)
  if (detail.portConflict) {
    lines.push('')
    lines.push(
      `  ${color.yellow('⚠')}  端口 ${color.bold(String(detail.requestedPort))} 已被占用，已自动切换到 ${color.bold(String(detail.port))}`
    )
    for (const holder of detail.portConflict.holders) {
      lines.push(`     ${color.dim(`占用进程：${holder}`)}`)
    }
    lines.push(`     ${color.dim('要释放原端口，可执行：')}`)
    for (const command of detail.portConflict.commands) {
      lines.push(`     ${color.yellow(command)}`)
    }
  }
  lines.push('')
  process.stdout.write(`${lines.join('\n')}\n`)
}
