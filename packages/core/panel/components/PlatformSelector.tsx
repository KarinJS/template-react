import { Description, Label, ListBox, ProgressBar, ScrollShadow, Skeleton, Tabs } from '@heroui/react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { useEffect, useLayoutEffect, useMemo, useRef, type Key } from 'react'

import { duration, ease, motionDuration } from '../animation/tokens'
import type { RegisterProgress, TemplateMeta } from '../types'

gsap.registerPlugin(Flip)

/** 共享激活指示的 Flip 标识：任一时刻只有选中项渲染它，Flip 据此在选中变化时迁移位置。 */
const activeIndicatorFlipId = 'ktr-template-active'

/** 侧边栏分区标题的统一外观：小号大写字距标签。 */
export const sidebarSectionLabelClass = 'text-[10px] font-semibold tracking-[0.18em] text-muted uppercase'

/** 板块模板选择分区的属性。 */
interface PlatformSelectorProps {
  /** 沙盒自动注册的全部模板。 */
  templates: TemplateMeta[]
  /** 当前选中的模板路由。 */
  selectedPath?: string
  /** 约定模板的注册进度，沙盒每注册完一个模块推一次；尚未开始时为 null。 */
  registerProgress?: RegisterProgress | null
  /** 选择模板回调，参数为模板约定路由。 */
  onSelect: (path: string) => void
}

/** 按路由第一段（板块）把模板分组，供 Tabs 展示。 */
const groupTemplates = (templates: TemplateMeta[]) =>
  templates.reduce<Record<string, TemplateMeta[]>>((acc, template) => {
    const [group = 'root'] = template.path.split('/')
    acc[group] ??= []
    acc[group].push(template)
    return acc
  }, {})

/** 模板分区：板块分段切换 + 扁平模板列表，切换板块时自动选中该组第一个模板。 */
export const PlatformSelector = ({ templates, selectedPath, registerProgress, onSelect }: PlatformSelectorProps) => {
  const groups = useMemo(() => groupTemplates(templates), [templates])
  const groupEntries = Object.entries(groups)
  const selectedGroup = selectedPath?.split('/')[0]
  // 当前选中模板所属板块失效时（例如热更新后模板被删），回落到第一个板块。
  const activeGroup = groupEntries.some(([group]) => group === selectedGroup) ? (selectedGroup ?? 'root') : (groupEntries[0]?.[0] ?? 'root')
  /** 列表作用域：Flip 查询和入场动画都只在这个范围内找元素，避免误伤面板其他部分。 */
  const listScopeRef = useRef<HTMLDivElement | null>(null)
  /** 选中变化发起时捕获的指示元素位置快照，DOM 提交后由 Flip 接力补间。 */
  const flipStateRef = useRef<Flip.FlipState | null>(null)
  /** 注册完成后的列表入场动画只播一次。 */
  const entrancePlayedRef = useRef(false)

  // 共享激活指示迁移：选择发起处已快照旧位置，这里在 DOM 提交后从新位置反向补间。
  // reduced-motion 下 motionDuration 归零，Flip 直接落到新位置即瞬移。
  useLayoutEffect(() => {
    const state = flipStateRef.current
    flipStateRef.current = null
    const indicator = listScopeRef.current?.querySelector(`[data-flip-id="${activeIndicatorFlipId}"]`)
    if (!state || !indicator) {
      return
    }
    const tween = Flip.from(state, { targets: indicator, duration: motionDuration(duration.micro), ease: ease.out })
    return () => {
      tween.kill()
    }
  }, [selectedPath])

  // 注册完成后的首次列表入场：条目依次轻微上浮淡入，只播一次。
  useEffect(() => {
    if (entrancePlayedRef.current || templates.length === 0 || !listScopeRef.current) {
      return
    }
    entrancePlayedRef.current = true
    const items = listScopeRef.current.querySelectorAll('[data-slot="list-box-item"]')
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: motionDuration(duration.micro), ease: ease.out, stagger: 0.03, clearProps: 'opacity,transform' }
    )
    return () => {
      tween.kill()
    }
  }, [templates])

  /**
   * 选中变化发起处统一快照指示元素位置（点击列表项、切换板块两个入口）。
   * 快照必须在 onSelect 触发重渲染之前做，之后 DOM 已迁移、Flip 拿不到旧位置。
   */
  const captureIndicatorState = (nextPath: string) => {
    if (nextPath === selectedPath) {
      return
    }
    const indicator = listScopeRef.current?.querySelector(`[data-flip-id="${activeIndicatorFlipId}"]`)
    flipStateRef.current = indicator ? Flip.getState(indicator) : null
  }

  /** 切换板块 Tab 时直接选中该组第一个模板，避免空预览。 */
  const handleGroupChange = (key: Key) => {
    const group = String(key)
    const firstTemplate = groups[group]?.[0]
    if (firstTemplate && firstTemplate.path !== selectedPath) {
      captureIndicatorState(firstTemplate.path)
      onSelect(firstTemplate.path)
    }
  }

  return (
    <div ref={listScopeRef} className="flex flex-col">
      <div className="flex items-baseline justify-between px-1">
        <Label className={sidebarSectionLabelClass}>模板</Label>
        {templates.length > 0 && <span className="text-[10px] text-muted tabular-nums">{templates.length} 个</span>}
      </div>

      {groupEntries.length > 0 ? (
        <Tabs className="mt-2.5" selectedKey={activeGroup} variant="primary" onSelectionChange={handleGroupChange}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="模板分组" className="w-full *:flex-1 *:justify-center *:px-3 *:py-2 *:text-xs *:font-medium">
              {groupEntries.map(([group]) => (
                <Tabs.Tab key={group} id={group}>
                  {group}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {groupEntries.map(([group, items]) => (
            <Tabs.Panel key={group} className="pt-2" id={group}>
              <ScrollShadow className="max-h-[calc(100vh-24rem)]" hideScrollBar size={48}>
                <ListBox
                  aria-label={`${group} 模板列表`}
                  selectedKeys={selectedPath ? new Set([selectedPath]) : new Set()}
                  selectionMode="single"
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys as Set<Key>)[0]
                    if (typeof key === 'string') {
                      captureIndicatorState(key)
                      onSelect(key)
                    }
                  }}
                >
                  {items.map((template) => (
                    <ListBox.Item
                      key={template.path}
                      className="rounded-xl px-2.5 py-2"
                      id={template.path}
                      textValue={template.name ?? template.path}
                    >
                      {/* 共享激活指示：只有选中项渲染这个底色块，选中变化时由 Flip 迁移过去。 */}
                      {template.path === selectedPath && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-xl bg-default"
                          data-flip-id={activeIndicatorFlipId}
                        />
                      )}
                      <div className="relative flex min-w-0 flex-1 flex-col">
                        <Label className="truncate text-sm font-medium text-foreground">
                          {template.name ?? template.path.split('/').at(-1)}
                        </Label>
                        <Description className="truncate text-xs text-muted">{template.description ?? template.path}</Description>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </ScrollShadow>
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <div className="mt-2.5 space-y-1" aria-busy="true" aria-label="模板注册中">
          {/* 注册期占位：骨架条目对齐真实列表项的两行结构（名称 + 描述）。 */}
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5 px-2.5 py-2">
              <Skeleton className="h-3.5 w-2/5 rounded-md" />
              <Skeleton className="h-3 w-4/5 rounded-md" />
            </div>
          ))}
          {/* 模板注册进度：总数未定（约定扫描尚未返回）时走不定态，一旦拿到总数立即转百分比。 */}
          <ProgressBar
            aria-label="模板注册进度"
            className="w-full px-1 pt-1"
            color="accent"
            isIndeterminate={!registerProgress || registerProgress.total === 0}
            size="sm"
            value={registerProgress ? (registerProgress.loaded / registerProgress.total) * 100 : 0}
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <Description className="px-1 pt-1 text-xs text-muted">
            {registerProgress && registerProgress.total > 0
              ? `正在注册模板 ${registerProgress.loaded}/${registerProgress.total} · ${registerProgress.path}`
              : '等待模板注册'}
          </Description>
        </div>
      )}
    </div>
  )
}
