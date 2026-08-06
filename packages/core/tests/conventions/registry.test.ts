import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from '../../src/config'
import { ensureTemplateRegistry, registryTypesPath } from '../../src/conventions/registry'

/** 在临时目录搭一个最小模板项目（目录式强约定），返回根目录和已解析配置。 */
const setupProject = async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ktr-conventions-'))
  const cardDir = path.join(root, 'template', 'hello', 'card')
  fs.mkdirSync(cardDir, { recursive: true })
  fs.writeFileSync(path.join(cardDir, 'index.tsx'), "export default { name: '卡片' }\n", 'utf-8')
  const config = await resolveConfig({ cwd: root })
  return { config, root }
}

describe('ensureTemplateRegistry', () => {
  it('registers <板块>/<模板>/index.tsx as the route and generates registry-types.d.ts', async () => {
    const { config } = await setupProject()

    const result = await ensureTemplateRegistry(config)
    expect(result.routes).toEqual(['hello/card'])

    const typesPath = registryTypesPath(config)
    expect(fs.existsSync(typesPath)).toBe(true)
    const content = fs.readFileSync(typesPath, 'utf-8')
    // 模块增强目标固定为 registry-types 子路径，下游 loadTemplateRegistry 才能拿到精确类型。
    expect(content).toContain("declare module '@karinjs/template-react/registry-types'")
    expect(content).toContain('interface ProjectRegistry')
    expect(content).toContain("'hello/card': typeof import('../template/hello/card/index').default")
    // export {} 让文件成为模块，保证 declare module 按模块增强处理。
    expect(content).toContain('export {}')
  })

  it('does not register bare <板块>/<模板>.tsx files under the strict convention', async () => {
    const { config, root } = await setupProject()
    // 裸写组件不符合强约定，直接不注册（项目未发布，不做迁移提示）。
    fs.writeFileSync(path.join(root, 'template', 'hello', 'legacy.tsx'), 'export default {}\n', 'utf-8')

    const result = await ensureTemplateRegistry(config)
    expect(result.routes).toEqual(['hello/card'])
  })

  it('treats components/ as an internal directory that never registers routes', async () => {
    const { config, root } = await setupProject()
    // components/ 里的子组件和普通 ts 逻辑文件都不参与路由，包括误建的 index.tsx。
    const componentsDir = path.join(root, 'template', 'hello', 'card', 'components')
    fs.mkdirSync(componentsDir, { recursive: true })
    fs.writeFileSync(path.join(componentsDir, 'badge.tsx'), 'export default {}\n', 'utf-8')
    fs.writeFileSync(path.join(componentsDir, 'index.tsx'), 'export default {}\n', 'utf-8')
    fs.writeFileSync(path.join(componentsDir, 'format.ts'), 'export const noop = () => {}\n', 'utf-8')

    const result = await ensureTemplateRegistry(config)
    expect(result.routes).toEqual(['hello/card'])
    // 类型增强文件同样不应包含 components/ 里的任何东西。
    const typesContent = fs.readFileSync(registryTypesPath(config), 'utf-8')
    expect(typesContent).not.toContain('components')
  })

  it('does not overwrite a hand-edited registry-types.d.ts', async () => {
    const { config } = await setupProject()
    const typesPath = registryTypesPath(config)
    fs.mkdirSync(path.dirname(typesPath), { recursive: true })
    fs.writeFileSync(typesPath, '// 用户手写，不应被覆盖\n', 'utf-8')

    await ensureTemplateRegistry(config)
    expect(fs.readFileSync(typesPath, 'utf-8')).toBe('// 用户手写，不应被覆盖\n')
  })
})
