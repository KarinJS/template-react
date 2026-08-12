import fs from 'node:fs'
import path from 'node:path'

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'

import { ensureTemplateRegistry, templateRegistryPath } from '../conventions/registry'
import { capturedDataFileName } from '../runtime/capture'
import type { ResolvedKtrConfig } from '../types'
import { handleDataStream } from './data-watch'

/**
 * 判断 JSON 内容是否是 captured.json 的 { data, ctx } 完整快照形状。
 * @param value 解析后的 JSON 内容。
 * @returns 是捕获快照时返回 true。
 */
const isCaptureSnapshot = (value: unknown): value is { data: unknown; ctx: Record<string, unknown> } => {
  return typeof value === 'object' && value !== null && 'data' in value && 'ctx' in value
}

/**
 * 统一输出 JSON 响应，避免每个分支重复设置响应头。
 * @param res HTTP 响应对象。
 * @param status HTTP 状态码。
 * @param data 要序列化成 JSON 的响应体。
 * @returns 无返回值。
 */
const json = (res: ServerResponse, status: number, data: unknown): void => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

/**
 * 读取请求体全文，供 PUT 分支解析 JSON。
 * @param req HTTP 请求对象。
 * @returns 请求体字符串。
 */
const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })

/**
 * 校验模板路由，防止通过 ..、反斜杠或盘符访问项目外文件。
 * @param templatePath URL 中传入的模板路由，例如 hello/card。
 * @returns 按 / 拆分后的安全路径段。
 */
const assertSafeTemplatePath = (templatePath: string | null): string[] => {
  if (!templatePath) {
    throw new Error('Missing template path')
  }

  const segments = templatePath.split('/').filter(Boolean)
  // 路径穿越防护：逐段拒绝 .、.. 以及反斜杠、盘符，保证拼接结果始终落在 mock 目录内。
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..' || /[\\:]/.test(segment))) {
    throw new Error('Unsafe template path')
  }

  return segments
}

/**
 * 校验 mock 数据文件名，只允许当前模板目录内的文件。
 * @param name URL 中传入的数据名，可带或不带 .json 后缀。
 * @returns 通过校验的数据名。
 */
const assertSafeName = (name: string | null): string => {
  if (!name) {
    throw new Error('Missing data name')
  }

  // 文件名不允许出现路径分隔符和 ..，避免跳出当前模板目录。
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Unsafe data name')
  }

  return name
}

/**
 * 计算模板对应的 mock 数据目录，路径段已做穿越防护。
 * @param config 已解析的 ktr 配置。
 * @param templatePath 模板路由。
 * @returns 模板数据目录的绝对路径。
 */
const templateDataDir = (config: ResolvedKtrConfig, templatePath: string): string =>
  // JSON mock 统一收在各模板目录的 data/ 子目录中。
  path.join(config.mockDataDir, ...assertSafeTemplatePath(templatePath), 'data')

/**
 * 按约定查找与模板同名的 TypeScript mock 文件。
 * @param config 已解析的 ktr 配置。
 * @param templatePath 模板路由。
 * @returns 按优先级排列的候选 mock 文件路径。
 */
const mockModulePaths = (config: ResolvedKtrConfig, templatePath: string): string[] => {
  const segments = assertSafeTemplatePath(templatePath)
  // TS mock 与模板同目录共置，文件名固定为 mock.ts（App Router 式强约定）。
  const baseDir = path.join(config.mockDataDir, ...segments)
  return [path.join(baseDir, 'mock.ts'), path.join(baseDir, 'mock.tsx'), path.join(baseDir, 'mock.js'), path.join(baseDir, 'mock.jsx')]
}

/**
 * JSON 数据默认优先展示 default.json，其余按文件名倒序展示。
 * @param dir 模板数据目录。
 * @returns 目录内可用于面板的 JSON 文件名列表。
 */
const jsonFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return []
  }

  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'))
  const defaultFile = files.find((file) => file === 'default.json')
  // oxlint-disable-next-line unicorn/no-array-sort -- Sort a fresh filtered array for Node 18 compatibility.
  const otherFiles = files.filter((file) => file !== 'default.json').sort((left, right) => right.localeCompare(left))
  return defaultFile ? [defaultFile, ...otherFiles] : otherFiles
}

/**
 * 支持 URL 中传 name=foo 时自动解析到 foo.json。
 * @param dir 模板数据目录。
 * @param name 面板传入的数据名。
 * @returns 对应的 JSON 文件路径。
 */
const jsonFilePath = (dir: string, name: string): string => {
  const directPath = path.join(dir, name)
  if (fs.existsSync(directPath)) {
    return directPath
  }

  return path.join(dir, name.endsWith('.json') ? name : `${name}.json`)
}

/**
 * 通过 Vite SSR 加载 TS mock，让开发期类型 mock 可以即时生效。
 * @param server Vite 开发服务器，用来按需编译 TS 模块。
 * @param config 已解析的 ktr 配置。
 * @param templatePath 模板路由。
 * @returns mock 名称和数据的列表。
 */
const loadTsMocks = async (
  server: ViteDevServer,
  config: ResolvedKtrConfig,
  templatePath: string
): Promise<Array<{ name: string; data: unknown }>> => {
  const filePath = mockModulePaths(config, templatePath).find((item) => fs.existsSync(item))
  if (!filePath) {
    return []
  }

  // ssrLoadModule 走 Vite 按需编译管线，/@fs/ 前缀让绝对路径模块也能加载，源文件保存后下次请求自动拿到最新结果。
  const mod = (await server.ssrLoadModule(`/@fs/${filePath.replace(/\\/g, '/')}`)) as Record<string, unknown>
  // default 导出只用于兼容模块规范，不作为 mock 数据暴露给面板。
  return Object.entries(mod)
    .filter(([name]) => name !== 'default')
    .map(([name, data]) => ({ name, data }))
}

/**
 * 从自动注册表读取模板清单，供面板侧边栏展示。
 * @param server Vite 开发服务器，用来加载 .ktr 注册表模块。
 * @param config 已解析的 ktr 配置。
 * @returns 模板路由及其展示信息。
 */
const loadTemplates = async (
  server: ViteDevServer,
  config: ResolvedKtrConfig
): Promise<Array<{ path: string; name?: string; description?: string }>> => {
  // 模板列表接口每次读取前都刷新 .ktr，新增文件后无需手动维护注册表。
  await ensureTemplateRegistry(config)
  const registryPath = templateRegistryPath(config)
  if (!fs.existsSync(registryPath)) {
    return []
  }

  const mod = (await server.ssrLoadModule(`/@fs/${registryPath.replace(/\\/g, '/')}`)) as {
    templates?: Record<string, { name?: string; description?: string }>
  }
  return Object.entries(mod.templates ?? {}).map(([templatePath, def]) => {
    const item: { path: string; name?: string; description?: string } = { path: templatePath }
    if (def.name) {
      item.name = def.name
    }
    if (def.description) {
      item.description = def.description
    }
    return item
  })
}

type NextFunction = (error?: unknown) => void

const handleMockApiRequest = async (
  server: ViteDevServer,
  config: ResolvedKtrConfig,
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction
): Promise<void> => {
  if (!req.url) {
    next()
    return
  }

  try {
    const url = new URL(req.url, 'http://ktr.local')
    const method = req.method ?? 'GET'
    const pathname = url.pathname.replace(/^\/__ktr\/api/, '') || '/'

    if (method === 'GET' && pathname === '/templates') {
      json(res, 200, { templates: await loadTemplates(server, config) })
      return
    }

    if (method === 'GET' && pathname === '/stream') {
      // 数据文件变更的 SSE 长连接，面板据此无感刷新画布。
      handleDataStream(req, res)
      return
    }

    if (pathname !== '/data') {
      next()
      return
    }

    const templatePath = url.searchParams.get('path')
    const segments = assertSafeTemplatePath(templatePath)
    const normalizedPath = segments.join('/')
    const dir = templateDataDir(config, normalizedPath)

    if (method === 'GET' && !url.searchParams.has('name')) {
      // 面板列表中 JSON 可编辑，TS mock 只读；同名时读取接口会优先返回 JSON。
      const mocks = await loadTsMocks(server, config, normalizedPath)
      const entries = [
        ...jsonFiles(dir).map((name) => ({ name, source: 'json', readonly: false })),
        ...mocks.map((mock) => ({ name: mock.name, source: 'ts', readonly: true }))
      ]
      json(res, 200, { entries })
      return
    }

    const name = assertSafeName(url.searchParams.get('name'))
    const filePath = jsonFilePath(dir, name)
    const hasJsonFile = filePath.startsWith(dir) && fs.existsSync(filePath)
    const tsMock = (await loadTsMocks(server, config, normalizedPath)).find((mock) => mock.name === name)

    if (method === 'GET') {
      if (hasJsonFile) {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        // captured.json 是 { data, ctx } 完整渲染快照：解包下发，面板回放时连同 ctx 一起传给沙盒。
        if (name === capturedDataFileName && isCaptureSnapshot(parsed)) {
          json(res, 200, { name, source: 'json', readonly: false, data: parsed.data, ctx: parsed.ctx })
          return
        }
        json(res, 200, {
          name,
          source: 'json',
          readonly: false,
          data: parsed
        })
        return
      }

      if (tsMock) {
        json(res, 200, { name, source: 'ts', readonly: true, data: tsMock.data })
        return
      }

      json(res, 404, { error: 'Data entry not found' })
      return
    }

    if (method === 'PUT') {
      // TS mock 是类型安全的源码，面板只读；只有 JSON 条目或新条目允许写入。
      if (tsMock && !hasJsonFile) {
        json(res, 409, { error: 'TypeScript mock entries are read-only. Edit the source file directly.' })
        return
      }

      const body = await readBody(req)
      const data = JSON.parse(body)
      fs.mkdirSync(dir, { recursive: true })
      const filename = name.endsWith('.json') ? name : `${name}.json`
      fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2), 'utf-8')
      json(res, 200, { success: true, name: filename })
      return
    }

    if (method === 'DELETE') {
      // 只允许删除 JSON 文件；TS mock 需要用户自己修改源码。
      if (hasJsonFile) {
        fs.unlinkSync(filePath)
        json(res, 200, { success: true })
        return
      }

      if (tsMock) {
        json(res, 409, { error: 'TypeScript mock entries are read-only. Edit the source file directly.' })
        return
      }

      json(res, 404, { error: 'Data entry not found' })
      return
    }

    next()
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * 把 mock 数据 API 挂到 /__ktr/api 前缀下。
 * @param server Vite 开发服务器。
 * @param config 已解析的 ktr 配置。
 * @returns 无返回值。
 */
export const registerMockApi = (server: ViteDevServer, config: ResolvedKtrConfig): void => {
  // 提前建好 mock 根目录，首次访问列表接口也不会因为目录缺失而报错。
  fs.mkdirSync(config.mockDataDir, { recursive: true })

  server.middlewares.use('/__ktr/api', (req, res, next) => {
    void handleMockApiRequest(server, config, req, res, next)
  })
}
