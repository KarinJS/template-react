'use client'

import { useEffect, useState } from 'react'

import ParticleText from './particle-text'

/** 跟踪根元素的 dark 类（fumadocs 主题切换就改它），不引入额外依赖。 */
const useIsDark = (): boolean => {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains('dark'))
    update()

    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

/**
 * 主页主视觉：粒子聚合成文字。
 * 颜色跟随明暗主题（canvas 不认 currentColor，必须给具体色值）。
 * 鼠标划动只有斥力效果；散-聚重播只在点击时触发（trigger="click"），
 * 避免每次划入组件都重置动画。
 */
export const HeroParticleText = ({ text }: { text: string }) => {
  const isDark = useIsDark()

  return (
    <ParticleText
      text={text}
      color={isDark ? '#ffffff' : '#27272a'}
      highlightColor={isDark ? '#8b5cf6' : '#7c3aed'}
      particleSize={2}
      density={4}
      scatter={160}
      gatherDuration={1500}
      stagger={380}
      pointerRepel={42}
      repelRadius={130}
      idleDrift={0.8}
      trigger="click"
      fontSize="clamp(3rem, 9vw, 9rem)"
      fontWeight={800}
      glow
      style={{ height: 'clamp(240px, 24vw, 380px)' }}
    />
  )
}
