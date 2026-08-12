import { ColorArea as AriaColorArea, ColorThumb, type ColorSpace } from 'react-aria-components'

/** 取色区的属性。 */
interface ColorAreaProps {
  /** 额外类名。 */
  className?: string
  /** 色彩空间。 */
  colorSpace?: ColorSpace
  /** 横轴通道。 */
  xChannel?: 'saturation' | 'lightness' | 'brightness' | 'hue'
  /** 纵轴通道。 */
  yChannel?: 'saturation' | 'lightness' | 'brightness' | 'hue'
}

/**
 * 二维取色区：横轴饱和度、纵轴明度，指针与键盘交互交给 react-aria。
 *
 * 手柄背景实时跟随当前色——这里的取舍跟色相滑块相反：
 * 取色区表达「你选中了哪个点」，手柄就该显示那个点的颜色。
 */
export const ColorArea = ({
  className,
  colorSpace = 'hsl',
  xChannel = 'saturation',
  yChannel = 'lightness'
}: ColorAreaProps) => (
  <AriaColorArea
    className={`size-full shrink-0 rounded-2xl border border-border ${className ?? ''}`}
    colorSpace={colorSpace}
    xChannel={xChannel}
    yChannel={yChannel}
  >
    <ColorThumb
      className="size-5 rounded-full border-2 border-white shadow-lg data-[dragging=true]:cursor-grabbing data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-2 data-[focus-visible=true]:outline-focus"
      style={({ color }) => ({ background: color.toString('css') })}
    />
  </AriaColorArea>
)
