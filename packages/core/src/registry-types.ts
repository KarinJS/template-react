/**
 * 模板注册表类型的增强位。
 * ktr sync 生成的 .ktr/registry-types.d.ts 会通过
 * `declare module '@karinjs/template-react/registry-types'` 向此接口注入逐路由的精确类型；
 * 未增强时为空接口，LoadedRegistry 自动退化为 AnyRegistry。
 * 单独抽成子路径导出，是为了让模块增强有一个稳定、可寻址的目标模块。
 */
export interface ProjectRegistry extends Record<never, never> {}
