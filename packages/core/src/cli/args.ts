/**
 * 从原始命令行参数判断是否显式传了 --open/--no-open。
 * cac 注册 --no-open 后会把 open 默认值置 true，不能用 options.open 判断是否显式传参，
 * 否则 karin.template.ts 里的 open: false 会被 CLI 默认值无条件覆盖。
 * @param argv 进程原始参数列表（process.argv）。
 * @returns 显式传参时返回对应布尔值，未传参时返回 undefined。
 */
export const explicitOpenFlag = (argv: string[]): boolean | undefined => {
  if (argv.includes('--open')) {
    return true
  }
  if (argv.includes('--no-open')) {
    return false
  }
  return undefined
}
