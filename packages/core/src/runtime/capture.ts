import fs from 'node:fs'
import path from 'node:path'

/** 捕获数据的固定文件名，每次捕获滚动覆盖同一个文件。 */
export const capturedDataFileName = 'captured.json'

const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/** 捕获目录按模板路由展开到 data/ 子目录，与 JSON mock 的数据目录约定一致。 */
const templateCaptureDir = (captureDir: string, templatePath: string): string => path.join(captureDir, ...templatePath.split('/'), 'data')

/**
 * 保存一次真实渲染数据，滚动覆盖模板目录下的 captured.json。
 * @param captureDir 捕获根目录。
 * @param templatePath 模板路由。
 * @param data 本次渲染使用的数据。
 * @returns 捕获是否成功。
 */
export const saveCapturedData = (captureDir: string, templatePath: string, data: unknown): boolean => {
  try {
    const dir = templateCaptureDir(captureDir, templatePath)
    ensureDir(dir)

    // 固定写入 captured.json，每次捕获直接覆盖旧数据，不再保留历史版本。
    fs.writeFileSync(path.join(dir, capturedDataFileName), JSON.stringify(data, null, 2), 'utf-8')

    return true
  } catch (error) {
    // 捕获失败只告警，不中断渲染主流程。
    console.warn(`[ktr] failed to capture data for ${templatePath}`, error)
    return false
  }
}
