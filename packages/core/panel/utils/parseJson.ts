/**
 * 面板 JSON 工具：容错解析、格式化与导出文件名生成。
 * 全部为纯函数，不依赖 DOM，方便在 node 环境下做单元测试。
 */

/** 判断值是否为普通对象字面量，拒绝类实例、Date 等特殊对象。 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * 容错解析 JSON 文本：先走标准 JSON.parse；失败后退回 `new Function` 求值，
 * 以容忍单引号字符串、无引号 key 和尾逗号等常见手写习惯。
 * 兜底分支只接受对象/数组字面量结果（数字、字符串、函数返回值等一律拒绝），
 * 避免把任意表达式求值当成合法 mock 数据。
 *
 * @param text 待解析的 JSON 文本。
 * @returns 解析出的对象或数组。
 * @throws 语法无法解析，或兜底结果不是对象/数组字面量时抛出中文错误。
 */
export const parseJsonLenient = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    // 标准解析失败，进入容错分支
  }

  let evaluated: unknown
  try {
    // 仅在面板内对用户自己输入的草稿求值，且下面会校验结果必须是对象/数组字面量。
    evaluated = new Function(`return (${text})`)() as unknown
  } catch {
    throw new Error('JSON 解析失败：请检查语法（容忍单引号、无引号 key 和尾逗号，但只接受对象/数组字面量）')
  }

  if (!Array.isArray(evaluated) && !isPlainObject(evaluated)) {
    throw new Error('JSON 解析失败：只接受对象或数组字面量')
  }
  return evaluated
}

/**
 * 容错解析后格式化为 2 空格缩进的标准 JSON 文本。
 *
 * @param text 待格式化的 JSON 文本。
 * @returns 格式化后的标准 JSON 文本。
 * @throws 解析失败时抛出异常。
 */
export const formatJson = (text: string): string => JSON.stringify(parseJsonLenient(text), null, 2)

/** 把数字补齐为 2 位字符串，供时间戳各字段使用。 */
const pad2 = (value: number) => String(value).padStart(2, '0')

/**
 * 生成 `YYYYMMDDHHmmss` 格式的本地时间紧凑时间戳，用于导出文件名。
 *
 * @param date 时间点，默认当前时间。
 * @returns 紧凑时间戳字符串。
 */
export const formatTimestamp = (date: Date = new Date()): string =>
  String(date.getFullYear()) +
  pad2(date.getMonth() + 1) +
  pad2(date.getDate()) +
  pad2(date.getHours()) +
  pad2(date.getMinutes()) +
  pad2(date.getSeconds())

/**
 * 生成导出文件名 `{name}_{YYYYMMDDHHmmss}.json`，name 自动去掉 .json 后缀。
 *
 * @param name 当前数据名（可带 .json 后缀），缺省或去后缀后为空时用 default。
 * @param date 导出时间点，默认当前时间。
 * @returns 导出文件名。
 */
export const buildExportFileName = (name?: string, date: Date = new Date()): string => {
  const base = (name ?? '').replace(/\.json$/i, '') || 'default'
  return `${base}_${formatTimestamp(date)}.json`
}
