import { InputGroup, ListBox, Popover } from '@heroui/react'
import { ChevronsUpDown } from 'lucide-react'
import type React from 'react'

/** 一个可选项。 */
export interface PopoverOption {
  /** 稳定标识，同时作为 ListBox 的 key。 */
  id: string
  /** 选项名称。 */
  label: string
  /** 写入旋钮的实际值。 */
  value: string
  /** 网格卡片上的大号缩写，仅圆角这类需要图形化预览的选项使用。 */
  abbr?: string
}

/** 选项弹层的属性。 */
interface OptionPopoverProps {
  /** 触发器上显示的当前值文字。 */
  label: string
  /** 弹层标题。 */
  title: string
  /** 弹层里的补充说明。 */
  description?: string
  /** 全部可选项。 */
  options: readonly PopoverOption[]
  /** 当前选中的值。 */
  value: string
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 以网格展示（带缩写预览），否则用列表。 */
  grid?: boolean
  /** 选中回调。 */
  onChange: (value: string) => void
}

/**
 * 收进弹层的离散选项选择器。
 *
 * 触发器长成输入框的样子（前缀 + 只读值 + 展开图标），视觉上像 select 但由 Popover 承载——
 * 比一排按钮省空间，窄侧边栏里也不会被挤成一条缝。
 */
export const OptionPopover = ({
  label,
  title,
  description,
  options,
  value,
  panelTheme,
  panelThemeStyle,
  grid = false,
  onChange
}: OptionPopoverProps) => {
  const current = options.find((option) => option.value === value)

  return (
    <Popover>
      <Popover.Trigger>
        <InputGroup className="w-full cursor-pointer" variant="secondary">
          {current?.abbr && (
            <InputGroup.Prefix className="w-8">
              <span className="text-sm font-semibold text-muted">{current.abbr}</span>
            </InputGroup.Prefix>
          )}
          <InputGroup.Input aria-label={title} className="cursor-pointer truncate text-xs" readOnly value={current?.label ?? label} />
          <InputGroup.Suffix className="w-8">
            <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Suffix>
        </InputGroup>
      </Popover.Trigger>

      <Popover.Content className="w-72" placement="left">
        <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
          <Popover.Dialog className="p-3">
            <div className="mb-2 flex flex-col gap-0.5">
              <p className="text-xs font-medium text-foreground">{title}</p>
              {description && <p className="text-xs leading-relaxed text-muted">{description}</p>}
            </div>

            <ListBox
              aria-label={title}
              className={grid ? 'grid grid-cols-3 gap-2 px-0' : 'p-0'}
              disallowEmptySelection
              layout={grid ? 'grid' : 'stack'}
              selectedKeys={new Set(current ? [current.id] : [])}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const selectedId = [...keys][0]
                const selected = options.find((option) => option.id === selectedId)
                if (selected) {
                  onChange(selected.value)
                }
              }}
            >
              {options.map((option) =>
                grid ? (
                  <ListBox.Item
                    key={option.id}
                    className="group flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-border data-[selected=true]:border-foreground"
                    id={option.id}
                    textValue={option.label}
                  >
                    <span className="text-lg font-semibold text-foreground">{option.abbr}</span>
                    <span className="text-xs text-muted group-data-[selected=true]:text-foreground">{option.label}</span>
                  </ListBox.Item>
                ) : (
                  <ListBox.Item key={option.id} className="px-3 py-2 text-xs" id={option.id} textValue={option.label}>
                    {option.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )
              )}
            </ListBox>
          </Popover.Dialog>
        </div>
      </Popover.Content>
    </Popover>
  )
}
