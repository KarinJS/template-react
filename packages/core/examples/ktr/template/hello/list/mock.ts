import type { HelloListData } from './index'

/** 列表示例的 TS mock，适合在插件代码里直接复用类型安全的数据。 */
export const team = {
  title: '模板贡献榜',
  users: [
    { name: '林小满', role: '模板作者', score: 98 },
    { name: '沈括', role: '插件维护者', score: 92 },
    { name: '苏晚晴', role: '设计评审', score: 89 }
  ]
} satisfies HelloListData
