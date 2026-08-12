import fs from 'node:fs'
import path from 'node:path'

import { cancel, confirm, isCancel, log, note, select, text } from '@clack/prompts'

import { existingFiles, patchPackageJson, patchTsconfigJsx, writeScaffoldFiles } from './apply'
import { scaffoldFiles, type ScaffoldOptions, type ScaffoldStyle } from './files'

/** 用户中断时统一退出，避免各处重复写 isCancel 分支。 */
export const guard = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel('已取消')
    process.exit(0)
  }
  return value as T
}

/**
 * 交互式命令需要真实终端：确认框和单选框靠 raw mode 逐键读取，
 * 管道或重定向的 stdin 拿不到按键，进程会静默挂在第一个提问上（表现为退出码 13）。
 * 这里提前拦下来给出可操作的中文提示。
 * @returns 无返回值，非 TTY 时直接抛错。
 */
export const assertInteractive = (): void => {
  if (!process.stdin.isTTY) {
    throw new Error('这个命令需要在交互式终端里运行（当前 stdin 不是终端，无法读取按键）。请直接在终端执行，不要用管道或重定向输入。')
  }
}

/** 交互收集脚手架选项。 */
export const askScaffoldOptions = async (defaults: { pluginName: string }): Promise<ScaffoldOptions> => {
  const style = guard(
    await select({
      message: '模板样式怎么来？',
      options: [
        {
          value: 'builtin',
          label: 'ktr 自带（继承 HeroUI 默认主题）',
          hint: '开箱即用，text-accent / bg-surface 等直接有颜色'
        },
        {
          value: 'custom',
          label: 'HeroUI + 自定义换肤块',
          hint: '同上，额外生成注释好的 :root / .dark 覆盖块'
        }
      ]
    })
  ) as ScaffoldStyle

  const withExample = guard(await confirm({ message: '生成示例模板 template/hello/card/？' }))
  const withGlue = guard(await confirm({ message: '生成 src/utils/render.ts 胶水层（把模板渲染接到 Karin 截图）？' }))

  const port = guard(
    await text({
      message: '开发面板端口',
      placeholder: '5180',
      defaultValue: '5180',
      validate: (value) => {
        if (!value) return
        const parsed = Number(value)
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return '端口需要是 1-65535 的整数'
        return undefined
      }
    })
  )

  return {
    style,
    withExample,
    withGlue,
    port: Number(port) || 5180,
    pluginName: defaults.pluginName
  }
}

/** 从 package.json 读插件名，读不到时用目录名。 */
export const detectPluginName = (root: string): string => {
  const pkgPath = path.join(root, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.name) return pkg.name
    } catch {
      // package.json 解析失败时回落到目录名
    }
  }
  return path.basename(root)
}

/**
 * 在已有项目里执行脚手架：写文件、补 tsconfig 和 package.json。
 * @param root 项目根目录。
 * @param options 脚手架选项。
 * @param skipConflictPrompt 为 true 时不询问覆盖（新建项目场景，目录本来是空的）。
 * @returns 无返回值。
 */
export const runScaffold = async (root: string, options: ScaffoldOptions, skipConflictPrompt = false): Promise<void> => {
  const files = scaffoldFiles(options)

  let overwrite = true
  if (!skipConflictPrompt) {
    const conflicts = existingFiles(root, files)
    if (conflicts.length > 0) {
      note(conflicts.join('\n'), '这些文件已存在')
      overwrite = guard(
        await confirm({
          message: '覆盖它们？选否会保留原文件，只写缺失的部分',
          initialValue: false
        })
      )
    }
  }

  const outcomes = writeScaffoldFiles(root, files, overwrite)
  const created = outcomes.filter((item) => item.status === 'created').map((item) => item.path)
  const overwritten = outcomes.filter((item) => item.status === 'overwritten').map((item) => item.path)
  const skipped = outcomes.filter((item) => item.status === 'skipped').map((item) => item.path)

  if (created.length > 0) log.success(`新建 ${created.length} 个文件\n${created.join('\n')}`)
  if (overwritten.length > 0) log.warn(`覆盖 ${overwritten.length} 个文件\n${overwritten.join('\n')}`)
  if (skipped.length > 0) log.info(`保留原有 ${skipped.length} 个文件\n${skipped.join('\n')}`)

  const jsx = patchTsconfigJsx(root)
  if (jsx === 'patched') {
    log.success('tsconfig.json 已补上 jsx: react-jsx')
  } else if (jsx === 'missing') {
    log.warn('没找到 tsconfig.json（或格式无法自动修改），请手动加上 compilerOptions.jsx = "react-jsx"')
  }

  const { addedDependencies, addedScripts } = patchPackageJson(root)
  if (addedDependencies.length > 0) log.success(`package.json 新增依赖：${addedDependencies.join('、')}`)
  if (addedScripts.length > 0) log.success(`package.json 新增脚本：${addedScripts.join('、')}`)
}
