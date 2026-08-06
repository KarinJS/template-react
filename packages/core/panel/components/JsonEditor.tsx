import { Button } from '@heroui/react'
import Editor from '@monaco-editor/react'
import { Braces, Copy, Download, Upload } from 'lucide-react'
import { useState } from 'react'

import { buildExportFileName, formatJson } from '../utils/parseJson'

/** 面板内 JSON 数据编辑器属性。 */
interface JsonEditorProps {
  /** 当前 JSON 文本。 */
  value: string
  /** TS mock 等只读数据源不允许直接保存。 */
  readonly?: boolean
  /** 跟随面板主题切换 Monaco 明暗模式。 */
  dark?: boolean
  /** 当前数据名，导出文件时用于生成文件名（可带 .json 后缀）。 */
  name?: string | undefined
  /** JSON 文本变化回调。 */
  onChange: (value: string) => void
}

/** 轻量包裹 Monaco，只负责 JSON 编辑，不关心 mock API 写入细节；顶部工具条提供格式化、复制、导入、导出。 */
export const JsonEditor = ({ value, readonly, dark, name, onChange }: JsonEditorProps) => {
  // 工具条操作的一次性反馈文案（成功或失败原因），展示在工具条右侧。
  const [status, setStatus] = useState<string>()

  /** 格式化：容错解析当前文本后以 2 空格缩进重写，失败时只在工具条提示，不动草稿。 */
  const handleFormat = () => {
    try {
      onChange(formatJson(value))
      setStatus('已格式化')
    } catch {
      setStatus('格式化失败：JSON 语法错误')
    }
  }

  /** 复制当前 JSON 文本到系统剪贴板。 */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('已复制到剪贴板')
    } catch {
      setStatus('复制失败：浏览器拒绝了剪贴板访问')
    }
  }

  /** 导入本地 .json 文件，读取内容后整体替换当前草稿。 */
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string') {
          onChange(reader.result)
          setStatus(`已导入 ${file.name}`)
        }
      })
      reader.addEventListener('error', () => setStatus(`导入失败：无法读取 ${file.name}`))
      reader.readAsText(file)
    })
    input.click()
  }

  /** 导出当前 JSON 文本，按 `{name}_{时间戳}.json` 命名触发浏览器下载。 */
  const handleExport = () => {
    const blob = new Blob([value], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = buildExportFileName(name)
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus('已导出 JSON 文件')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      {/* 工具条：格式化/导入会改写草稿，只读时禁用；复制/导出只读当前文本，始终可用。 */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        <Button aria-label="格式化 JSON" isDisabled={Boolean(readonly)} onPress={handleFormat} size="sm" variant="ghost">
          <Braces size={14} />
          格式化
        </Button>
        <Button aria-label="复制 JSON 到剪贴板" onPress={() => void handleCopy()} size="sm" variant="ghost">
          <Copy size={14} />
          复制
        </Button>
        <Button aria-label="导入本地 JSON 文件" isDisabled={Boolean(readonly)} onPress={handleImport} size="sm" variant="ghost">
          <Upload size={14} />
          导入
        </Button>
        <Button aria-label="导出 JSON 文件" onPress={handleExport} size="sm" variant="ghost">
          <Download size={14} />
          导出
        </Button>
        {status && (
          <span className="ml-auto truncate pl-2 text-xs text-muted" role="status">
            {status}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language="json"
          options={{
            readOnly: Boolean(readonly),
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            ariaLabel: 'JSON 编辑器',
            // 弹窗尺寸或主题变化时让 Monaco 跟随容器重排，避免高度塌缩成一条缝。
            automaticLayout: true
          }}
          theme={dark ? 'vs-dark' : 'vs-light'}
          value={value}
          onChange={(next) => onChange(next ?? '')}
        />
      </div>
    </div>
  )
}
