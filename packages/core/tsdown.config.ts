import { defineConfig } from 'tsdown'

import { scaffoldExamplesPlugin } from './build/scaffold-examples.ts'

export default defineConfig({
  entry: {
    client: 'src/client.ts',
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    'registry-types': 'src/registry-types.ts'
  },
  // 示例模板在构建时从 examples/ 扫描注入（虚拟模块，无签入生成物）。
  plugins: [scaffoldExamplesPlugin()],
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  dts: true,
  clean: true,
  sourcemap: false,
  deps: {
    // 纯 JS 的小工具包全部内联进产物，让发布包的 dependencies 只剩运行引擎（vite/tailwind）；
    // 这些包同时只声明在 devDependencies，下游安装时根本不会出现。
    // jiti 不能内联：它按 import.meta.url 相对路径 require 自己包里的 babel 变换文件。
    alwaysBundle: ['@clack/prompts', 'cac', 'chokidar', 'consola', 'defu', 'fast-glob'],
    neverBundle: ['react', 'react-dom', 'react-dom/server', '@karinjs/template-react/registry-types'],
    onlyBundle: false
  },
  outDir: 'dist',
  treeshake: true,
  // 固定 ESM 扩展名为 .mjs/.d.mts，与 package.json 的 exports 映射保持一致，不随入口增减漂移。
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' })
})
