import { Breadcrumbs, Button, ButtonGroup, Toolbar, Tooltip, toast } from '@heroui/react'
import { Brush, Camera, Copy, Crosshair, Maximize2, RefreshCw } from 'lucide-react'

import { frostedSurfaceClass } from '../canvas/frosted'

/** 预览区顶部工具条的属性。 */
interface PreviewToolbarProps {
  /** 当前模板路由的分段（板块/模板逐段；存储目录本身不是路径，不含在其中）。 */
  templateParts: string[]
  /** 当前模板的完整路由（如 demo/nested/article/profile），复制用；为空表示未选择模板。 */
  templatePath: string
  /** 模板描述或最近渲染状态，信息行的主文案。 */
  description: string
  /** 当前数据文件名。 */
  dataName: string
  /** 面板明暗摘要（如「浅色」「跟随系统（深色）」）。 */
  panelLabel: string
  /** 模板明暗摘要（「深色」/「浅色」）。 */
  templateLabel: string
  /** 模板主题摘要（「组件库默认」/「已自定义」）。 */
  themeLabel: string
  /** 检查模式（源码定位）是否激活。 */
  inspectMode: boolean
  /** 右侧主题构建器抽屉是否展开。 */
  themeBuilderOpen: boolean
  /** 重载当前数据并推送沙盒重渲染。 */
  onReload: () => void
  /** 画布适应缩放。 */
  onFit: () => void
  /** 截取当前画布内容。 */
  onCaptureScreenshot: () => void
  /** 切换检查模式 sticky 开关。 */
  onToggleInspect: () => void
  /** 开合主题构建器抽屉。 */
  onToggleThemeBuilder: () => void
}

/** 状态行的单个信息片：muted 标签 + 正文值，胶囊形底色与主文案拉开层级。 */
const MetaChip = ({ label, value }: { label: string; value: string }) => (
  <span className="flex shrink-0 items-center gap-1 rounded-md bg-default/70 px-1.5 py-0.5">
    <span className="text-muted">{label}</span>
    <span className="font-medium text-foreground">{value}</span>
  </span>
)

/** 预览区顶部条：面包屑（含路径复制）+ 结构化状态行 + 操作按钮组。 */
export const PreviewToolbar = ({
  templateParts,
  templatePath,
  description,
  dataName,
  panelLabel,
  templateLabel,
  themeLabel,
  inspectMode,
  themeBuilderOpen,
  onReload,
  onFit,
  onCaptureScreenshot,
  onToggleInspect,
  onToggleThemeBuilder
}: PreviewToolbarProps) => {
  /** 复制当前模板路径到剪贴板，成功后 Toast 反馈。 */
  const handleCopyPath = async () => {
    if (!templatePath) {
      return
    }
    try {
      await navigator.clipboard.writeText(templatePath)
      toast.success('复制成功', { description: `模板路径 ${templatePath} 已复制到剪贴板` })
    } catch (error) {
      console.error('复制模板路径失败:', error)
      toast.danger('复制失败', { description: '无法访问剪贴板，请检查浏览器权限' })
    }
  }

  return (
    <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0.5 overflow-hidden">
            {/* 面包屑只呈现模板路由本身：模板存储目录（dir.template）是存放位置，不是路径的一部分 */}
            <Breadcrumbs isDisabled className="gap-1 text-sm text-muted">
              {templateParts.map((part, index) => (
                <Breadcrumbs.Item key={`${part}-${index}`} href="#">
                  {part}
                </Breadcrumbs.Item>
              ))}
            </Breadcrumbs>

            <Tooltip closeDelay={80} delay={200}>
              {/* Trigger 默认渲染块级 div，显式 flex 居中才能让按钮与面包屑文字在同一中线上 */}
              <Tooltip.Trigger className="flex items-center">
                <Button
                  isIconOnly
                  aria-label="复制模板路径"
                  className="flex size-6 min-h-0 shrink-0 items-center justify-center rounded-md p-0 text-muted"
                  isDisabled={!templatePath}
                  size="sm"
                  variant="ghost"
                  onPress={() => void handleCopyPath()}
                >
                  <Copy size={12} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content showArrow>
                <Tooltip.Arrow />
                <p className="text-xs">复制模板路径</p>
              </Tooltip.Content>
            </Tooltip>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-tight">
            <span className="truncate text-foreground/80">{description}</span>
            <MetaChip label="数据" value={dataName || 'none'} />
            <MetaChip label="面板" value={panelLabel} />
            <MetaChip label="模板" value={templateLabel} />
            <MetaChip label="主题" value={themeLabel} />
          </div>
        </div>

        <Toolbar
          aria-label="预览操作"
          className={`relative shrink-0 gap-1 overflow-hidden rounded-xl p-1 ${frostedSurfaceClass}`}
          isAttached
        >
          <ButtonGroup className="relative" size="sm" variant="secondary">
            <Button onPress={onReload}>
              <RefreshCw size={16} />
              重载
            </Button>
            <Button onPress={onFit}>
              <ButtonGroup.Separator />
              <Maximize2 size={16} />
              适应
            </Button>
            <Button onPress={onCaptureScreenshot}>
              <ButtonGroup.Separator />
              <Camera size={16} />
              截图
            </Button>
          </ButtonGroup>

          <Button className="relative" onPress={onToggleInspect} size="sm" variant={inspectMode ? 'primary' : 'secondary'}>
            <Crosshair size={16} />
            定位
          </Button>

          <Button className="relative" onPress={onToggleThemeBuilder} size="sm" variant={themeBuilderOpen ? 'primary' : 'secondary'}>
            <Brush size={16} />
            模板主题
          </Button>
        </Toolbar>
      </div>
    </div>
  )
}
