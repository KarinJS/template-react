import { Slider } from '@heroui/react'

import { baseMax } from '../../theme/palette'

/** 基础色滑块的属性。 */
interface ChromaSliderProps {
  /** 当前色相，用于轨道渐变取样。 */
  hue: number
  /** 当前彩度值。 */
  value: number
  /** 变更回调。 */
  onChange: (value: number) => void
}

/**
 * 中性色染色滑块：从纯灰滑到略带主色色相的灰。
 *
 * 用 HeroUI 的 Slider 承载，不自己写 pointer 事件——
 * 官方文档里这块是手写 pointerdown/move 的，但那样要自己处理捕获、
 * 键盘、RTL 和无障碍属性，而这些 Slider 已经做好了。
 *
 * 轨道渐变按当前色相取样，右端就是这个色相下的最大染色量，
 * 所以拖动时能直接看出「往右会脏到什么程度」。
 */
export const ChromaSlider = ({ hue, value, onChange }: ChromaSliderProps) => (
  <Slider
    aria-label="中性色染色量"
    className="w-full"
    maxValue={baseMax}
    minValue={0}
    step={0.0001}
    value={value}
    onChange={(next) => onChange(typeof next === 'number' ? next : (next[0] ?? 0))}
  >
    <Slider.Track
      className="h-6 rounded-full border border-border"
      style={{
        background: `linear-gradient(to right, oklch(70% 0 ${hue}), oklch(70% ${baseMax} ${hue}))`
      }}
    >
      <Slider.Thumb
        className="size-4 border-[1.5px] border-white shadow-lg"
        style={{ background: `oklch(70% ${value} ${hue})` }}
      />
    </Slider.Track>
  </Slider>
)
