import fs from 'node:fs'
import path from 'node:path'

import { cac } from 'cac'
import { consola } from 'consola'

import { resolveConfig } from '../config'
import { buildStandalone } from '../build/standalone'
import { ensureConventions } from '../conventions/registry'
import { createDevServer } from '../dev/server'
import { explicitOpenFlag } from './args'
import { localizeHelpSections } from './help'
import { createCommand, initCommand } from './scaffold'

/**
 * 从包自身的 package.json 读版本号，避免在源码里写死（发布时 release-please 只改 package.json）。
 * 打包产物 dist/cli.mjs 与源码 src/cli/index.ts 目录层级不同，两个候选路径都尝试。
 */
const readCliVersion = (): string => {
  for (const relative of ['../package.json', '../../package.json']) {
    try {
      const pkg = JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf-8')) as { version?: unknown }
      if (typeof pkg.version === 'string') return pkg.version
    } catch {
      // 候选路径不存在或解析失败时尝试下一个。
    }
  }
  return '0.0.0'
}

/** ktr 是下游插件项目里主要使用的开发命令入口。 */
const cli = cac('ktr')

cli.command('init', '在当前项目里初始化模板开发环境').action(async () => {
  await initCommand()
})

cli.command('create [name]', '新建一个模板项目').action(async (name?: string) => {
  await createCommand(name)
})

cli
  .command('dev', '启动模板开发面板')
  .option('--port <port>', '开发面板端口')
  .option('--host <host>', '开发面板监听地址')
  .option('--open', '启动后打开浏览器')
  .option('--no-open', '启动后不打开浏览器')
  .action(async (options: { port?: string | number; host?: string }) => {
    // 命令行参数只覆盖 dev 子配置，其他配置继续从 karin.template.ts 和默认值读取；
    // open 必须按原始 argv 判断显式传参，cac 的 --no-open 默认值不能用来区分。
    const dev: { port?: number; host?: string; open?: boolean } = {}
    if (options.port) {
      dev.port = Number(options.port)
    }
    if (options.host) {
      dev.host = options.host
    }
    const openFlag = explicitOpenFlag(process.argv)
    if (openFlag !== undefined) {
      dev.open = openFlag
    }

    const config = await resolveConfig({
      overrides: {
        dev
      }
    })
    // 启动详情（含地址、模板数、端口冲突提示）由 createDevServer 在清屏后统一打印，这里不再重复输出。
    await createDevServer(config)
  })

cli.command('sync', '扫描 template/ 并生成约定注册表文件').action(async () => {
  // TypeScript 类型检查和 IDE 跳转依赖隐藏注册表，因此提供一个显式同步命令。
  const config = await resolveConfig()
  const result = await ensureConventions(config)
  if (result.routes.length === 0) {
    // 扫到 0 个模板时给出可操作的指引，而不是只报一个令人困惑的“0 个模板”。
    const templateDir = path.relative(config.root, config.templateDir) || config.templateDir
    consola.warn(`在 ${templateDir} 下没有扫描到任何模板（约定：<板块>/<模板>/index.tsx 默认导出 defineTemplate）`)
    consola.info('还没有模板的话可以运行 `ktr init` 初始化模板开发环境，交互中选择生成官方示例模板后参照改写。')
    return
  }
  consola.success(`模板注册表已就绪：${result.routes.length} 个模板 -> ${result.registryPath}`)
})

cli.command('build', '构建可被 Node.js 直接导入的独立模板运行包').action(async () => {
  const config = await resolveConfig()
  const result = await buildStandalone(config)
  consola.success(`已构建 ${result.templatesCount} 个模板，CSS ${result.cssSize} 字节 -> ${result.entryPath}`)
})

cli.help(localizeHelpSections)
cli.version(readCliVersion())

// 先 parse 不立即执行，再由 runMatchedCommand 统一捕获子命令的异步错误。
cli.parse(process.argv, { run: false })

// 不带任何参数时输出帮助而不是静默退出；
// --help / --version 已由 cac 在 parse 阶段处理并打印，这里不再重复输出。
if (!cli.matchedCommand && cli.args.length === 0 && !cli.options.help && !cli.options.version) {
  cli.outputHelp()
}

try {
  await cli.runMatchedCommand()
} catch (error) {
  consola.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
