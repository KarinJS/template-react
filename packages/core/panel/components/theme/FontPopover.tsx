import { Button, Description, FieldError, InputGroup, Label, ListBox, Popover, ScrollShadow, TextField, Tooltip } from '@heroui/react'
import { ArrowLeft, ChevronsUpDown, Globe, Plus, Trash2, Type } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type React from 'react'

import { getFontUrlErrorMessage, validateFontUrl, type CustomFont, type FontUrlError } from '../../theme/fontCdn'
import type { KnobOption } from '../../theme/knobs'

/** 字体选择弹层的属性。 */
interface FontPopoverProps {
  /** 弹层标题，同时作为无障碍标签。 */
  title: string
  /** 弹层里的补充说明。 */
  description: string
  /** 内置候选字体。 */
  options: readonly KnobOption[]
  /** 用户导入的 CDN 字体。 */
  customFonts: readonly CustomFont[]
  /** 当前选中的字体栈。 */
  value: string
  /** 面板外壳明暗，用于弹层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给弹层。 */
  panelThemeStyle: React.CSSProperties
  /** 选中回调。 */
  onChange: (value: string) => void
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

/** 从字体栈里取出首个 family 名，用于卡片预览。 */
const primaryFamily = (stack: string): string => stack.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? stack

/**
 * 字体选择器：内置候选 + CDN 导入两种模式共用一个弹层。
 *
 * 卡片用目标字体渲染「Ag 中文」，选之前就能看清字形和中文覆盖情况——
 * ktr 不打包任何字体，选错了在真实渲染时会回落，光看名字判断不了。
 */
export const FontPopover = ({
  title,
  description,
  options,
  customFonts,
  value,
  panelTheme,
  panelThemeStyle,
  onChange,
  onImport,
  onRemove
}: FontPopoverProps) => {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [url, setUrl] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  // 内置候选和已导入字体合并成一个列表：对用户来说它们是同一件事。
  const entries = useMemo(
    () => [
      ...options.map((option) => ({
        id: option.id,
        label: option.label,
        value: option.value,
        cdnUrl: option.cdnUrl,
        removable: false
      })),
      ...customFonts.map((font) => ({
        id: font.url,
        label: font.family,
        // 导入的字体放在栈首，后面接系统字体做兜底。
        value: `'${font.family}', system-ui, sans-serif`,
        cdnUrl: font.url,
        removable: true
      }))
    ],
    [customFonts, options]
  )

  useFontPreviews(useMemo(() => entries.map((entry) => entry.cdnUrl).filter((it): it is string => Boolean(it)), [entries]))

  const current = entries.find((entry) => entry.value === value)

  /** 输入合法性：为空不算错（还没开始填），其余交给白名单校验。 */
  const validation = useMemo<string | null>(() => {
    if (!url.trim()) return null
    const error = validateFontUrl(url.trim())
    return error ? getFontUrlErrorMessage(error) : null
  }, [url])

  const handleImport = () => {
    const error = onImport(url)
    if (error) {
      setImportError(getFontUrlErrorMessage(error))
      return
    }

    setUrl('')
    setImportError(null)
    setMode('preset')
  }

  const errorMessage = importError ?? validation

  return (
    <Popover>
      <Popover.Trigger>
        <InputGroup className="w-full cursor-pointer" variant="secondary">
          <InputGroup.Prefix className="w-8">
            <Type aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input
            aria-label={title}
            className="cursor-pointer truncate text-xs"
            readOnly
            value={current?.label ?? primaryFamily(value)}
          />
          <InputGroup.Suffix className="w-8">
            <ChevronsUpDown aria-hidden="true" className="size-3.5 text-muted" />
          </InputGroup.Suffix>
        </InputGroup>
      </Popover.Trigger>

      {/* 比圆角弹层宽一截：字体卡片要放大字预览，挤在窄弹层里看不出字形差异。 */}
      <Popover.Content className="w-[22rem]" placement="left">
        <div className={panelTheme} data-theme={panelTheme} style={panelThemeStyle}>
          <Popover.Dialog className="p-3">
            {mode === 'preset' ? (
              <>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-xs font-medium text-foreground">{title}</p>
                    <p className="text-xs leading-relaxed text-muted">{description}</p>
                  </div>
                  <Button className="shrink-0" onPress={() => setMode('custom')} size="sm" variant="ghost">
                    <Plus className="size-3.5" />
                    CDN
                  </Button>
                </div>

                <ScrollShadow className="max-h-64" hideScrollBar={false} size={16}>
                  <ListBox
                    aria-label={title}
                    className="grid grid-cols-2 gap-2 p-0"
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
                    {entries.map((entry) => (
                      <ListBox.Item
                        className="group relative flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-border data-[hovered=true]:bg-default data-[selected=true]:border-foreground"
                        id={entry.id}
                        key={entry.id}
                        textValue={entry.label}
                      >
                        <span className="text-2xl leading-none text-foreground" style={{ fontFamily: entry.value }}>
                          Ag 中文
                        </span>
                        <span className="max-w-full truncate px-2 text-[10px] text-muted group-data-[selected=true]:text-foreground">
                          {entry.label}
                        </span>

                        {entry.removable && (
                          <Tooltip closeDelay={80} delay={200}>
                            <Tooltip.Trigger className="absolute end-1 top-1">
                              <Button
                                aria-label={`移除 ${entry.label}`}
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
                              <p className="text-xs">移除这个字体</p>
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </ScrollShadow>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  className="w-fit px-1"
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

                <TextField
                  isInvalid={Boolean(errorMessage)}
                  value={url}
                  onChange={(next) => {
                    setUrl(next)
                    setImportError(null)
                  }}
                >
                  <Label className="text-xs font-medium text-foreground">字体样式表地址</Label>
                  <InputGroup variant="secondary">
                    <InputGroup.Prefix>
                      <Globe aria-hidden="true" className="size-3.5 text-muted" />
                    </InputGroup.Prefix>
                    <InputGroup.Input className="text-xs" placeholder="https://fonts.googleapis.com/css2?family=..." />
                  </InputGroup>
                  <Description className="text-xs leading-relaxed text-muted">
                    支持 Google Fonts、Fontsource、Fontshare、Bunny Fonts，也可以直接填 .woff2 地址。
                  </Description>
                  {errorMessage && <FieldError className="text-xs">{errorMessage}</FieldError>}
                </TextField>

                <Button
                  className="w-full"
                  isDisabled={!url.trim() || Boolean(validation)}
                  onPress={handleImport}
                  size="sm"
                  variant="secondary"
                >
                  导入字体
                </Button>
              </div>
            )}
          </Popover.Dialog>
        </div>
      </Popover.Content>
    </Popover>
  )
}
