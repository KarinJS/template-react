import fs from 'node:fs'
import path from 'node:path'

import { intro, note, outro, text } from '@clack/prompts'

import { writeNewProjectPackageJson, writeNewProjectTsconfig } from './apply'
import { askScaffoldOptions, assertInteractive, detectPluginName, guard, runScaffold } from './prompts'

/** 检测项目使用的包管理器，用于结尾提示正确的安装命令。 */
const detectPackageManager = (root: string): 'pnpm' | 'yarn' | 'npm' => {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn'
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm'
  return 'pnpm'
}

/** ktr init：在已有 Karin 插件项目里补齐模板开发所需的一切。 */
export const initCommand = async (): Promise<void> => {
  assertInteractive()
  const root = process.cwd()
  intro('ktr init — 在当前项目里初始化 React 截图模板')

  const options = await askScaffoldOptions({ pluginName: detectPluginName(root) })
  await runScaffold(root, options)

  const pm = detectPackageManager(root)
  const install = pm === 'npm' ? 'npm install' : `${pm} install`
  note(`${install}\n${pm === 'npm' ? 'npm run' : pm} template`, '接下来')
  outro('初始化完成')
}

/** ktr create：从零建一个可直接跑起来的模板项目。 */
export const createCommand = async (nameArg?: string): Promise<void> => {
  assertInteractive()
  intro('ktr create — 新建一个 React 截图模板项目')

  const name =
    nameArg ??
    guard(
      await text({
        message: '项目名（同时作为目录名）',
        placeholder: 'karin-plugin-example',
        validate: (value) => {
          if (!value) return '项目名不能为空'
          if (!/^[a-z0-9@._/-]+$/i.test(value)) return '项目名只能包含字母、数字和 @ . _ / - '
          return undefined
        }
      })
    )

  const dirName = name.split('/').pop() ?? name
  const root = path.resolve(process.cwd(), dirName)
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) {
    throw new Error(`目录 ${dirName} 已存在且不为空，换个名字或先清空它`)
  }

  const options = await askScaffoldOptions({ pluginName: name })
  writeNewProjectPackageJson(root, name)
  writeNewProjectTsconfig(root)
  await runScaffold(root, options, true)

  note(`cd ${dirName}\npnpm install\npnpm template`, '接下来')
  outro('项目已创建')
}
