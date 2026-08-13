import type { DeepDemoData } from './index'

/** 深层目录示例的 TS mock，用来验证嵌套路由和异步组件。 */
export const asyncCase = {
  title: '异步模板',
  message: '这个模板验证嵌套注册路由可以通过 React 服务端渲染正常出图。',
  tags: ['嵌套', '异步', '示例']
} satisfies DeepDemoData
