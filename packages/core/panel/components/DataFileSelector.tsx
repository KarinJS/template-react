import { Button, Chip, Label, ListBox, Select, Tooltip } from '@heroui/react'
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type React from 'react'

import type { DataEntry } from '../types'
import { sidebarSectionLabelClass } from './PlatformSelector'

/** 数据文件选择分区的属性。 */
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

/** 数据分区：切换、新建、编辑、删除当前模板的 mock 数据；刷新/新建收成区头右侧的 ghost 图标按钮。 */
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
  <div className="flex flex-col">
    <div className="flex items-center justify-between px-1">
      <div className="flex items-baseline gap-2">
        <Label className={sidebarSectionLabelClass}>数据</Label>
        <span className="text-[10px] text-muted tabular-nums">{entries.length} 个文件</span>
      </div>

      <div className="flex items-center gap-0.5">
        <Tooltip closeDelay={80} delay={300}>
          <Tooltip.Trigger>
            <Button isIconOnly aria-label="刷新数据文件列表" size="sm" variant="ghost" onPress={onRefresh}>
              <RefreshCw size={13} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="text-xs">刷新数据文件列表</p>
          </Tooltip.Content>
        </Tooltip>
        <Tooltip closeDelay={80} delay={300}>
          <Tooltip.Trigger>
            <Button isIconOnly aria-label="新建数据文件" size="sm" variant="ghost" onPress={onCreate}>
              <Plus size={13} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="text-xs">新建数据文件</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>

    <Select
      className="mt-2.5 w-full"
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

    {readonly && <p className="mt-2 px-1 text-xs text-muted">当前数据来自 TypeScript mock，面板内只读，请编辑源文件。</p>}

    <div className="mt-3 flex items-center gap-2">
      <Button className="flex-1 justify-center" isDisabled={Boolean(!value)} onPress={onEdit} size="sm" variant="secondary">
        <Edit size={13} />
        编辑数据
      </Button>
      <Tooltip closeDelay={80} delay={300}>
        <Tooltip.Trigger>
          <Button
            isIconOnly
            aria-label="删除当前 JSON 数据"
            className="text-danger hover:bg-danger-soft"
            isDisabled={Boolean(!value || readonly)}
            size="sm"
            variant="ghost"
            onPress={onDelete}
          >
            <Trash2 size={13} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">删除当前 JSON 数据</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  </div>
)
