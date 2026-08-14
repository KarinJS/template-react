import { Button, ScrollShadow, Separator, ToggleButton, ToggleButtonGroup, Tooltip, Label } from '@heroui/react'
import { Check, Code2, Copy, Info, Moon, RotateCcw, Shuffle, Sun, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'

import type { CustomFont, FontUrlError } from '../theme/fontCdn'
import { type LockableKnob, type ThemeKnobs } from '../theme/knobs'
import type { OklchColor } from '../theme/oklch'
import { themePresets, type ThemePreset } from '../theme/presets'
import { AccentControl } from './theme/AccentControl'
import { CssCodeBlock } from './theme/CssCodeBlock'
import { ChromaSlider } from './theme/ChromaSlider'
import { LockableLabel } from './theme/LockableLabel'
import { FontPopover } from './theme/FontPopover'
import { RadiusPopover } from './theme/RadiusPopover'
import { ThemePresetPopover } from './theme/ThemePresetPopover'

/** 主题构建器面板的属性。 */
interface ThemeBuilderPanelProps {
  /** 当前旋钮值。 */
  knobs: ThemeKnobs
  /** 生成导出 CSS 的回调（依赖旋钮和自定义字体，代码弹窗实时调用）。 */
  getExportCss: () => string
  /** 当前旋钮命中的预设；undefined 表示「自定义」。 */
  matchingPreset: ThemePreset | undefined
  /** 模板当前是否深色模式。 */
  isDark: boolean
  /** 当前是否为默认主题。 */
  isDefault: boolean
  /** 已锁定的旋钮。 */
  lockedKnobs: LockableKnob[]
  /** 已导入的自定义字体。 */
  customFonts: CustomFont[]
  /** 导入自定义字体回调。 */
  onImportFont: (url: string) => FontUrlError | null
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
  /** 应用预设回调。 */
  onApplyPreset: (preset: ThemePreset) => void
  /** 恢复默认回调。 */
  onReset: () => void
  /** 关闭面板回调。 */
  onClose: () => void
}

/** 表单里的一个字段：标签行 + 控件，纵向间距统一。 */
const Field = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-1.5">{children}</div>

/** 分组标题，用于把表单切成「配色」「形状与文字」两段。 */
const GroupTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">{children}</h3>
)

/** 键盘事件焦点是否在可输入区域：是则快捷键让位给正常输入。 */
const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || Boolean((target as HTMLElement | null)?.isContentEditable)

/**
 * 模板主题构建器：一个纵向表单，调整后实时作用到画布里的用户组件。
 *
 * 控件与文案复刻 HeroUI 官方主题编辑器：预设弹层、离散量收进弹层、
 * 随机生成一键直达，导出 CSS 收进左侧滑出的代码弹窗（打开期间实时跟随旋钮）。
 */
export const ThemeBuilderPanel = ({
  knobs,
  getExportCss,
  matchingPreset,
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
  onApplyPreset,
  onReset,
  onClose
}: ThemeBuilderPanelProps) => {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 代码弹窗：打开期间实时跟随旋钮生成 CSS；走 useDeferredValue，
  // 拖滑块时高亮重渲染让位给滑块本身，不卡顿。
  const [codeOpen, setCodeOpen] = useState(false)
  const [codeMounted, setCodeMounted] = useState(false)
  const liveCode = useMemo(() => (codeOpen ? getExportCss() : ''), [codeOpen, getExportCss])
  const deferredCode = useDeferredValue(liveCode)

  const codePanelRef = useRef<HTMLDivElement>(null)
  const codeEntryRef = useRef<HTMLDivElement>(null)

  // 代码弹窗打开期间，点弹窗以外的地方自动关闭（入口按钮除外，避免刚点开就被关掉）。
  useEffect(() => {
    if (!codeOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (codePanelRef.current?.contains(target) || codeEntryRef.current?.contains(target)) return
      setCodeOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [codeOpen])

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  // 滑入动画：挂载后下一帧再归位，transition 才有起点。
  useEffect(() => {
    if (!codeOpen) {
      setCodeMounted(false)
      return
    }
    const frame = requestAnimationFrame(() => setCodeMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [codeOpen])

  // 按 T 随机应用一个预设，与官方主题编辑器一致；焦点在输入框时让位。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 't' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return

      const preset = themePresets[Math.floor(Math.random() * themePresets.length)]
      if (preset) {
        onApplyPreset(preset)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onApplyPreset])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(liveCode)
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
    <aside className="relative flex h-full min-w-0 flex-col border-l border-border bg-background">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.24em] text-muted">THEME</div>
          <h2 className="truncate text-sm font-semibold leading-tight text-foreground">模板主题</h2>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip closeDelay={80} delay={200}>
            <Tooltip.Trigger>
              <Button aria-label="随机生成" isIconOnly onPress={onRandomize} size="sm" variant="ghost">
                <Shuffle className="size-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow>
              <Tooltip.Arrow />
              <p className="text-xs">随机生成（跳过已锁定项）</p>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip closeDelay={80} delay={200}>
            <Tooltip.Trigger>
              <Button aria-label="恢复默认" isDisabled={isDefault} isIconOnly onPress={onReset} size="sm" variant="ghost">
                <RotateCcw className="size-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow>
              <Tooltip.Arrow />
              <p className="text-xs">恢复默认</p>
            </Tooltip.Content>
          </Tooltip>

          <Button aria-label="关闭主题面板" isIconOnly onPress={onClose} size="sm" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* 表单区自己滚动。 */}
      <ScrollShadow className="min-h-0 flex-1" hideScrollBar={false} size={32}>
        {/* 用 form 承载：这些控件本质是一组表单字段。onSubmit 阻止回车误触发导航。 */}
        <form className="flex flex-col gap-5 px-4 py-4" onSubmit={(event) => event.preventDefault()}>
          <p className="text-xs leading-relaxed text-muted">
            实时作用到画布里的模板，不影响面板外观。调好后点下方「查看代码」复制 CSS 贴进{' '}
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
                <Tooltip closeDelay={80} delay={150}>
                  <Tooltip.Trigger>
                    <Info aria-label="明暗模式说明" className="size-3.5 shrink-0 text-muted" tabIndex={0} />
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="max-w-56">
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
              {/* 预设不设锁：它一次改写多个旋钮，锁的语义（随机时跳过）管不到它。 */}
              <div className="flex h-6 items-center gap-1">
                <Label className="text-xs font-medium text-foreground">主题</Label>
              </div>
              <ThemePresetPopover
                current={matchingPreset}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                vibrant={knobs.vibrant}
                onApply={onApplyPreset}
                onVibrantChange={(vibrant) => onKnobsChange({ vibrant })}
              />
            </Field>

            <Field>
              <LockableLabel label="强调色" tooltip="用于品牌与高亮的主要颜色" {...lockProps('accent')} />
              <AccentControl
                accent={accent}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                onChange={(patch) => onKnobsChange(patch)}
              />
            </Field>

            <Field>
              <LockableLabel label="基础色" tooltip="控制背景与表面等中性色中灰度的比例" {...lockProps('base')} />
              <ChromaSlider hue={knobs.hue} value={knobs.base} onChange={(base) => onKnobsChange({ base })} />
            </Field>
          </section>

          <Separator />

          <section className="flex flex-col gap-4">
            <GroupTitle>形状与文字</GroupTitle>

            <Field>
              {/* 圆角的两把锁收在弹层内的两个栏标题行（radius/formRadius 各自独立），
                  字段行只保留标签和说明。 */}
              <div className="flex h-6 items-center gap-1">
                <Label className="text-xs font-medium text-foreground">圆角</Label>
                <Tooltip closeDelay={80} delay={150}>
                  <Tooltip.Trigger>
                    <Info aria-label="圆角说明" className="size-3.5 shrink-0 text-muted" tabIndex={0} />
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="max-w-56">
                    <Tooltip.Arrow />
                    <p className="text-xs leading-relaxed">
                      全局圆角影响整体 UI，例如菜单与弹窗；表单圆角影响表单元素，例如输入框与选择器。
                    </p>
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <RadiusPopover
                formRadiusValue={knobs.formRadius}
                lockedKnobs={lockedKnobs}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                radiusValue={knobs.radius}
                onFormRadiusChange={(formRadius) => onKnobsChange({ formRadius })}
                onRadiusChange={(radius) => onKnobsChange({ radius })}
                onToggleLock={onToggleLock}
              />
            </Field>

            <Field>
              {/* 字体的两把锁收在弹层内的两个段标题行（fontSans/fontMono 各自独立），
                  字段行只保留标签和说明。 */}
              <div className="flex h-6 items-center gap-1">
                <Label className="text-xs font-medium text-foreground">字体</Label>
                <Tooltip closeDelay={80} delay={150}>
                  <Tooltip.Trigger>
                    <Info aria-label="字体说明" className="size-3.5 shrink-0 text-muted" tabIndex={0} />
                  </Tooltip.Trigger>
                  <Tooltip.Content showArrow className="max-w-56">
                    <Tooltip.Arrow />
                    <p className="text-xs leading-relaxed">
                      设置 --font-sans 与 --font-mono。内置字体只设置字体栈；从 CDN 导入的字体会自动加载到画布里。
                    </p>
                  </Tooltip.Content>
                </Tooltip>
              </div>
              <FontPopover
                customFonts={customFonts}
                lockedKnobs={lockedKnobs}
                monoValue={knobs.fontMono}
                panelTheme={panelTheme}
                panelThemeStyle={panelThemeStyle}
                sansValue={knobs.fontSans}
                onImport={onImportFont}
                onMonoChange={(fontMono) => onKnobsChange({ fontMono })}
                onRemove={onRemoveFont}
                onSansChange={(fontSans) => onKnobsChange({ fontSans })}
                onToggleLock={onToggleLock}
              />
            </Field>
          </section>
        </form>
      </ScrollShadow>

      {/* 底部只留入口；CSS 预览挪到左侧滑出的代码弹窗。 */}
      <footer className="shrink-0 border-t border-border px-4 py-3" ref={codeEntryRef}>
        <Button className="w-full" onPress={() => setCodeOpen(true)} size="sm" variant="secondary">
          <Code2 className="size-3.5" />
          查看代码
        </Button>
      </footer>

      {/*
        代码弹窗：贴在抽屉左缘滑出，不用 Modal——它是抽屉的延伸，不该遮罩整个面板。
        打开期间实时跟随旋钮生成（deferred，拖滑块不被高亮重渲染拖住）。
        注意外层 Panel 需要 overflow: visible（见 App.tsx），否则这里会被裁剪。
      */}
      {codeOpen && (
        <div
          className={`absolute right-full top-0 z-20 flex h-full w-105 flex-col border border-border bg-background shadow-xl transition-transform duration-200 ease-out ${
            codeMounted ? 'translate-x-0' : 'translate-x-4'
          }`}
          ref={codePanelRef}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="font-mono text-xs text-foreground" translate="no">
              style.css
            </p>
            <div className="flex items-center gap-0.5">
              <Button onPress={() => void handleCopy()} size="sm" variant={copied ? 'primary' : 'secondary'}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? '已复制' : '复制'}
              </Button>
              <p aria-live="polite" className="sr-only">
                {copied ? 'CSS 已复制到剪贴板' : ''}
              </p>

              <Button aria-label="关闭代码面板" isIconOnly onPress={() => setCodeOpen(false)} size="sm" variant="ghost">
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-2">
            <CssCodeBlock code={deferredCode} panelTheme={panelTheme} />
          </div>
        </div>
      )}
    </aside>
  )
}
