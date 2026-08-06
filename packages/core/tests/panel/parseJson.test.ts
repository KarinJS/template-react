import { describe, expect, it } from 'vitest'

import { buildExportFileName, formatJson, formatTimestamp, parseJsonLenient } from '../../panel/utils/parseJson'

describe('parseJsonLenient', () => {
  it('解析标准 JSON 对象', () => {
    expect(parseJsonLenient('{"a": 1, "b": [1, 2]}')).toEqual({ a: 1, b: [1, 2] })
  })

  it('解析标准 JSON 数组', () => {
    expect(parseJsonLenient('[1, "two", {"three": 3}]')).toEqual([1, 'two', { three: 3 }])
  })

  it('容忍单引号字符串', () => {
    expect(parseJsonLenient("{'a': 'hello'}")).toEqual({ a: 'hello' })
  })

  it('容忍无引号 key', () => {
    expect(parseJsonLenient('{a: 1, b: 2}')).toEqual({ a: 1, b: 2 })
  })

  it('容忍尾逗号', () => {
    expect(parseJsonLenient('{"a": 1,}')).toEqual({ a: 1 })
    expect(parseJsonLenient('[1, 2,]')).toEqual([1, 2])
  })

  it('容忍三种写法混合的草稿', () => {
    const text = `{
      name: 'karin',
      list: [1, 2,],
    }`
    expect(parseJsonLenient(text)).toEqual({ name: 'karin', list: [1, 2] })
  })

  it('拒绝完全无法解析的文本', () => {
    expect(() => parseJsonLenient('{a: }')).toThrow('JSON 解析失败')
    expect(() => parseJsonLenient('')).toThrow('JSON 解析失败')
  })

  it('兜底分支拒绝非对象/数组字面量结果', () => {
    // JSON.parse 失败但 new Function 能求值出标量时，仍应拒绝。
    expect(() => parseJsonLenient('123n')).toThrow('只接受对象或数组字面量')
    expect(() => parseJsonLenient('undefined')).toThrow('只接受对象或数组字面量')
  })

  it('兜底分支拒绝函数调用等表达式副作用', () => {
    expect(() => parseJsonLenient('(() => 1)()')).toThrow('只接受对象或数组字面量')
    expect(() => parseJsonLenient('new Date()')).toThrow('只接受对象或数组字面量')
  })
})

describe('formatJson', () => {
  it('格式化为 2 空格缩进的标准 JSON', () => {
    expect(formatJson('{a:1}')).toBe('{\n  "a": 1\n}')
  })

  it('解析失败时抛出异常', () => {
    expect(() => formatJson('{a: }')).toThrow('JSON 解析失败')
  })
})

describe('formatTimestamp', () => {
  it('生成 YYYYMMDDHHmmss 格式的本地时间戳', () => {
    const date = new Date(2026, 0, 5, 9, 7, 3)
    expect(formatTimestamp(date)).toBe('20260105090703')
  })
})

describe('buildExportFileName', () => {
  const date = new Date(2026, 7, 6, 15, 30, 8)

  it('去掉 .json 后缀并拼接时间戳', () => {
    expect(buildExportFileName('default.json', date)).toBe('default_20260806153008.json')
  })

  it('name 不带后缀时直接使用', () => {
    expect(buildExportFileName('captured', date)).toBe('captured_20260806153008.json')
  })

  it('name 缺省或去后缀后为空时回退为 default', () => {
    expect(buildExportFileName(undefined, date)).toBe('default_20260806153008.json')
    expect(buildExportFileName('.json', date)).toBe('default_20260806153008.json')
  })
})
