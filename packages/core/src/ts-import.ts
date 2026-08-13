import { pathToFileURL } from 'node:url'

/**
 * 惰性注册一次的 tsx loader。
 *
 * 注意用 register + 原生 import 而不是 tsImport：tsx 4 的 tsImport 会给模块加
 * namespace 查询串，Windows 下相对导入会把查询串编码进文件名去查磁盘（必然 ENOENT）。
 * 注册到进程级 loader 后走 node 自己的解析，没有这个问题。
 */
let registered = false

/**
 * 加载 TS/TSX 模块（tsx 即时转译，jsx 设置跟随项目 tsconfig）。
 *
 * tsx 惰性加载：只在真的需要读 TS 文件时引入，生产产物里永远不会执行到这里，
 * 因此下游打包含 tsx 也是安全的。
 * @param filePath 模块的绝对路径。
 * @returns 模块命名空间。
 */
export const importTsModule = async <T>(filePath: string): Promise<T> => {
  if (!registered) {
    const { register } = await import('tsx/esm/api')
    register()
    registered = true
  }

  return import(pathToFileURL(filePath).href) as Promise<T>
}
