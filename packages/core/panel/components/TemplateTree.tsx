import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { duration } from '../animation/tokens'
import type { TemplateMeta } from '../types'

/** 共享激活指示的 Flip 标识：与 PlatformSelector 里的查询保持一致。 */
const activeIndicatorFlipId = 'ktr-template-active'

/** 模板树节点：文件夹（可无限嵌套）或模板叶子。 */
type TemplateTreeNode =
  | { type: 'folder'; segment: string; path: string; count: number; children: TemplateTreeNode[] }
  | { type: 'leaf'; template: TemplateMeta }

/**
 * 把某个板块下的模板按剩余路径段递归成树：
 * 叶子（名称/描述来自模板元数据）排在前面，文件夹按段名排序跟在后面。
 */
const buildTemplateTree = (templates: TemplateMeta[], basePath: string): TemplateTreeNode[] => {
  const leaves: TemplateTreeNode[] = []
  const folders = new Map<string, TemplateMeta[]>()

  for (const template of templates) {
    const rest = template.path.slice(basePath.length + 1).split('/')
    if (rest.length === 1) {
      leaves.push({ type: 'leaf', template })
    } else {
      const segment = rest[0]!
      const bucket = folders.get(segment) ?? []
      bucket.push(template)
      folders.set(segment, bucket)
    }
  }

  const folderNodes: TemplateTreeNode[] = Array.from(folders.entries())
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([segment, bucket]) => {
      const path = `${basePath}/${segment}`
      return {
        type: 'folder',
        segment,
        path,
        count: bucket.length,
        children: buildTemplateTree(bucket, path)
      }
    })

  return [...leaves, ...folderNodes]
}

/** 模板树的属性。 */
interface TemplateTreeProps {
  /** 当前板块名（树的第一层路径段）。 */
  group: string
  /** 当前板块下的全部模板。 */
  items: TemplateMeta[]
  /** 当前选中的模板路由。 */
  selectedPath: string | undefined
  /** 点击模板叶子的回调（父级负责 Flip 快照和路由切换）。 */
  onLeafSelect: (path: string) => void
}

/**
 * 板块内的嵌套模板树：中间路径段渲染成可折叠文件夹（缩进 + 左侧参考线），
 * 叶子是模板项；默认全部展开，选中项变化时自动展开其祖先文件夹。
 */
export const TemplateTree = ({ group, items, selectedPath, onLeafSelect }: TemplateTreeProps) => {
  const tree = useMemo(() => buildTemplateTree(items, group), [items, group])
  /** 收起的文件夹路径集合；默认全展开，用户点过的才收起。 */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  // 选中项变化时展开其全部祖先文件夹，保证选中行始终可见。
  useEffect(() => {
    if (!selectedPath) {
      return
    }
    setCollapsed((prev) => {
      if (prev.size === 0) {
        return prev
      }
      const next = new Set(prev)
      const segments = selectedPath.split('/')
      // 逐层生成祖先路径（不含叶子本身），从收起集合里移除。
      for (let index = 1; index < segments.length; index++) {
        next.delete(segments.slice(0, index).join('/'))
      }
      return next.size === prev.size ? prev : next
    })
  }, [selectedPath])

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const renderNode = (node: TemplateTreeNode, depth: number): ReactNode => {
    if (node.type === 'leaf') {
      const { template } = node
      const selected = template.path === selectedPath
      return (
        <button
          key={template.path}
          aria-selected={selected}
          className="relative flex w-full cursor-pointer items-center rounded-xl py-2 pr-2.5 text-left transition-colors duration-150 hover:bg-default/60"
          data-template-leaf
          role="treeitem"
          style={{ paddingLeft: `calc(0.625rem + ${depth * 14}px)` }}
          type="button"
          onClick={() => onLeafSelect(template.path)}
        >
          {/* 共享激活指示：只有选中项渲染这个底色块，选中变化时由 Flip 迁移过去。 */}
          {selected && (
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-default" data-flip-id={activeIndicatorFlipId} />
          )}
          <span className="relative min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{template.name ?? template.path.split('/').at(-1)}</span>
            <span className="block truncate text-xs text-muted">{template.description ?? template.path}</span>
          </span>
          {selected && <Check className="relative shrink-0 text-foreground" size={14} />}
        </button>
      )
    }

    const open = !collapsed.has(node.path)
    return (
      <div key={node.path} role="group">
        <button
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-1 rounded-lg py-1.5 pr-2.5 text-left transition-colors duration-150 hover:bg-default/60"
          style={{ paddingLeft: `calc(${depth * 14}px)` }}
          type="button"
          onClick={() => toggleFolder(node.path)}
        >
          <ChevronRight
            className="shrink-0 text-muted transition-transform duration-150"
            size={13}
            style={{ transform: open ? 'rotate(90deg)' : undefined }}
          />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{node.segment}</span>
          <span className="shrink-0 text-[10px] text-muted tabular-nums">{node.count}</span>
        </button>

        {/* grid-template-rows 0fr/1fr 过渡：纯 CSS 完成高度自适应的展开收起动画。 */}
        <div
          className="grid transition-[grid-template-rows]"
          style={{
            gridTemplateRows: open ? '1fr' : '0fr',
            transitionDuration: `${duration.micro * 1000}ms`,
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          <div className="min-h-0 overflow-hidden">
            {/* 缩进参考线：让嵌套层级在视觉上有迹可循。 */}
            <div className="ml-1.75 border-l border-border/60 pl-1" role="presentation">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5" role="tree">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  )
}
