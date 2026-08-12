import { Button, Popover } from '@heroui/react'
import { Shuffle } from 'lucide-react'
import type React from 'react'
import { ColorPicker as AriaColorPicker, parseColor, type Color } from 'react-aria-components'

import { safeParseColor } from '../../theme/colorFormat'
import { ColorArea } from './ColorArea'
import { ColorSlider } from './ColorSlider'

/** 取色器的属性。 */
interface ColorPickerProps {
  /** 当前色值（CSS 字符串）。 */
  value: string
  /** 触发器元素。 */
  trigger: React.ReactNode
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 色值变更回调。 */
  onChange: (color: Color) => void
}

/**
 * 预设色板。
 *
 * 覆盖常用色相且明度接近，随手点一个就能得到能用的强调色；
 * 需要精调再用下面的取色区。
 */
const swatches = [
  'hsl(253, 100%, 62%)',
  'hsl(212, 100%, 47%)',
  'hsl(199, 89%, 48%)',
  'hsl(172, 66%, 45%)',
  'hsl(142, 71%, 45%)',
  'hsl(84, 81%, 44%)',
  'hsl(45, 93%, 47%)',
  'hsl(25, 95%, 53%)',
  'hsl(0, 84%, 60%)',
  'hsl(330, 81%, 60%)',
  'hsl(292, 84%, 61%)',
  'hsl(258, 90%, 66%)'
]

/**
 * 强调色取色器弹层：预设色板 + 二维取色区 + 色相滑块 + 随机。
 *
 * 弹层内部重新挂一层主题类名和变量：HeroUI 的浮层渲染在 portal 里，
 * 不套这一层就会继承 document 根节点的主题，深色面板里弹出一个亮色卡片。
 */
export const ColorPicker = ({ value, trigger, panelTheme, panelThemeStyle, onChange }: ColorPickerProps) => {
  const color = safeParseColor(value)

  /** 随机一个饱和度和明度都在可用区间的颜色。 */
  const handleShuffle = () => {
    const hue = Math.floor(Math.random() * 360)
    const saturation = 50 + Math.floor(Math.random() * 50)
    const lightness = 40 + Math.floor(Math.random() * 30)

    onChange(parseColor(`hsl(${hue}, ${saturation}%, ${lightness}%)`))
  }

  return (
    <AriaColorPicker value={color} onChange={onChange}>
      <Popover>
        <Popover.Trigger>{trigger}</Popover.Trigger>

        <Popover.Content className="w-64" placement="left">
          <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
            <Popover.Dialog className="flex flex-col gap-3 p-3">
              <div className="grid grid-cols-6 gap-1.5">
                {swatches.map((swatch) => (
                  <button
                    aria-label={`使用预设色 ${swatch}`}
                    className="size-7 rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    key={swatch}
                    onClick={() => onChange(parseColor(swatch))}
                    style={{ background: swatch }}
                    type="button"
                  />
                ))}
              </div>

              <div className="h-40">
                <ColorArea colorSpace="hsl" xChannel="saturation" yChannel="lightness" />
              </div>

              <div className="flex items-center gap-2">
                <ColorSlider aria-label="色相" channel="hue" className="h-5 min-w-0 flex-1" colorSpace="hsl" />
                <Button aria-label="随机颜色" isIconOnly onPress={handleShuffle} size="sm" variant="ghost">
                  <Shuffle className="size-3.5" />
                </Button>
              </div>
            </Popover.Dialog>
          </div>
        </Popover.Content>
      </Popover>
    </AriaColorPicker>
  )
}
