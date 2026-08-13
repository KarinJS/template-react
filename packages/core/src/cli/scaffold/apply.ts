import fs from 'node:fs'
import path from 'node:path'

import { scaffoldDevDependencies, scaffoldScripts, type ScaffoldFile } from './files'

/** 单个文件的写入结果。 */
export interface ScaffoldOutcome {
  /** 相对项目根目录的路径。 */
  path: string
  /** created 新建；overwritten 覆盖；skipped 保留原文件。 */
  status: 'created' | 'overwritten' | 'skipped'
}

/**
 * 找出计划中已经存在的文件，交给调用方询问是否覆盖。
 * @param root 项目根目录。
 * @param files 计划写入的文件。
 * @returns 已存在文件的相对路径列表。
 */
export const existingFiles = (root: string, files: ScaffoldFile[]): string[] =>
  files.filter((file) => fs.existsSync(path.join(root, file.path))).map((file) => file.path)

/**
 * 写入脚手架文件。
 * @param root 项目根目录。
 * @param files 计划写入的文件。
 * @param overwrite 是否覆盖已存在的文件。
 * @returns 每个文件的写入结果。
 */
export const writeScaffoldFiles = (root: string, files: ScaffoldFile[], overwrite: boolean): ScaffoldOutcome[] =>
  files.map((file) => {
    const target = path.join(root, file.path)
    const exists = fs.existsSync(target)
    if (exists && !overwrite) {
      return { path: file.path, status: 'skipped' }
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, file.content, 'utf-8')
    return { path: file.path, status: exists ? 'overwritten' : 'created' }
  })

/**
 * 给 tsconfig.json 补上 jsx: react-jsx——少了它写 .tsx 模板全是红线。
 * 用正则在原文上插入而不是 JSON.parse 重写：下游 tsconfig 常有注释和特定格式，重写会全部丢失。
 * @param root 项目根目录。
 * @returns patched 已补上；already 本来就有；missing 没有 tsconfig.json。
 */
export const patchTsconfigJsx = (root: string): 'patched' | 'already' | 'missing' => {
  const target = path.join(root, 'tsconfig.json')
  if (!fs.existsSync(target)) return 'missing'
  const source = fs.readFileSync(target, 'utf-8')
  if (/"jsx"\s*:/.test(source)) return 'already'
  const patched = source.replace(/("compilerOptions"\s*:\s*\{)/, '$1\n    "jsx": "react-jsx",')
  if (patched === source) return 'missing'
  fs.writeFileSync(target, patched, 'utf-8')
  return 'patched'
}

/**
 * 按键名排序，保持 package.json 依赖块稳定可读。
 *
 * 先取键名再排序，避免对 entries 数组原地排序：
 * 本仓 lib 目标是 ES2022，还用不了 toSorted。
 */
const sortKeys = (input: Record<string, string>): Record<string, string> => {
  const keys = Object.keys(input)
  keys.sort((a, b) => a.localeCompare(b))

  return Object.fromEntries(keys.map((key) => [key, input[key]!]))
}

/**
 * 给下游 package.json 补开发依赖和脚本，已存在的键一律不覆盖（尊重用户已有版本和命令）。
 * @param root 项目根目录。
 * @param extraDependencies 除 scaffoldDevDependencies 外额外写入的依赖（如 withExample 时的 lucide-react）。
 * @returns 实际新增的依赖和脚本。
 */
export const patchPackageJson = (
  root: string,
  extraDependencies: Record<string, string> = {}
): { addedDependencies: string[]; addedScripts: string[] } => {
  const target = path.join(root, 'package.json')
  const pkg: Record<string, any> = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf-8')) : {}
  const devDependencies: Record<string, string> = pkg.devDependencies ?? {}
  const scripts: Record<string, string> = pkg.scripts ?? {}
  const dependencies: Record<string, string> = pkg.dependencies ?? {}

  const addedDependencies: string[] = []
  for (const [name, version] of Object.entries({ ...scaffoldDevDependencies, ...extraDependencies })) {
    if (devDependencies[name] || dependencies[name]) continue
    devDependencies[name] = version
    addedDependencies.push(name)
  }

  const addedScripts: string[] = []
  for (const [name, command] of Object.entries(scaffoldScripts)) {
    if (scripts[name]) continue
    scripts[name] = command
    addedScripts.push(name)
  }

  pkg.devDependencies = sortKeys(devDependencies)
  pkg.scripts = scripts
  fs.writeFileSync(target, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')

  return { addedDependencies, addedScripts }
}

/**
 * 为 ktr create 生成一个新项目的 package.json 骨架。
 * @param root 新项目目录。
 * @param name 项目名。
 * @returns 无返回值。
 */
export const writeNewProjectPackageJson = (root: string, name: string): void => {
  const pkg = {
    name,
    version: '1.0.0',
    type: 'module',
    main: 'lib/index.js',
    scripts: {},
    devDependencies: {}
  }
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
}

/** ktr create 生成的新项目 tsconfig.json。 */
export const writeNewProjectTsconfig = (root: string): void => {
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          jsx: 'react-jsx',
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          outDir: 'lib'
        },
        include: ['src', 'ktr', '.ktr']
      },
      null,
      2
    )}\n`,
    'utf-8'
  )
}
