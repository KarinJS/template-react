import { Button, Label, ScrollShadow, Separator, ToggleButton, ToggleButtonGroup, Tooltip } from '@heroui/react'
import { Check, Copy, Info, Moon, RotateCcw, Shuffle, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type React from 'react'

import type { CustomFont, FontUrlError } from '../theme/fontCdn'
import { fontSansOptions, fontMonoOptions, radiusOptions, type LockableKnob, type ThemeKnobs } from '../theme/knobs'
import type { OklchColor } from '../theme/oklch'
import { AccentControl } from './theme/AccentControl'
import { CssCodeBlock } from './theme/CssCodeBlock'
import { ChromaSlider } from './theme/ChromaSlider'
import { LockableLabel } from './theme/LockableLabel'
import { FontPopover } from './theme/FontPopover'
import { OptionPopover } from './theme/OptionPopover'

/** 主题构建器面板的属性。 */
interface ThemeBuilderPanelProps {
  /** 当前旋钮值。 */
  knobs: ThemeKnobs
  /** 供复制的精简 CSS。 */
  exportCss: string
  /** 模板当前是否深色模式。 */
  isDark: boolean
  /** 当前是否为默认主题。 */
  isDefault: boolean
  /** 已锁定的旋钮。 */
  lockedKnobs: LockableKnob[]
  /** 已导入的自定义字体。 */
  customFonts: CustomFont[]
  /** 导入自定义字体回调。 */
  onImportFont: (url: string) => FontUrlError | 'already-imported' | null
  /** 移除自定义字体回调。 */
  onRemoveFont: (url: string) => void
  /** 面板外壳明暗，用于浮层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给浮层。 */
  panelThemeStyle: React.CSSProperties
  /** 旋钮变更回调。 */
  onKnobsChange: (patch: Partial<ThemeKnobs>) => void
  /** 模板明暗切换回调。 */
  onDarkChange: (isDark: boolean) => void
  /** 切换锁定回调。 */
  onToggleLock: (knob: LockableKnob) => void
  /** 随机配色回调。 */
  onRandomize: () => void
  /** 恢复默认回调。 */
  onReset: () => void
  /** 关闭面板回调。 */
  onClose: () => void
}

/** 表单里的一个字段：标签行 + 控件，纵向间距统一。 */
const Field = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-1.5">{children}</div>

/** 分组标题，用于把表单切成「配色」「形状与文字」「导出」三段。 */
const GroupTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">{children}</h3>
)

/**
 * 模板主题构建器：一个纵向表单，调整后实时作用到画布里的用户组件。
 *
 * 版式参照 HeroUI 官方主题构建器：每个字段都是「可锁定标签 + 单一控件」，
 * 连续量用滑块、离散量收进弹层，避免一排按钮在窄侧边栏里被挤成缝。
 */
export const ThemeBuilderPanel = ({
  knobs,
  exportCss,
  isDark,
  isDefault,
  lockedKnobs,
  customFonts,
  panelTheme,
  panelThemeStyle,
  onKnobsChange,
  onDarkChange,
  onToggleLock,
  onImportFont,
  onRemoveFont,
  onRandomize,
  onReset,
  onClose
}: ThemeBuilderPanelProps) => {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(exportCss)
      setCopied(true)
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // 剪贴板不可用（非 HTTPS 或权限被拒）时保持静默，用户仍可手动选中代码框里的文本。
    }
  }

  const accent: OklchColor = { l: knobs.lightness, c: knobs.chroma, h: knobs.hue }
  const lockProps = (knob: LockableKnob) => ({
    knob,
    isLocked: lockedKnobs.includes(knob),
    onToggleLock
  })

  return (
    <aside className="flex h-full min-w-0 flex-col border-l border-border bg-background">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.24em] text-muted">THEME</div>
          <h2 className="truncate text-sm font-semibold leading-tight text-foreground">模板主题</h2>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip closeDelay={0} delay={200}>
            <Tooltip.Trigger>
              <Button aria-label="随机生成" isIconOnly onPress={onRandomize} size="sm" variant="ghost">
                <Shuffle className="size-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <Tooltip.Arrow />
              <p className="text-xs">随机生成（跳过已锁定项）</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip closeDelay={0} delay={200}>
            <Tooltip.Trigger>
              <Button aria-label="恢复默认" isDisabled={isDefault} isIconOnly onPress={onReset} size="sm" variant="ghost">
                <RotateCcw className="size-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <Tooltip.Arrow />
              <p className="text-xs">恢复默认</p>
            </Tooltip.Content>
          </Tooltip>

          <Button aria-label="关闭主题面板" isIconOnly onPress={onClose} size="sm" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* 表单区自己滚动；导出区在它下面独立占位，见下方 footer。 */}
      <ScrollShadow className="min-h-0 flex-1" hideScrollBar={false} size={32}>
        {/* 用 form 承载：这些控件本质是一组表单字段。onSubmit 阻止回车误触发导航。 */}
        <form className="flex flex-col gap-5 px-4 py-4" onSubmit={(event) => event.preventDefault()}>
          <p className="text-xs leading-relaxed text-muted">
            实时作用到画布里的模板，不影响面板外观。调好后复制 CSS 贴进{' '}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-foreground" translate="no">
              template/style.css
            </code>{' '}
            即可固化。
          </p>

          <section className="flex flex-col gap-4">
            <GroupTitle>配色</GroupTitle>

            <Field>
              {/* 明暗不设锁：它是即时切换的视图开关，不参与随机配色。 */}
              <div className="flex h-6 items-center gap-1">
                <Label className="text-xs font-medium text-foreground">明暗模式</Label>
                <Tooltip closeDelay={0} delay={150}>
                  <Tooltip.Trigger>
                    <Info aria-label="明暗模式说明" className="size-3.5 shrink-0 text-muted" tabIndex={0} />
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-56">
                    <Tooltip.Arrow />
                    <p className="text-xs leading-relaxed">两套配色都已下发到画布，切换是纯 CSS 命中，不会重新计算。</p>
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <ToggleButtonGroup
                aria-label="明暗模式"
                className="w-full"
                selectedKeys={new Set([isDark ? 'dark' : 'light'])}
                selectionMode="single"
                size="sm"
                onSelectionChange={(keys) => {
                  const next = [...keys][0]
                  if (next) {
                    onDarkChange(next === 'dark')
                  }
                }}
              >
                <ToggleButton className="flex-1" id="light">
                  <Sun className="size-3.5" />
                  浅色
                </ToggleButton>
                <ToggleButton className="flex-1" id="dark">
                  <Moon className="size-3.5" />
                  深色
                </ToggleButton>
              </ToggleButtonGroup>
            </Field>

            <Field>
              <LockableLabel label="强调色" tooltip="用于品牌与高亮的主要颜色。拖动滑块换色相，点右侧圆点精调。" {...lockProps('accent')} />
              <AccentControl
                accent={accent}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                onChange={(patch) => onKnobsChange(patch)}
              />
            </Field>

            <Field>
              <LockableLabel
                label="基础色"
                tooltip="控制背景与表面等中性色中灰度的比例。往右染色越明显，过高会显脏。"
                {...lockProps('base')}
              />
              <ChromaSlider hue={knobs.hue} value={knobs.base} onChange={(base) => onKnobsChange({ base })} />
            </Field>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <GroupTitle>形状与文字</GroupTitle>

            <Field>
              <LockableLabel label="圆角" tooltip="全局圆角基准值，各级圆角（sm/md/lg 等）都由它派生。" {...lockProps('radius')} />
              <OptionPopover
                description="影响卡片、按钮等所有圆角，各级尺寸按比例派生。"
                grid
                label="选择圆角"
                options={radiusOptions}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                title="圆角"
                value={knobs.radius}
                onChange={(radius) => onKnobsChange({ radius })}
              />
            </Field>

            <Field>
              <LockableLabel
                label="正文字体"
                tooltip="设置 --font-sans。内置字体只设置字体栈；从 CDN 导入的字体会自动加载到画布里。"
                {...lockProps('fontSans')}
              />
              <FontPopover
                customFonts={customFonts}
                description="用于正文、标题等常规文本，可从 CDN 导入自定义字体。"
                options={fontSansOptions}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                title="正文字体"
                value={knobs.fontSans}
                onChange={(fontSans) => onKnobsChange({ fontSans })}
                onImport={onImportFont}
                onRemove={onRemoveFont}
              />
            </Field>

            <Field>
              <LockableLabel
                label="等宽字体"
                tooltip="设置 --font-mono。内置字体只设置字体栈；从 CDN 导入的字体会自动加载到画布里。"
                {...lockProps('fontMono')}
              />
              <FontPopover
                customFonts={customFonts}
                description="用于代码、数据等需要等宽对齐的场景，可从 CDN 导入自定义字体。"
                options={fontMonoOptions}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                title="等宽字体"
                value={knobs.fontMono}
                onChange={(fontMono) => onKnobsChange({ fontMono })}
                onImport={onImportFont}
                onRemove={onRemoveFont}
              />
            </Field>
          </section>
        </form>
      </ScrollShadow>

      {/*
        导出区固定在底部并撑满剩余高度。
        关键是这一层 flex 列 + min-h-0：滚动条只长在里面的代码块上，
        外层抽屉自身不出现滚动条（避免两层滚动容器争夺滚轮）。
      */}
      <footer className="flex min-h-0 shrink-0 basis-2/5 flex-col gap-2 border-t border-border px-4 pt-3 pb-4">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <GroupTitle>导出 CSS</GroupTitle>
          <Button onPress={handleCopy} size="sm" variant={copied ? 'primary' : 'secondary'}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? '已复制' : '复制'}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {copied ? 'CSS 已复制到剪贴板' : ''}
        </p>
        <CssCodeBlock code={exportCss} panelTheme={panelTheme} />
      </footer>
    </aside>
  )
}
