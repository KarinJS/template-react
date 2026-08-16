import { Accordions, Accordion } from 'fumadocs-ui/components/accordion'
import { Callout } from 'fumadocs-ui/components/callout'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { File, Files, Folder } from 'fumadocs-ui/components/files'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { createFileSystemGeneratorCache, createGenerator } from 'fumadocs-typescript'
import { AutoTypeTable, type AutoTypeTableProps } from 'fumadocs-typescript/ui'
import { Popup, PopupContent, PopupTrigger } from 'fumadocs-twoslash/ui'
import type { MDXComponents } from 'mdx/types'

// 常用组件全局注册，文档作者无需在 MDX 里逐个 import
// 类型表生成器：从 packages/core 源码的 JSDoc 自动生成 API 字段表，缓存到 .next 避免重复解析
const typeTableGenerator = createGenerator({
  cache: createFileSystemGeneratorCache('.next/fumadocs-typescript')
})

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout,
    Card,
    Cards,
    File,
    Files,
    Folder,
    Step,
    Steps,
    Tab,
    Tabs,
    Accordions,
    Accordion,
    // 自动类型表（RSC，仅服务端渲染可用）
    AutoTypeTable: (props: Partial<AutoTypeTableProps>) => <AutoTypeTable generator={typeTableGenerator} {...props} />,
    // Twoslash 类型悬浮弹窗三件套
    Popup,
    PopupContent,
    PopupTrigger,
    ...components
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
