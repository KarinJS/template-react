import { cac } from 'cac'
import { consola } from 'consola'

import { buildTemplates } from '../build'
import { resolveConfig } from '../config'
import { ensureConventions } from '../conventions/registry'
import { createDevServer } from '../dev/server'
import { explicitOpenFlag } from './args'
import { createCommand, initCommand } from './scaffold'

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
  consola.success(`模板注册表已就绪：${result.routes.length} 个模板 -> ${result.registryPath}`)
})

cli
  .command('build', '构建模板 CSS')
  .option('--outDir <dir>', '输出目录')
  .action(async (options: { outDir?: string }) => {
    // 构建前会再次同步约定产物，保证生产环境使用的是最新模板清单。
    await buildTemplates(options.outDir ? { outDir: options.outDir } : {})
  })

cli.help()
cli.version('0.1.0')

// 先 parse 不立即执行，再由 runMatchedCommand 统一捕获子命令的异步错误。
cli.parse(process.argv, { run: false })

try {
  await cli.runMatchedCommand()
} catch (error) {
  consola.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
