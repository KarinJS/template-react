import { Description, InputGroup, Kbd, ListBox, Popover, Switch } from '@heroui/react'
import { ChevronsUpDown, PaintBucket } from 'lucide-react'
import type React from 'react'

import { formatOklch } from '../../theme/oklch'
import { themePresets, type ThemePreset } from '../../theme/presets'

/** 主题预设弹层的属性。 */
interface ThemePresetPopoverProps {
  /** 当前命中的预设；undefined 表示「自定义」。 */
  current: ThemePreset | undefined
  /** 鲜艳调色板开关。 */
  vibrant: boolean
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 选中预设回调。 */
  onApply: (preset: ThemePreset) => void
  /** 鲜艳调色板切换回调。 */
  onVibrantChange: (vibrant: boolean) => void
}

/**
 * 主题预设选择器，对齐 HeroUI 官方主题编辑器的 ThemePopover。
 *
 * 触发器沿用 InputGroup 假 select 模式；弹层是 4 列圆形色板
 * （用预设强调色的 oklch 值渲染圆点，不复制官方的 PNG 资源），
 * 下方依次是「鲜艳调色板」开关和「按 T 随机选择」的快捷键提示。
 */
export const ThemePresetPopover = ({
  current,
  vibrant,
  panelTheme,
  panelThemeStyle,
  onApply,
  onVibrantChange
}: ThemePresetPopoverProps) => (
  <Popover>
    <Popover.Trigger>
      <InputGroup className="w-full cursor-pointer" variant="secondary">
        <InputGroup.Prefix className="w-8">
          <PaintBucket aria-hidden="true" className="size-3.5 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input aria-label="主题" className="cursor-pointer truncate text-xs" readOnly value={current?.label ?? '自定义'} />
        <InputGroup.Suffix className="w-8">
          <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted" />
        </InputGroup.Suffix>
      </InputGroup>
    </Popover.Trigger>

    <Popover.Content className="w-64" placement="left">
      <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
        <Popover.Dialog className="p-3">
          <ListBox
            aria-label="主题"
            className="grid grid-cols-4 gap-2 px-0"
            layout="grid"
            selectedKeys={current ? new Set([current.id]) : new Set()}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const selectedId = [...keys][0]
              const selected = themePresets.find((preset) => preset.id === selectedId)
              if (selected) {
                onApply(selected)
              }
            }}
          >
            {themePresets.map((preset) => (
              <ListBox.Item
                className="group flex flex-col items-center justify-center gap-1 bg-transparent p-1 data-[hovered=true]:bg-transparent"
                id={preset.id}
                key={preset.id}
                textValue={preset.label}
              >
                <span
                  aria-hidden="true"
                  className="size-8 rounded-full bg-surface ring-offset-2 ring-offset-surface group-data-[selected=true]:ring-2 group-data-[selected=true]:ring-accent"
                  style={{ background: formatOklch({ l: preset.lightness, c: preset.chroma, h: preset.hue }) }}
                />
                <span className="text-[10px] font-medium text-muted group-data-[selected=true]:text-foreground">{preset.label}</span>
              </ListBox.Item>
            ))}
          </ListBox>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-separator pt-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xs font-medium text-foreground">鲜艳调色板</p>
              <Description className="text-[10px] text-muted">更饱和，对比更低</Description>
            </div>
            {/* Content 包裹 Control 是硬要求：Content 才是可点击的 label，缺了它点 pill 不触发切换。 */}
            <Switch aria-label="鲜艳调色板" isSelected={vibrant} onChange={onVibrantChange}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>

          <p className="mt-3 flex items-center gap-1 text-xs text-muted">
            按
            <Kbd>
              <Kbd.Content>T</Kbd.Content>
            </Kbd>
            随机选择
          </p>
        </Popover.Dialog>
      </div>
    </Popover.Content>
  </Popover>
)
