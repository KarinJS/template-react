/**
 * cac 的帮助骨架（Usage/Commands/Options 等分节标题）和两个内置选项描述
 * （Display this message / Display version number）硬编码为英文，
 * 这里在渲染前统一替换为中文，与 ktr 各命令的中文描述保持一致。
 */

/** cac 帮助回调使用的分节结构（cac 未导出该类型，按 dist 声明复刻）。 */
interface HelpSection {
  title?: string
  body: string
}

/** 分节标题的完整匹配映射。 */
const SECTION_TITLES: Record<string, string> = {
  Usage: '用法',
  Commands: '命令',
  Options: '选项',
  Examples: '示例',
  'For more info, run any command with the `--help` flag': '更多用法：给命令加上 `--help` 查看详情'
}

/** 选项正文内的内置英文描述替换。 */
const OPTION_DESCRIPTIONS: Record<string, string> = {
  'Display this message': '显示帮助信息',
  'Display version number': '显示版本号'
}

/** 把 cac 生成的帮助分节本地化，返回新数组供 cac 渲染。 */
export function localizeHelpSections(sections: HelpSection[]): HelpSection[] {
  return sections.map((section) => {
    let body = section.body
    for (const [english, chinese] of Object.entries(OPTION_DESCRIPTIONS)) {
      body = body.replaceAll(english, chinese)
    }
    const title = (section.title && SECTION_TITLES[section.title]) || section.title
    return title === undefined ? { body } : { title, body }
  })
}
