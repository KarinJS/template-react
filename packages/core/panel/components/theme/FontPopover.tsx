import { Button, Description, FieldError, InputGroup, Label, ListBox, Popover, ScrollShadow, TextField, Tooltip } from '@heroui/react'
import gsap from 'gsap'
import { ArrowLeft, ChevronsUpDown, Globe, Lock, LockOpen, Plus, Trash2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'

import { getFontUrlErrorMessage, validateFontUrl, type CustomFont, type FontUrlError } from '../../theme/fontCdn'
import { fontMonoOptions, fontSansOptions, type KnobOption, type LockableKnob } from '../../theme/knobs'

/** 合并字体弹层的属性。 */
interface FontPopoverProps {
  /** 当前正文字体栈。 */
  sansValue: string
  /** 当前等宽字体栈。 */
  monoValue: string
  /** 用户导入的 CDN 字体。 */
  customFonts: readonly CustomFont[]
  /** 已锁定的旋钮（两栏字体各自有锁，收在栏标题行）。 */
  lockedKnobs: readonly LockableKnob[]
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 选中正文字体回调。 */
  onSansChange: (value: string) => void
  /** 选中等宽字体回调。 */
  onMonoChange: (value: string) => void
  /** 切换锁定回调。 */
  onToggleLock: (knob: LockableKnob) => void
  /** 导入 CDN 字体，返回错误码表示失败。 */
  onImport: (url: string) => FontUrlError | null
  /** 移除已导入字体。 */
  onRemove: (url: string) => void
}

/** 面板文档里注入字体预览用的节点 id 前缀。 */
const previewNodePrefix = 'ktr-font-preview-'

/**
 * 把字体样式表注入面板自身文档。
 *
 * 卡片要用真实字形预览，面板文档也得加载这些字体——
 * 沙盒那份注入只作用于 iframe，管不到侧边栏。
 */
const useFontPreviews = (urls: readonly string[]) => {
  const key = urls.join('|')

  useEffect(() => {
    const wanted = urls.filter(Boolean)

    for (const url of wanted) {
      const id = `${previewNodePrefix}${encodeURIComponent(url)}`
      if (document.getElementById(id)) continue

      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = url
      document.head.appendChild(link)
    }
    // 预览节点故意不回收：字体样式表体积小、命中缓存，
    // 反复增删反而会在切换弹层时造成字形闪烁。
  }, [key, urls])
}

/** 从字体栈里取出首个 family 名，用于触发器和卡片预览。 */
const primaryFamily = (stack: string): string =>
  stack
    .split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '') ?? stack

/** 网格里的一条字体条目：内置候选或用户导入的 CDN 字体。 */
interface FontEntry {
  id: string
  label: string
  value: string
  cdnUrl: string | undefined
  removable: boolean
}

/** 卡片区与导入表单互相让位时的横向位移（px）。 */
const shiftDistance = 90

/**
 * 单栏字体（正文 / 等宽）：标题行（名称 + 锁）+ 字体网格 + 底部「从 CDN 添加」。
 *
 * 「从 CDN 添加」只影响本栏：字体卡片向左退出、导入表单同时从右侧进入
 * （同一条 GSAP 时间线的 0 刻度，位移等量反向），底部按钮原地渐隐渐出
 * （缩放 + 透明度 + 模糊，无位移），另一栏完全不受影响。
 */
const FontSection = ({
  title,
  knob,
  options,
  fallback,
  customFonts,
  value,
  lockedKnobs,
  resetSignal,
  onChange,
  onToggleLock,
  onImport,
  onRemove
}: {
  title: string
  /** 该栏对应的可锁旋钮，锁按钮收在栏标题行。 */
  knob: LockableKnob
  options: readonly KnobOption[]
  /** 导入字体栈的兜底部分（sans-serif / monospace 体系）。 */
  fallback: string
  customFonts: readonly CustomFont[]
  value: string
  lockedKnobs: readonly LockableKnob[]
  /** 弹层关闭信号：变化时把本栏硬复位到卡片态（不播动画）。 */
  resetSignal: number
  onChange: (value: string) => void
  onToggleLock: (knob: LockableKnob) => void
  onImport: (url: string) => FontUrlError | null
  onRemove: (url: string) => void
}) => {
  const isLocked = lockedKnobs.includes(knob)

  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const tilesRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const addButtonRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  /** 上一次的模式：只在真实切换时播动画，挂载和重复渲染一律跳过。 */
  const prevModeRef = useRef(mode)

  // 模式切换动画：卡片横移让位与表单进入严格同步，按钮原地模糊渐隐渐出。
  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = mode
    if (prev === mode) return

    const tiles = tilesRef.current
    const form = formRef.current
    const addButton = addButtonRef.current
    const actions = actionsRef.current
    if (!tiles || !form || !addButton || !actions) return

    const entering = mode === 'custom'
    const timeline = gsap.timeline()

    if (entering) {
      timeline
        .set([form, actions], { visibility: 'visible' })
        .to(tiles, { x: -shiftDistance, opacity: 0, duration: 0.3, ease: 'power2.inOut' }, 0)
        .fromTo(form, { x: shiftDistance, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.inOut' }, 0)
        .to(addButton, { opacity: 0, scale: 0.92, filter: 'blur(6px)', duration: 0.24, ease: 'power2.out' }, 0)
        .fromTo(
          actions,
          { opacity: 0, scale: 0.92, filter: 'blur(6px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.24, ease: 'power2.out' },
          0
        )
        .set([tiles, addButton], { visibility: 'hidden' })
    } else {
      timeline
        .set([tiles, addButton], { visibility: 'visible' })
        .to(form, { x: shiftDistance, opacity: 0, duration: 0.3, ease: 'power2.inOut' }, 0)
        .fromTo(tiles, { x: -shiftDistance, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power2.inOut' }, 0)
        .to(actions, { opacity: 0, scale: 0.92, filter: 'blur(6px)', duration: 0.24, ease: 'power2.out' }, 0)
        .fromTo(
          addButton,
          { opacity: 0, scale: 0.92, filter: 'blur(6px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.24, ease: 'power2.out' },
          0
        )
        .set([form, actions], { visibility: 'hidden' })
    }

    return () => {
      timeline.kill()
    }
  }, [mode])

  // 弹层关闭后硬复位（不播动画）：下次打开永远是卡片态，不会出现
  // 「先看到导入表单、再倒退回卡片」的反向动画。
  useEffect(() => {
    if (resetSignal === 0) return

    // 先把 prevModeRef 拨到 preset，下面的 setMode 就不会触发过渡动画。
    prevModeRef.current = 'preset'
    setMode('preset')
    setUrl('')
    setImportError(null)

    const tiles = tilesRef.current
    const form = formRef.current
    const addButton = addButtonRef.current
    const actions = actionsRef.current
    if (!tiles || !form || !addButton || !actions) return

    gsap.set([tiles, addButton], { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)', visibility: 'visible' })
    gsap.set([form, actions], { opacity: 0, visibility: 'hidden' })
  }, [resetSignal])

  // 内置候选和已导入字体合并成一个列表：对用户来说它们是同一件事。
  const suggested: FontEntry[] = options.map((option) => ({
    id: option.id,
    label: option.label,
    value: option.value,
    cdnUrl: option.cdnUrl,
    removable: false
  }))
  const imported: FontEntry[] = customFonts.map((font) => ({
    id: font.url,
    label: font.family,
    // 导入的字体放在栈首，后面按栏位接对应的系统字体兜底。
    value: `'${font.family}', ${fallback}`,
    cdnUrl: font.url,
    removable: true
  }))
  const entries = [...suggested, ...imported]
  const current = entries.find((entry) => entry.value === value)

  /** 输入合法性：为空不算错（还没开始填），其余交给白名单校验。 */
  const validation = useMemo<string | null>(() => {
    if (!url.trim()) return null
    const error = validateFontUrl(url.trim())
    return error ? getFontUrlErrorMessage(error) : null
  }, [url])

  const handleImport = async () => {
    // 导入本身是同步的，这里过一拍事件循环只是为了能让「导入中...」落到界面上，
    // 与官方主题构建器的交互节奏保持一致。
    setImporting(true)
    await Promise.resolve()

    const trimmed = url.trim()
    const error = onImport(trimmed)
    setImporting(false)

    if (error) {
      const existing = customFonts.find((font) => font.url === trimmed)
      setImportError(getFontUrlErrorMessage(error, existing?.family))
      return
    }

    setUrl('')
    setImportError(null)
    setMode('preset')
  }

  const errorMessage = importError ?? validation

  const renderTile = (entry: FontEntry) => (
    <ListBox.Item
      className="group relative flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border data-[hovered=true]:bg-default data-[selected=true]:border-foreground"
      id={entry.id}
      key={entry.id}
      textValue={entry.label}
    >
      {/* nowrap 是必须的：预览文字折行会把卡片撑高，同一行就对不齐了。 */}
      <span className="whitespace-nowrap text-xl leading-none text-foreground" style={{ fontFamily: entry.value }}>
        Ag 中文
      </span>
      <span className="max-w-full truncate px-2 text-[10px] text-muted group-data-[selected=true]:text-foreground">{entry.label}</span>

      {entry.removable && (
        <Tooltip closeDelay={80} delay={200}>
          <Tooltip.Trigger className="absolute inset-e-1 top-1">
            <Button
              aria-label={`移除字体 ${entry.label}`}
              className="size-5 min-h-0 p-0 opacity-0 group-data-[hovered=true]:opacity-100"
              isIconOnly
              onPress={() => onRemove(entry.cdnUrl!)}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="size-3 text-danger" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="text-xs">移除字体</p>
          </Tooltip.Content>
        </Tooltip>
      )}
    </ListBox.Item>
  )

  const renderGrid = (items: FontEntry[]) => (
    <ListBox
      aria-label={title}
      className="grid grid-cols-2 gap-2.5 p-0"
      disallowEmptySelection
      layout="grid"
      selectedKeys={new Set(current ? [current.id] : [])}
      selectionMode="single"
      onSelectionChange={(keys) => {
        const id = [...keys][0]
        const selected = entries.find((entry) => entry.id === id)
        if (selected) {
          onChange(selected.value)
        }
      }}
    >
      {items.map(renderTile)}
    </ListBox>
  )

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="group flex h-6 items-center gap-1">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <Tooltip closeDelay={80} delay={150}>
          <Tooltip.Trigger>
            <button
              aria-label={isLocked ? `解锁${title}数值` : `锁定${title}数值`}
              aria-pressed={isLocked}
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:bg-default focus-visible:text-foreground ${
                isLocked ? 'text-foreground' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
              onClick={() => onToggleLock(knob)}
              type="button"
            >
              {isLocked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="text-xs">{isLocked ? '解锁数值' : '锁定数值'}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>

      {/* 卡片区与导入表单叠在同一容器里，GSAP 控制两层让位；滚动条隐藏。 */}
      <div className="relative h-72 overflow-hidden">
        <div ref={tilesRef} className="absolute inset-0">
          <ScrollShadow className="h-full" hideScrollBar size={16}>
            {imported.length > 0 && <p className="text-[10px] text-muted">推荐</p>}
            {renderGrid(suggested)}
            {imported.length > 0 && (
              <>
                <p className="mt-2 text-[10px] text-muted">全部字体</p>
                {renderGrid(imported)}
              </>
            )}
          </ScrollShadow>
        </div>

        <div ref={formRef} className="absolute inset-0 flex flex-col gap-2 pt-1" style={{ opacity: 0, visibility: 'hidden' }}>
          <TextField
            isInvalid={Boolean(errorMessage)}
            value={url}
            onChange={(next) => {
              setUrl(next)
              setImportError(null)
            }}
          >
            <Label className="text-xs font-medium text-foreground">字体 URL</Label>
            <InputGroup variant="secondary">
              <InputGroup.Prefix>
                <Globe aria-hidden="true" className="size-3.5 text-muted" />
              </InputGroup.Prefix>
              <InputGroup.Input className="text-xs" placeholder="粘贴字体 URL..." />
            </InputGroup>
            <Description className="text-xs leading-relaxed text-muted">支持 G Fonts、Fontsource 与 Fontshare</Description>
            {errorMessage && <FieldError className="text-xs">{errorMessage}</FieldError>}
          </TextField>
        </div>
      </div>

      {/* 底部按钮原地变形：渐隐=缩小+透明+模糊，渐入反之，不位移。 */}
      <div className="relative h-8">
        <div ref={addButtonRef} className="absolute inset-0">
          <Button className="h-full w-full border border-dashed border-border" onPress={() => setMode('custom')} size="sm" variant="ghost">
            <Plus className="size-3.5" />
            从 CDN 添加
          </Button>
        </div>
        <div ref={actionsRef} className="absolute inset-0 flex gap-2" style={{ opacity: 0, visibility: 'hidden' }}>
          <Button
            className="h-full flex-1"
            onPress={() => {
              setMode('preset')
              setImportError(null)
            }}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="size-3.5" />
            返回
          </Button>
          <Button
            className="h-full flex-1"
            isDisabled={!url.trim() || Boolean(validation) || importing}
            onPress={() => void handleImport()}
            size="sm"
            variant="secondary"
          >
            {importing ? '导入中...' : '确定'}
          </Button>
        </div>
      </div>
    </section>
  )
}

/**
 * 合并的字体选择器：一个「字体」字段，弹层内左栏正文、右栏等宽，
 * 两栏各自滚动、各自有「从 CDN 添加」入口，中间不放分割线。
 *
 * 卡片用目标字体渲染「Ag 中文」，选之前就能看清字形和中文覆盖情况——
 * ktr 不打包任何字体，选错了在真实渲染时会回落，光看名字判断不了。
 */
export const FontPopover = ({
  sansValue,
  monoValue,
  customFonts,
  lockedKnobs,
  panelTheme,
  panelThemeStyle,
  onSansChange,
  onMonoChange,
  onToggleLock,
  onImport,
  onRemove
}: FontPopoverProps) => {
  // 两栏的所有字体样式表都注入面板文档，保证 tile 预览是真实字形。
  const previewUrls = useMemo(
    () =>
      [...fontSansOptions, ...fontMonoOptions]
        .map((option) => option.cdnUrl)
        .concat(customFonts.map((font) => font.url))
        .filter((it): it is string => Boolean(it)),
    [customFonts]
  )
  useFontPreviews(previewUrls)

  const currentSans = [...fontSansOptions].find((option) => option.value === sansValue)

  /** 弹层关闭信号：关闭时把两栏都硬复位回卡片态。 */
  const [resetSignal, setResetSignal] = useState(0)

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) setResetSignal((current) => current + 1)
      }}
    >
      <Popover.Trigger>
        <InputGroup className="w-full cursor-pointer" variant="secondary">
          <InputGroup.Prefix className="w-8">
            <Type aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input
            aria-label="字体"
            className="cursor-pointer truncate text-xs"
            readOnly
            value={currentSans?.label ?? primaryFamily(sansValue)}
          />
          <InputGroup.Suffix className="w-8">
            <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Suffix>
        </InputGroup>
      </Popover.Trigger>

      {/* 双栏布局要够宽够高：字体卡片要放大字预览，挤在窄弹层里看不出字形差异。 */}
      <Popover.Content className="w-120" placement="left">
        <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
          <Popover.Dialog className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <FontSection
                customFonts={customFonts}
                fallback="system-ui, sans-serif"
                knob="fontSans"
                lockedKnobs={lockedKnobs}
                options={fontSansOptions}
                resetSignal={resetSignal}
                title="正文字体"
                value={sansValue}
                onChange={onSansChange}
                onImport={onImport}
                onRemove={onRemove}
                onToggleLock={onToggleLock}
              />
              <FontSection
                customFonts={customFonts}
                fallback="ui-monospace, monospace"
                knob="fontMono"
                lockedKnobs={lockedKnobs}
                options={fontMonoOptions}
                resetSignal={resetSignal}
                title="等宽字体"
                value={monoValue}
                onChange={onMonoChange}
                onImport={onImport}
                onRemove={onRemove}
                onToggleLock={onToggleLock}
              />
            </div>
          </Popover.Dialog>
        </div>
      </Popover.Content>
    </Popover>
  )
}
