import { InputGroup, ListBox, Popover, Tooltip } from '@heroui/react'
import { ChevronsUpDown, Lock, LockOpen, Squircle } from 'lucide-react'
import type React from 'react'

import { formRadiusOptions, radiusOptions, type KnobOption, type LockableKnob } from '../../theme/knobs'

/** 合并圆角弹层的属性。 */
interface RadiusPopoverProps {
  /** 当前全局圆角基准值。 */
  radiusValue: string
  /** 当前表单圆角值。 */
  formRadiusValue: string
  /** 已锁定的旋钮（两栏各自有锁，收在栏标题行）。 */
  lockedKnobs: readonly LockableKnob[]
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 选中全局圆角回调。 */
  onRadiusChange: (value: string) => void
  /** 选中表单圆角回调。 */
  onFormRadiusChange: (value: string) => void
  /** 切换锁定回调。 */
  onToggleLock: (knob: LockableKnob) => void
}

/** 单栏圆角（全局 / 表单）：标题行（名称 + 说明 + 锁）+ 3 列档位网格。 */
const RadiusSection = ({
  title,
  description,
  knob,
  options,
  value,
  lockedKnobs,
  onChange,
  onToggleLock
}: {
  title: string
  description: string
  knob: LockableKnob
  options: readonly KnobOption[]
  value: string
  lockedKnobs: readonly LockableKnob[]
  onChange: (value: string) => void
  onToggleLock: (knob: LockableKnob) => void
}) => {
  const isLocked = lockedKnobs.includes(knob)
  const current = options.find((option) => option.value === value)

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <div className="group flex h-6 items-center gap-1">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <Tooltip closeDelay={80} delay={150}>
          <Tooltip.Trigger>
            <button
              aria-label={isLocked ? `解锁${title}数值` : `锁定${title}数值`}
              aria-pressed={isLocked}
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:bg-default focus-visible:text-foreground ${
                isLocked ? 'text-foreground' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
              onClick={() => onToggleLock(knob)}
              type="button"
            >
              {isLocked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="text-xs">{isLocked ? '解锁数值' : '锁定数值'}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
      <p className="text-[10px] leading-relaxed text-muted">{description}</p>

      <ListBox
        aria-label={title}
        className="grid grid-cols-3 gap-2 p-0"
        disallowEmptySelection
        layout="grid"
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
        {options.map((option) => (
          <ListBox.Item
            className="group flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border data-[hovered=true]:bg-default data-[selected=true]:border-foreground"
            id={option.id}
            key={option.id}
            textValue={option.label}
          >
            <span className="text-sm font-semibold text-foreground">{option.abbr}</span>
            <span className="text-[10px] text-muted group-data-[selected=true]:text-foreground">{option.label}</span>
          </ListBox.Item>
        ))}
      </ListBox>
    </section>
  )
}

/**
 * 合并的圆角选择器：一个「圆角」字段，弹层内左栏全局圆角、右栏表单圆角，
 * 与字体弹窗同一套双栏模式（无分割线、各栏独立锁定）。
 */
export const RadiusPopover = ({
  radiusValue,
  formRadiusValue,
  lockedKnobs,
  panelTheme,
  panelThemeStyle,
  onRadiusChange,
  onFormRadiusChange,
  onToggleLock
}: RadiusPopoverProps) => {
  const current = radiusOptions.find((option) => option.value === radiusValue)

  return (
    <Popover>
      <Popover.Trigger>
        <InputGroup className="w-full cursor-pointer" variant="secondary">
          <InputGroup.Prefix className="w-8">
            <Squircle aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input aria-label="圆角" className="cursor-pointer truncate text-xs" readOnly value={current?.label ?? '中'} />
          <InputGroup.Suffix className="w-8">
            <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Suffix>
        </InputGroup>
      </Popover.Trigger>

      <Popover.Content className="w-[26rem]" placement="left">
        <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
          <Popover.Dialog className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <RadiusSection
                description="影响整体 UI，例如菜单与弹窗"
                knob="radius"
                lockedKnobs={lockedKnobs}
                options={radiusOptions}
                title="圆角"
                value={radiusValue}
                onChange={onRadiusChange}
                onToggleLock={onToggleLock}
              />
              <RadiusSection
                description="影响表单元素，例如输入框与选择器"
                knob="formRadius"
                lockedKnobs={lockedKnobs}
                options={formRadiusOptions}
                title="表单圆角"
                value={formRadiusValue}
                onChange={onFormRadiusChange}
                onToggleLock={onToggleLock}
              />
            </div>
          </Popover.Dialog>
        </div>
      </Popover.Content>
    </Popover>
  )
}
