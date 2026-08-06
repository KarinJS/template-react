import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
  Modal,
  parseColor
} from '@heroui/react'
import { Brush, Moon, RotateCcw, Sun } from 'lucide-react'
import type React from 'react'

/** 模板主题控制弹窗的属性。 */
interface TemplateThemeControlsProps {
  /** 弹窗是否打开。 */
  isOpen: boolean
  /** 面板外壳主题，用于弹窗自身换肤。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传到弹窗容器。 */
  panelThemeStyle: React.CSSProperties
  /** 模板当前是否为深色模式。 */
  isDarkMode: boolean
  /** 取色器当前展示的颜色（未自定义时为占位预设色）。 */
  accent: string
  /** 是否未设置模板主题色（即跟随组件库默认主题）。 */
  isDefaultAccent: boolean
  /** 弹窗开关回调。 */
  onOpenChange: (isOpen: boolean) => void
  /** 明暗模式切换回调。 */
  onThemeModeChange: (isDarkMode: boolean) => void
  /** 主色变更回调，参数为十六进制颜色。 */
  onAccentChange: (hex: string) => void
  /** 恢复组件库默认主题回调。 */
  onResetAccent: () => void
}

/** 预设主色候选，与面板主题弹窗保持一致。 */
const accentPresets = ['#111111', '#3f3f46', '#0a72ef', '#de1d8d', '#ff5b4f']

/**
 * 模板主题弹窗：切换传给用户组件的明暗模式和主题色，与面板外壳主题完全独立。
 * 未设置主色时不下发任何颜色变量，组件库自身主题生效。
 */
export const TemplateThemeControls = ({
  isOpen,
  panelTheme,
  panelThemeStyle,
  isDarkMode,
  accent,
  isDefaultAccent,
  onOpenChange,
  onThemeModeChange,
  onAccentChange,
  onResetAccent
}: TemplateThemeControlsProps) => (
  <Modal.Backdrop
    className={panelTheme}
    data-theme={panelTheme}
    isDismissable
    isOpen={isOpen}
    style={panelThemeStyle}
    variant="blur"
    onOpenChange={onOpenChange}
  >
    <Modal.Container className="p-4 sm:p-6" placement="center" size="sm">
      <Modal.Dialog className="sm:max-w-120">
        <Modal.CloseTrigger />
        <Modal.Header>
          <Modal.Icon className="bg-default text-foreground">
            <Brush size={20} />
          </Modal.Icon>
          <Modal.Heading>模板主题</Modal.Heading>
        </Modal.Header>

        <Modal.Body className="space-y-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">这里的设置只影响画布里的模板组件，不影响面板外观。</p>
            <p className="text-sm text-muted">不选主色时框架不下发任何颜色变量，组件库（如 HeroUI）按自身默认主题渲染。</p>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button onPress={() => onThemeModeChange(false)} variant={isDarkMode ? 'secondary' : 'primary'}>
                <Sun size={16} />
                浅色
              </Button>
              <Button onPress={() => onThemeModeChange(true)} variant={isDarkMode ? 'primary' : 'secondary'}>
                <Moon size={16} />
                深色
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">Accent</Label>
              <span className="text-xs font-medium text-muted">{isDefaultAccent ? '组件库默认' : accent.toUpperCase()}</span>
            </div>

            <ColorSwatchPicker
              aria-label="模板主题预设色"
              className="flex flex-wrap gap-2"
              size="sm"
              value={parseColor(accent)}
              variant="square"
              onChange={(color) => onAccentChange(color.toString('hex'))}
            >
              {accentPresets.map((color) => (
                <ColorSwatchPicker.Item key={color} color={color}>
                  <ColorSwatchPicker.Swatch />
                  <ColorSwatchPicker.Indicator />
                </ColorSwatchPicker.Item>
              ))}
            </ColorSwatchPicker>
          </div>

          <ColorPicker value={parseColor(accent)} onChange={(color) => onAccentChange(color.toString('hex'))}>
            <ColorPicker.Trigger className="flex w-full items-center gap-3 rounded-2xl bg-default px-3 py-3 text-left">
              <ColorSwatch className="rounded-lg" size="lg" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Label className="text-sm font-medium text-foreground">自定义主色</Label>
                <span className="truncate text-xs text-muted">{isDefaultAccent ? '组件库默认' : accent.toUpperCase()}</span>
              </div>
            </ColorPicker.Trigger>

            <ColorPicker.Popover className="p-0">
              <div
                className={`${panelTheme} flex w-72 flex-col gap-3 rounded-2xl bg-overlay p-3`}
                data-theme={panelTheme}
                style={panelThemeStyle}
              >
                <ColorArea aria-label="颜色选择区域" className="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
                  <ColorArea.Thumb />
                </ColorArea>

                <ColorSlider aria-label="色相滑块" channel="hue" className="gap-1" colorSpace="hsb">
                  <Label className="text-xs font-medium text-foreground">Hue</Label>
                  <ColorSlider.Output className="text-xs text-muted" />
                  <ColorSlider.Track>
                    <ColorSlider.Thumb />
                  </ColorSlider.Track>
                </ColorSlider>

                <ColorField aria-label="主题色数值">
                  <ColorField.Group variant="secondary">
                    <ColorField.Prefix>
                      <ColorSwatch size="xs" />
                    </ColorField.Prefix>
                    <ColorField.Input />
                  </ColorField.Group>
                </ColorField>
              </div>
            </ColorPicker.Popover>
          </ColorPicker>
        </Modal.Body>

        <Modal.Footer>
          <Button isDisabled={isDefaultAccent} onPress={onResetAccent} variant="secondary">
            <RotateCcw size={16} />
            恢复默认
          </Button>
          <Button onPress={() => onOpenChange(false)}>完成</Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
)
