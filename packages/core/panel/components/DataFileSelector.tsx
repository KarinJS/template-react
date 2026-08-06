import { Button, Card, Chip, Label, ListBox, Select } from '@heroui/react'
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type React from 'react'

import type { DataEntry } from '../types'

/** 数据文件选择卡片的属性。 */
interface DataFileSelectorProps {
  /** 当前模板可用的全部 mock 数据条目。 */
  entries: DataEntry[]
  /** 当前选中的数据文件名。 */
  value?: string
  /** 当前数据是否只读（TS mock 不可在面板内写回）。 */
  readonly?: boolean
  /** 面板外壳主题，用于下拉浮层换肤。 */
  panelTheme?: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传到下拉浮层。 */
  panelThemeStyle?: React.CSSProperties
  /** 切换数据文件回调。 */
  onChange: (value: string) => void
  /** 新建 JSON 数据文件回调。 */
  onCreate: () => void
  /** 删除当前 JSON 数据文件回调。 */
  onDelete: () => void
  /** 打开 mock 数据编辑弹窗回调。 */
  onEdit: () => void
  /** 重新扫描数据文件列表回调。 */
  onRefresh: () => void
}

/** 展示时去掉 .json 后缀，让数据名更短。 */
const formatName = (name: string) => name.replace(/\.json$/, '')

/** 数据文件卡片：切换、新建、编辑、删除当前模板的 mock 数据。 */
export const DataFileSelector = ({
  entries,
  value,
  readonly,
  panelTheme = 'light',
  panelThemeStyle,
  onChange,
  onCreate,
  onDelete,
  onEdit,
  onRefresh
}: DataFileSelectorProps) => (
  <Card className="w-full border border-border shadow-none" variant="default">
    <Card.Header className="flex-col items-start gap-3 px-4 pb-3 pt-4">
      <div className="flex w-full items-start justify-between gap-3">
        <div>
          <Card.Title className="text-sm font-semibold text-foreground">数据文件</Card.Title>
          <Card.Description className="mt-1 text-xs text-muted">切换并编辑当前模板使用的 mock 数据</Card.Description>
        </div>
        <Chip className="shrink-0 tracking-[0.16em] uppercase" size="md" variant="soft">
          加载了 {entries.length} 个数据文件
        </Chip>
      </div>
    </Card.Header>

    <Card.Content className="space-y-3 px-4 pb-4">
      <Select
        className="w-full"
        isDisabled={entries.length === 0}
        placeholder="选择预设数据"
        value={value && entries.some((entry) => entry.name === value) ? value : null}
        variant="secondary"
        onChange={(nextValue) => {
          if (typeof nextValue === 'string' && nextValue) {
            onChange(nextValue)
          }
        }}
      >
        <Label className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">选择数据文件</Label>
        <Select.Trigger className="px-3 py-2.5">
          <Select.Value className="text-sm font-medium text-foreground" />
          <Select.Indicator className="text-muted" />
        </Select.Trigger>
        <Select.Popover className="p-0">
          <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
            <ListBox className="p-1">
              {entries.map((entry) => {
                const label = `${entry.source === 'ts' ? 'TS' : 'JSON'} / ${formatName(entry.name)}`

                return (
                  <ListBox.Item key={`${entry.source}:${entry.name}`} className="px-3 py-2 text-sm" id={entry.name} textValue={label}>
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{label}</span>
                      {entry.readonly && (
                        <Chip className="shrink-0" size="sm" variant="soft">
                          只读
                        </Chip>
                      )}
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )
              })}
            </ListBox>
          </div>
        </Select.Popover>
      </Select>

      {readonly && <p className="text-xs text-muted">当前数据来自 TypeScript mock，面板内只读，请编辑源文件。</p>}
    </Card.Content>

    <Card.Footer className="flex flex-col gap-2 px-4 pb-4 pt-0">
      <div className="grid w-full grid-cols-2 gap-2">
        <Button onPress={onRefresh} size="md" variant="secondary">
          <RefreshCw size={14} />
          刷新
        </Button>
        <Button onPress={onCreate} size="md" variant="secondary">
          <Plus size={14} />
          新建
        </Button>
      </div>
      <Button className="w-full justify-center" isDisabled={Boolean(!value)} onPress={onEdit} size="md" variant="primary">
        <Edit size={14} />
        编辑数据
      </Button>
      <Button className="w-full justify-center" isDisabled={Boolean(!value || readonly)} onPress={onDelete} size="md" variant="danger">
        <Trash2 size={14} />
        删除 JSON 数据
      </Button>
    </Card.Footer>
  </Card>
)
