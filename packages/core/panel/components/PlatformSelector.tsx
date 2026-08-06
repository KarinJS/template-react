import { Card, Description, Label, ListBox, ScrollShadow, Tabs } from '@heroui/react'
import { useMemo, type Key } from 'react'

import type { TemplateMeta } from '../types'

/** 板块模板选择卡片的属性。 */
interface PlatformSelectorProps {
  /** 沙盒自动注册的全部模板。 */
  templates: TemplateMeta[]
  /** 当前选中的模板路由。 */
  selectedPath?: string
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

/** 板块选择卡片：按板块分组展示模板，切换板块时自动选中该组第一个模板。 */
export const PlatformSelector = ({ templates, selectedPath, onSelect }: PlatformSelectorProps) => {
  const groups = useMemo(() => groupTemplates(templates), [templates])
  const groupEntries = Object.entries(groups)
  const selectedGroup = selectedPath?.split('/')[0]
  // 当前选中模板所属板块失效时（例如热更新后模板被删），回落到第一个板块。
  const activeGroup = groupEntries.some(([group]) => group === selectedGroup) ? (selectedGroup ?? 'root') : (groupEntries[0]?.[0] ?? 'root')

  /** 切换板块 Tab 时直接选中该组第一个模板，避免空预览。 */
  const handleGroupChange = (key: Key) => {
    const group = String(key)
    const firstTemplate = groups[group]?.[0]
    if (firstTemplate && firstTemplate.path !== selectedPath) {
      onSelect(firstTemplate.path)
    }
  }

  return (
    <Card className="w-full border border-border shadow-none" variant="default">
      <Card.Content className="space-y-4">
        {groupEntries.length > 0 ? (
          <Tabs selectedKey={activeGroup} variant="primary" onSelectionChange={handleGroupChange}>
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
              <Tabs.Panel key={group} className="pt-3" id={group}>
                <Label className="mb-2 block px-0.5 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">模板</Label>

                <ScrollShadow className="max-h-[calc(100vh-26rem)] pe-1" hideScrollBar size={48}>
                  <ListBox
                    aria-label={`${group} 模板列表`}
                    selectedKeys={selectedPath ? new Set([selectedPath]) : new Set()}
                    selectionMode="single"
                    onSelectionChange={(keys) => {
                      const key = Array.from(keys as Set<Key>)[0]
                      if (typeof key === 'string') {
                        onSelect(key)
                      }
                    }}
                  >
                    {items.map((template) => (
                      <ListBox.Item
                        key={template.path}
                        className="px-3 py-2.5"
                        id={template.path}
                        textValue={template.name ?? template.path}
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
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
          <Description className="px-0.5 pt-4 text-xs text-muted">等待模板注册</Description>
        )}
      </Card.Content>
    </Card>
  )
}
