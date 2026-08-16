import { Button, Dropdown, Tooltip } from '@heroui/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type React from 'react'

import type { PanelThemePreference } from '../theme/usePanelTheme'

/** 面板主题切换器的属性。 */
interface PanelThemeSelectProps {
  /** 当前偏好。 */
  value: PanelThemePreference
  /** 面板外壳明暗，用于浮层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给浮层。 */
  panelThemeStyle: React.CSSProperties
  /** 偏好变更回调。 */
  onChange: (value: PanelThemePreference) => void
}

/** 三种偏好的图标与文案，顺序即菜单顺序。 */
const options = [
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'system', label: '跟随系统', icon: Monitor }
] as const satisfies readonly { id: PanelThemePreference; label: string; icon: typeof Sun }[]

/**
 * 面板外壳的明暗切换器。
 *
 * 只改开发面板自身外观，不碰画布里的用户组件——模板主题在右侧抽屉里单独调。
 *
 * 尺寸写成和相邻 GitHub 按钮同一组类（size-9 + p-0 + 居中），
 * 而不是依赖 Button 的默认内边距：图标按钮默认高度比同行其他元素矮一截，
 * 放在标题栏里会显得没对齐。
 */
export const PanelThemeSelect = ({ value, panelTheme, panelThemeStyle, onChange }: PanelThemeSelectProps) => {
  const current = options.find((option) => option.id === value) ?? options[2]
  const CurrentIcon = current.icon

  return (
    <Dropdown>
      <Tooltip closeDelay={80} delay={200}>
        <Tooltip.Trigger>
          <Dropdown.Trigger>
            <Button
              aria-label={`面板主题：${current.label}`}
              className="size-9 min-h-0 shrink-0 items-center justify-center rounded-lg p-0"
              isIconOnly
              variant="ghost"
            >
              <CurrentIcon className="size-5" />
            </Button>
          </Dropdown.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p className="text-xs">面板主题：{current.label}</p>
        </Tooltip.Content>
      </Tooltip>

      <Dropdown.Popover className="min-w-36" placement="bottom end">
        {/* 浮层渲染在 portal 里，要自己带一层主题类名和变量，否则会继承文档根节点的主题。 */}
        <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
          <Dropdown.Menu
            aria-label="面板主题"
            disallowEmptySelection
            selectedKeys={new Set([value])}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const next = [...keys][0]
              if (next) {
                onChange(next as PanelThemePreference)
              }
            }}
          >
            {options.map((option) => (
              <Dropdown.Item className="text-xs" id={option.id} key={option.id} textValue={option.label}>
                <option.icon className="size-3.5" />
                {option.label}
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  )
}
