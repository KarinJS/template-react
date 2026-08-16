// 把 packages/core/package.json 的 time 字段更新为当前时间（YYYY-MM-DD HH:mm:ss，本地时区）。
// 由 .husky/pre-commit 在每次提交前调用，保证任何更改都会刷新该时间戳。
import { readFileSync, writeFileSync } from 'node:fs'

const packageJsonPath = new URL('../packages/core/package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

const pad = (value) => String(value).padStart(2, '0')
const now = new Date()
pkg.time =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
  `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`packages/core/package.json time -> ${pkg.time}`)
