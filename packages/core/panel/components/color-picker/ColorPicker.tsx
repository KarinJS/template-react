import { Button, InputGroup, ListBox, Popover, Select, TextField } from '@heroui/react'
import { Shuffle } from 'lucide-react'
import { useState } from 'react'
import type React from 'react'
import { ColorPicker as AriaColorPicker, parseColor, type Color } from 'react-aria-components'

import { detectColorFormat, formatColor, safeParseColor, validateColorInput, type ColorFormat } from '../../theme/colorFormat'
import { ColorArea } from './ColorArea'
import { ColorSlider } from './ColorSlider'
import { ColorSwatchesCarousel } from './ColorSwatchesCarousel'

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

/** 色值格式选项，顺序与官方文档取色器一致。 */
const colorFormats: readonly { id: ColorFormat; label: string }[] = [
  { id: 'hex', label: 'HEX' },
  { id: 'hsl', label: 'HSL' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsb', label: 'HSB' },
  { id: 'oklch', label: 'OKLCH' }
]

/**
 * 强调色取色器弹层，版式与 HeroUI 官方文档取色器一致：
 * 分页预设色板 → 二维取色区 → 色相滑块 + 随机 → 色值输入框（带格式切换）。
 *
 * 弹层内部重新挂一层主题类名和变量：HeroUI 的浮层渲染在 portal 里，
 * 不套这一层就会继承 document 根节点的主题，深色面板里弹出一个亮色卡片。
 */
export const ColorPicker = ({ value, trigger, panelTheme, panelThemeStyle, onChange }: ColorPickerProps) => {
  const color = safeParseColor(value)

  const [currentColorFormat, setCurrentColorFormat] = useState<ColorFormat>('hex')
  /** 正在编辑的输入内容；null 表示未在编辑，展示格式化后的当前色。 */
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [inputError, setInputError] = useState(false)

  const displayedInputValue = editingValue ?? formatColor(color, currentColorFormat)

  /** 输入时逐键校验：能识别格式就自动切换 Select，合法色值即时生效。 */
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setEditingValue(next)

    const detected = detectColorFormat(next)
    const format = detected ?? currentColorFormat
    setCurrentColorFormat(format)

    const validated = validateColorInput(next, format)
    if (validated) {
      onChange(validated)
      setInputError(false)
    } else {
      setInputError(true)
    }
  }

  /** 失焦时丢弃未完成的编辑：非法输入静默回落到当前色，不打扰用户。 */
  const handleInputBlur = () => {
    setEditingValue(null)
    setInputError(false)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setEditingValue(null)
      setInputError(false)
      event.currentTarget.blur()
    }
  }

  const handleInputFocus = () => {
    setEditingValue(formatColor(color, currentColorFormat))
  }

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

        <Popover.Content className="w-62 rounded-[20px]" placement="left">
          <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
            <Popover.Dialog className="flex flex-col gap-2 px-2 pt-4 pb-2">
              <ColorSwatchesCarousel currentHex={color.toString('hex')} />

              <div className="aspect-square w-full">
                <ColorArea colorSpace="hsl" xChannel="saturation" yChannel="lightness" />
              </div>

              <div className="flex w-full items-center justify-between gap-2">
                <ColorSlider aria-label="色相" channel="hue" className="h-5 max-w-46 min-w-0 flex-1" colorSpace="hsl" />
                <Button
                  aria-label="随机颜色"
                  className="size-8 min-w-8 shrink-0 rounded-full"
                  isIconOnly
                  size="sm"
                  variant="tertiary"
                  onPress={handleShuffle}
                >
                  <Shuffle className="size-4" />
                </Button>
              </div>

              <TextField aria-label="色值" isInvalid={inputError}>
                <InputGroup fullWidth className="rounded-xl" variant="secondary">
                  <InputGroup.Input
                    className="w-full flex-1 px-4 text-sm"
                    value={displayedInputValue}
                    onBlur={handleInputBlur}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleInputKeyDown}
                  />
                  <InputGroup.Suffix className="border-s border-separator px-0">
                    <Select
                      aria-label="色值格式"
                      value={currentColorFormat}
                      onChange={(key) => {
                        if (key) setCurrentColorFormat(key as ColorFormat)
                      }}
                    >
                      <Select.Trigger className="h-full min-w-22 rounded-none border-none bg-transparent px-3">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        {/* 嵌套浮层同样是 portal，主题层也要重套一次。 */}
                        <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
                          <ListBox>
                            {colorFormats.map((format) => (
                              <ListBox.Item id={format.id} key={format.id} textValue={format.label}>
                                {format.label}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </div>
                      </Select.Popover>
                    </Select>
                  </InputGroup.Suffix>
                </InputGroup>
              </TextField>
            </Popover.Dialog>
          </div>
        </Popover.Content>
      </Popover>
    </AriaColorPicker>
  )
}
