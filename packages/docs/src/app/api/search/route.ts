import { source } from '@/lib/source'
import { createFromSource } from 'fumadocs-core/search/server'

// 静态导出要求搜索索引在构建期生成，staticGET 会把索引写成静态资源
export const dynamic = 'force-static'

export const { staticGET: GET } = createFromSource(source)
