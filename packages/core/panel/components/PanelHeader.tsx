import { Button, Tooltip } from '@heroui/react'
import gsap from 'gsap'
import { useEffect, useRef, type CSSProperties } from 'react'
import { FaGithub } from 'react-icons/fa'

import { duration, ease, motionDuration } from '../animation/tokens'
import type { PanelThemePreference } from '../theme/usePanelTheme'
import { PanelThemeSelect } from './PanelThemeSelect'

/** 面板标识：frame-logo.png 吉祥物，首见时轻微弹入（delight 预算只花在首见位）。 */
const PanelLogo = () => {
  const logoRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!logoRef.current) {
      return
    }
    const tween = gsap.fromTo(
      logoRef.current,
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: motionDuration(duration.micro), ease: ease.out, clearProps: 'opacity,transform' }
    )
    return () => {
      tween.kill()
    }
  }, [])

  return <img ref={logoRef} src="/frame-logo.png" alt="Karin" className="size-9 shrink-0 rounded-lg" draggable={false} />
}

/** 侧边栏头部的属性。 */
interface PanelHeaderProps {
  /** 面板外壳明暗，用于主题切换浮层配色。 */
  panelTheme: 'light' | 'dark'
  /** 面板主题 CSS 变量，透传给主题切换浮层。 */
  panelThemeStyle: CSSProperties
  /** 面板主题偏好（浅色/深色/跟随系统）。 */
  panelThemePreference: PanelThemePreference
  /** 面板主题偏好变更回调。 */
  onPanelThemePreferenceChange: (value: PanelThemePreference) => void
}

/** 侧边栏头部：Logo + 标题双行文字 + 面板主题切换 + GitHub 入口。 */
export const PanelHeader = ({ panelTheme, panelThemeStyle, panelThemePreference, onPanelThemePreferenceChange }: PanelHeaderProps) => (
  <div className="flex min-h-16 shrink-0 items-center border-b border-border px-4 py-2">
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <PanelLogo />

        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.24em] text-muted">Karin Template React</div>
          <div className="truncate text-sm font-semibold leading-tight tracking-normal text-foreground">图片模板开发面板</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <PanelThemeSelect
          panelTheme={panelTheme}
          panelThemeStyle={panelThemeStyle}
          value={panelThemePreference}
          onChange={onPanelThemePreferenceChange}
        />

        <Tooltip closeDelay={80} delay={200}>
          <Tooltip.Trigger>
            <Button
              aria-label="在 GitHub 上查看"
              className="size-9 min-h-0 shrink-0 items-center justify-center rounded-lg p-0"
              isIconOnly
              onPress={() => window.open('https://github.com/KarinJS/karin', '_blank', 'noopener,noreferrer')}
              variant="ghost"
            >
              <FaGithub className="text-foreground h-5 w-5" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <p className="text-xs">在 GitHub 上查看</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  </div>
)
