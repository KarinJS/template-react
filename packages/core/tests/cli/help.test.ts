import { describe, expect, it } from 'vitest'

import { localizeHelpSections } from '../../src/cli/help'

describe('localizeHelpSections', () => {
  it('翻译 cac 内置的分节标题和选项描述', () => {
    // 分节结构按 cac 7.0.0 的 outputHelp 生成结果模拟。
    const sections = localizeHelpSections([
      { body: 'ktr/0.1.0' },
      { title: 'Usage', body: '  $ ktr <command> [options]' },
      { title: 'Commands', body: '  dev  启动模板开发面板' },
      {
        title: 'For more info, run any command with the `--help` flag',
        body: '  $ ktr dev --help'
      },
      {
        title: 'Options',
        body: '  -h, --help  Display this message \n  -v, --version  Display version number '
      }
    ])

    expect(sections).toEqual([
      { body: 'ktr/0.1.0' },
      { title: '用法', body: '  $ ktr <command> [options]' },
      { title: '命令', body: '  dev  启动模板开发面板' },
      { title: '更多用法：给命令加上 `--help` 查看详情', body: '  $ ktr dev --help' },
      { title: '选项', body: '  -h, --help  显示帮助信息 \n  -v, --version  显示版本号 ' }
    ])
  })

  it('不改动未知的标题和正文', () => {
    expect(localizeHelpSections([{ title: '自定义', body: '保持原样' }])).toEqual([{ title: '自定义', body: '保持原样' }])
  })
})
