'use client'

import { useDocsSearch } from 'fumadocs-core/search/client'
import { staticClient } from 'fumadocs-core/search/client/orama-static'
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps
} from 'fumadocs-ui/components/dialog/search'
import { create } from 'zbsearch'

// 本站是静态导出（output: 'export'）：/api/search 由 staticGET 在构建期导出为整份索引 JSON，
// 客户端必须下载索引后本地查询（type: 'static'），默认的 fetch 模式会把整份索引当查询结果解析，表现为搜不到任何内容。
// 分词必须与构建索引时的服务端保持一致（multilingual，基于 Intl.Segmenter），
// 否则中文查询会被默认的 english 分词拆成空 token。
const client = staticClient({
  initDB: () => create({ schema: { _: 'string' }, language: 'multilingual' })
})

export default function StaticSearchDialog(props: SharedProps) {
  const { search, setSearch, query } = useDocsSearch({ client })

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
      <SearchDialogFooter />
    </SearchDialog>
  )
}
