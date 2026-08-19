export default {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  printWidth: 140,
  trailingComma: 'none',
  organizeImports: true,
  // release-please 生成的更新日志不参与格式化，避免每次 format 都产生无关 diff。
  ignorePatterns: ['**/CHANGELOG.md']
}
