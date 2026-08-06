import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

// 直接引用源码模块，避免运行时出口的调整影响本测试。
import { capturedDataFileName, saveCapturedData } from '../../src/runtime/capture'

describe('capture data', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes captured.json with the rendered data on first capture', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-capture-'))

    expect(saveCapturedData(dir, 'hello/card', { message: '你好' })).toBe(true)

    const filePath = path.join(dir, 'hello', 'card', 'data', capturedDataFileName)
    expect(fs.existsSync(filePath)).toBe(true)
    // 文件内容应为 2 空格缩进的 JSON。
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(JSON.stringify({ message: '你好' }, null, 2))
  })

  it('overwrites captured.json on subsequent captures without extra files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-capture-'))

    expect(saveCapturedData(dir, 'hello/card', { index: 1 })).toBe(true)
    expect(saveCapturedData(dir, 'hello/card', { index: 2 })).toBe(true)

    const templateDir = path.join(dir, 'hello', 'card', 'data')
    // 滚动覆盖后目录里只保留 captured.json 一个文件。
    expect(fs.readdirSync(templateDir)).toEqual([capturedDataFileName])
    expect(JSON.parse(fs.readFileSync(path.join(templateDir, capturedDataFileName), 'utf-8'))).toEqual({ index: 2 })
  })

  it('returns false instead of throwing when the capture directory is not writable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-capture-'))
    // 静默失败路径的告警输出，保持测试日志干净。
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // 用同名普通文件挡住模板目录的创建，模拟目录不可写的失败场景。
    fs.writeFileSync(path.join(dir, 'hello'), 'not a directory', 'utf-8')

    expect(() => saveCapturedData(dir, 'hello/card', { index: 1 })).not.toThrow()
    expect(saveCapturedData(dir, 'hello/card', { index: 1 })).toBe(false)
  })
})
