/** 画布左下角的操作提示浮层，纯展示，不拦截指针事件。 */
export const CanvasHints = () => (
  <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted shadow-none backdrop-blur-sm">
    滚轮缩放 · 拖拽画布 · 双击适应
  </div>
)
