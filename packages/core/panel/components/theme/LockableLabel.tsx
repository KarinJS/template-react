import { Label, Tooltip } from '@heroui/react'
import { Info, Lock, LockOpen } from 'lucide-react'

import type { LockableKnob } from '../../theme/knobs'

/** 带锁和说明提示的表单标签。 */
interface LockableLabelProps {
  /** 标签文字。 */
  label: string
  /** 对应的旋钮键，锁定后随机化时会跳过它。 */
  knob: LockableKnob
  /** 可选的说明文案，显示在信息图标的提示里。 */
  tooltip?: string
  /** 当前是否已锁定。 */
  isLocked: boolean
  /** 切换锁定状态。 */
  onToggleLock: (knob: LockableKnob) => void
}

/**
 * 表单控件的标签行：文字 + 可选说明提示 + 锁定按钮。
 * 锁只影响「随机配色」，被锁的项仍可手动调整——语义是「随机时别动它」。
 */
export const LockableLabel = ({ label, knob, tooltip, isLocked, onToggleLock }: LockableLabelProps) => (
  <div className="group flex h-6 items-center gap-1">
    <Label className="text-xs font-medium text-foreground">{label}</Label>

    {tooltip && (
      <Tooltip closeDelay={80} delay={150}>
        <Tooltip.Trigger>
          <Info aria-label={`${label}说明`} className="size-3.5 shrink-0 text-muted" tabIndex={0} />
        </Tooltip.Trigger>
        <Tooltip.Content showArrow className="max-w-56">
          <Tooltip.Arrow />
          <p className="text-xs leading-relaxed">{tooltip}</p>
        </Tooltip.Content>
      </Tooltip>
    )}

    <Tooltip closeDelay={80} delay={150}>
      <Tooltip.Trigger>
        {/* 平时隐藏，hover 标签行或已锁定时显现，避免一排锁图标干扰视线。 */}
        <button
          aria-label={isLocked ? `解锁${label}数值` : `锁定${label}数值`}
          aria-pressed={isLocked}
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:bg-default focus-visible:text-foreground ${
            isLocked ? 'text-foreground' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
          onClick={() => onToggleLock(knob)}
          type="button"
        >
          {isLocked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <p className="text-xs">{isLocked ? '已锁定数值' : '锁定数值'}</p>
      </Tooltip.Content>
    </Tooltip>
  </div>
)
