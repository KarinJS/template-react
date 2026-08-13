/**
 * 构建插件入口（`@karinjs/template-react/plugin`）。
 *
 * 只在下游的 vite/tsdown 打包配置里使用，属于构建期代码；
 * 与主入口分开是刻意的：主入口会被下游打包进生产产物，
 * 而插件依赖 Vite 子树，混进去会变成产物目录里的死 chunk。
 */
export { ktrBuildPlugin, type KtrBuildPluginOptions } from './build/plugin'
