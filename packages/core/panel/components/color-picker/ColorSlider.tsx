import {
  ColorSlider as AriaColorSlider,
  ColorThumb,
  SliderTrack,
  type ColorSliderProps as AriaColorSliderProps
} from 'react-aria-components'

/** 颜色滑块的属性。 */
interface ColorSliderProps extends Omit<AriaColorSliderProps, 'children'> {
  /** 轨道背景，通常是一段渐变；不传就用 react-aria 按通道算出的默认渐变。 */
  trackBackground?: string
  /** 手柄背景。传固定值可以让手柄在拖动过程中不改色。 */
  thumbBackground?: string
}

/**
 * 单通道颜色滑块。
 *
 * 轨道和手柄的背景都可以外部指定：强调色控件传入固定的当前色，
 * 这样拖动时手柄不会跟着色相变来变去（与 HeroUI 官方主题构建器一致）。
 *
 * 注意这里没有包裹额外的 flex 容器：包一层再给间距，
 * 会让轨道两侧多出两块「渐变露出来的边」，看着像凭空多了两个色块。
 */
export const ColorSlider = ({
  className,
  orientation = 'horizontal',
  thumbBackground,
  trackBackground,
  ...props
}: ColorSliderProps) => (
  // className 用 ?? '' 兜底：仓库开了 exactOptionalPropertyTypes，
  // 直接透传可能为 undefined 的值会被判定为不满足必填的 ClassNameOrFunction。
  <AriaColorSlider className={className ?? ''} orientation={orientation} {...props}>
    <SliderTrack
      className={orientation === 'horizontal' ? 'h-full w-full rounded-full' : 'ms-2 h-full w-full rounded-full'}
      style={({ defaultStyle }) => ({ background: trackBackground ?? defaultStyle.background })}
    >
      <ColorThumb
        className={`size-4 cursor-grab rounded-full border-[1.5px] border-white shadow-lg data-[dragging=true]:cursor-grabbing data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-2 data-[focus-visible=true]:outline-focus ${
          orientation === 'horizontal' ? 'top-1/2' : 'start-1/2'
        }`}
        style={({ color }) => ({ background: thumbBackground ?? color.toString('css') })}
      />
    </SliderTrack>
  </AriaColorSlider>
)
