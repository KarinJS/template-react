import { Button } from '@heroui/react'
import { useMemo } from 'react'
import type { Color } from 'react-aria-components'

import { ariaColorToOklch, getHueFromColor, safeParseColor } from '../../theme/colorFormat'
import { formatOklch, type OklchColor } from '../../theme/oklch'
import { ColorPicker } from '../color-picker/ColorPicker'
import { ColorSlider } from '../color-picker/ColorSlider'

/** 强调色控件的属性。 */
interface AccentControlProps {
  /** 当前强调色的三个通道。 */
  accent: OklchColor
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 三通道变更回调，字段名与旋钮一致。 */
  onChange: (patch: { hue?: number; chroma?: number; lightness?: number }) => void
}

/** 色相轨道的取样点。步长 24° 与官方主题构建器一致，末尾回到起点保证首尾衔接。 */
const hueStops = [24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336, 360, 24]

/**
 * 强调色控件：色相滑块负责快速试色，取色器弹层负责预设、取色区、随机和色值输入。
 *
 * 版式对齐 HeroUI 官方主题构建器的 `AccentColorSelector`：
 * 滑块只改色相，明度彩度保持不变，因此轨道渐变按当前明度彩度取样；
 * 滑块本身固定显示当前强调色（不随拖动重新染色），触发按钮是恒定的柔和渐变圆点。
 */
export const AccentControl = ({ accent, onChange, panelTheme, panelThemeStyle }: AccentControlProps) => {
  const accentCss = formatOklch(accent)
  const ariaColor = safeParseColor(accentCss)

  // 渐变用当前明度彩度取样：滑块只调色相，轨道就该如实反映「只有色相在变」。
  const trackBackground = useMemo(
    () => `linear-gradient(to right, ${hueStops.map((hue) => formatOklch({ ...accent, h: hue })).join(', ')})`,
    [accent]
  )

  return (
    <div className="flex flex-row items-center gap-2 overflow-visible">
      <ColorSlider
        aria-label="强调色色相"
        channel="hue"
        className="h-6 min-w-0 flex-1"
        colorSpace="hsl"
        // 固定成当前强调色：官方实现同样传 thumbBackground，滑块只表达「色相在哪」。
        thumbBackground={accentCss}
        trackBackground={trackBackground}
        value={ariaColor}
        onChange={(color: Color) => onChange({ hue: getHueFromColor(color) })}
      />

      <ColorPicker
        panelTheme={panelTheme}
        panelThemeStyle={panelThemeStyle}
        trigger={
          <Button
            aria-label="打开取色器精调强调色"
            className="group relative flex size-6 shrink-0 items-center overflow-visible rounded-full p-0"
            isIconOnly
            variant="ghost"
          >
            {/* 柔和渐变圆点表示「自定义取色」，不显示当前色：右侧已有当前色预览。 */}
            <div
              className="z-0 size-full rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, #F8AECF, #FBC7A3, #F7E8A4, #D7F5B0, #B5F3D2, #A3EAF7, #A8C9FF, #C9B8FF, #F8AECF)'
              }}
            />
            <div className="absolute inset-0 z-10 rounded-full border-2 border-white/50" />
          </Button>
        }
        value={accentCss}
        onChange={(color: Color) => {
          const { c, h, l } = ariaColorToOklch(color)
          onChange({ hue: h, chroma: c, lightness: l })
        }}
      />

      {/* 当前色预览：纯展示，用 span 避免混进 Tab 序列。 */}
      <span aria-hidden="true" className="size-6 shrink-0 rounded-full border border-border" style={{ background: accentCss }} />
    </div>
  )
}
