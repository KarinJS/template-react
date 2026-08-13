import { Button } from '@heroui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ColorSwatch, ColorSwatchPicker, ColorSwatchPickerItem, parseColor } from 'react-aria-components'

/** 色板组件的属性。 */
interface ColorSwatchesCarouselProps {
  /** 当前色值的 hex 形式，用于初次打开时翻到所在页。 */
  currentHex: string
}

/** 每页色板数量，与 HeroUI 官方文档取色器一致。 */
const pageSize = 8

/**
 * 预设色板，与官方文档取色器的 defaultSwatches 一致：
 * 两页 16 色，第一页偏亮适合强调色，第二页补深色系。
 */
const swatches = [
  'hsla(338, 77%, 78%, 1)',
  'hsla(309, 23%, 55%, 1)',
  'hsla(355, 85%, 66%, 1)',
  'hsla(16, 100%, 67%, 1)',
  'hsla(47, 92%, 66%, 1)',
  'hsla(152, 80%, 56%, 1)',
  'hsla(197, 59%, 64%, 1)',
  'hsla(220, 13%, 18%, 1)',
  'hsla(220, 70%, 50%, 1)',
  'hsla(210, 100%, 56%, 1)',
  'hsla(180, 100%, 25%, 1)',
  'hsla(170, 50%, 65%, 1)',
  'hsla(150, 60%, 75%, 1)',
  'hsla(280, 60%, 60%, 1)',
  'hsla(270, 50%, 70%, 1)',
  'hsla(350, 100%, 88%, 1)'
]

/** 色板的 hex 形式，模块级算一次，用于定位当前色所在页。 */
const swatchHexes = swatches.map((swatch) => parseColor(swatch).toString('hex').toLowerCase())

/** 把色板按页切开。 */
const chunk = <T,>(items: readonly T[], size: number): T[][] => {
  const pages: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size))
  }
  return pages
}

/**
 * 分页预设色板：左右箭头翻页，translateX 滑动切换。
 *
 * 必须渲染在 AriaColorPicker 内部——ColorSwatchPicker 选中色板时
 * 会直接更新取色器的值，不需要自己接 onChange。
 */
export const ColorSwatchesCarousel = ({ currentHex }: ColorSwatchesCarouselProps) => {
  const pages = useMemo(() => chunk(swatches, pageSize), [])

  // 初次打开时翻到当前色所在页；之后翻页由用户控制，不跟随外部值。
  const [page, setPage] = useState(() => {
    const index = swatchHexes.indexOf(currentHex.toLowerCase())
    return index === -1 ? 0 : Math.floor(index / pageSize)
  })

  const isFirstPage = page === 0
  const isLastPage = page === pages.length - 1

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="上一页色板"
        className="size-5 min-w-5 shrink-0 rounded-full"
        isDisabled={isFirstPage}
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={() => setPage((current) => Math.max(0, current - 1))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="relative flex-1 overflow-hidden">
        <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${page * 100}%)` }}>
          {pages.map((pageSwatches, pageIndex) => (
            <div className="flex h-5.5 w-full shrink-0 justify-center" key={pageIndex}>
              <ColorSwatchPicker className="flex items-center justify-start gap-1.5">
                {pageSwatches.map((swatch) => (
                  <ColorSwatchPickerItem
                    className="size-4 rounded-full transition-all data-selected:ring-1 data-selected:ring-foreground data-selected:ring-offset-1"
                    color={swatch}
                    key={swatch}
                  >
                    <ColorSwatch
                      aria-label={`使用预设色 ${swatch}`}
                      className="size-full cursor-pointer rounded-full"
                      style={{ background: swatch }}
                    />
                  </ColorSwatchPickerItem>
                ))}
              </ColorSwatchPicker>
            </div>
          ))}
        </div>
      </div>

      <Button
        aria-label="下一页色板"
        className="size-5 min-w-5 shrink-0 rounded-full"
        isDisabled={isLastPage}
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={() => setPage((current) => Math.min(pages.length - 1, current + 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
