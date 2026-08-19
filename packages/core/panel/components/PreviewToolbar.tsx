import { Breadcrumbs, Button, ButtonGroup, Toolbar } from '@heroui/react'
import { Brush, Camera, Crosshair, Maximize2, RefreshCw } from 'lucide-react'

/** 预览区顶部工具条的属性。 */
interface PreviewToolbarProps {
  /** 当前模板路由的面包屑分段（板块/模板逐段）。 */
  templateParts: string[]
  /** 状态行全文：模板描述或渲染状态，附带数据文件、面板与模板主题摘要。 */
  statusLine: string
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

/** 预览区顶部条：面包屑 + 状态行 + 重载/适应/截图/定位/模板主题按钮组。 */
export const PreviewToolbar = ({
  templateParts,
  statusLine,
  inspectMode,
  themeBuilderOpen,
  onReload,
  onFit,
  onCaptureScreenshot,
  onToggleInspect,
  onToggleThemeBuilder
}: PreviewToolbarProps) => (
  <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
    <div className="flex w-full min-w-0 items-center justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="overflow-hidden">
          <Breadcrumbs isDisabled className="gap-1 text-sm text-muted">
            <Breadcrumbs.Item href="#">templates</Breadcrumbs.Item>
            {templateParts.map((part, index) => (
              <Breadcrumbs.Item key={`${part}-${index}`} href="#">
                {part}
              </Breadcrumbs.Item>
            ))}
          </Breadcrumbs>
        </div>
        <div className="mt-1 truncate text-[11px] leading-tight text-muted">{statusLine}</div>
      </div>

      <Toolbar aria-label="预览操作" className="shrink-0 gap-1 rounded-xl border border-border bg-surface p-1" isAttached>
        <ButtonGroup size="sm" variant="secondary">
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

        <Button onPress={onToggleInspect} size="sm" variant={inspectMode ? 'primary' : 'secondary'}>
          <Crosshair size={16} />
          定位
        </Button>

        <Button onPress={onToggleThemeBuilder} size="sm" variant={themeBuilderOpen ? 'primary' : 'secondary'}>
          <Brush size={16} />
          模板主题
        </Button>
      </Toolbar>
    </div>
  </div>
)
