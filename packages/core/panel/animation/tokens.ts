import gsap from 'gsap'

/**
 * 面板动效 token：所有 GSAP 调用只引用这里的常量，禁止散落魔法数。
 * 时长刻度遵循交互预算：按压反馈 120ms、微交互 180ms、布局级 260–350ms。
 */
export const duration = {
  /** 按压、hover 等即时反馈。 */
  press: 0.12,
  /** 小元素入场、徽章、提示浮层。 */
  micro: 0.18,
  /** 画布缩放收定、列表指示条滑动。 */
  settle: 0.26,
  /** 抽屉开合等布局级动画。 */
  layout: 0.35,
  /** 适应画布：内容位置/比例同时变化，给足落位时间才不显愣。 */
  fit: 0.45
} as const

export const ease = {
  /** 标准入场/收定：expo.out 的 GSAP 表达，起步快、收尾稳。 */
  out: 'expo.out',
  /** 连续输入追随（滚轮缩放）和惯性：起步更软的 power3.out，没有 expo 的冲劲。 */
  soft: 'power3.out',
  /** 抽屉等对称往返动画。 */
  inOut: 'power3.inOut',
  /** 退场，略快且不带回弹。 */
  exit: 'power2.in'
} as const

/** 当前系统是否要求减少动态效果；每次调用实时读取，跟随系统设置变化。 */
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 按 reduced-motion 折算实际时长：减少动态时归零，调用方无需分支。 */
export const motionDuration = (seconds: number) => (prefersReducedMotion() ? 0 : seconds)

gsap.defaults({ ease: ease.out, duration: duration.micro })
