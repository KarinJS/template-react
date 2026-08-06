/** 水印开关在 localStorage 中的存储键。 */
const WATERMARK_STORAGE_KEY = 'ktr-watermark-enabled'

/** 平铺到截图上的水印文本。 */
const WATERMARK_TEXT = '开发中内容，实际内容请以正式发布为准'

/** 水印文本的旋转角度（度）。 */
const WATERMARK_ROTATE_DEG = -20

/** 应用水印时的选项。 */
export interface ApplyWatermarkOptions {
  /** 是否启用水印，关闭时原样返回输入 blob。 */
  enabled: boolean
  /** 面板明暗主题，用于决定水印文字取深灰还是浅灰。 */
  theme: 'light' | 'dark'
}

/**
 * 读取水印开关状态。
 * @returns 是否启用水印；默认关闭，只有显式开启过才铺水印
 */
export const getWatermarkEnabled = (): boolean => {
  try {
    const raw = window.localStorage.getItem(WATERMARK_STORAGE_KEY)
    return raw === 'true'
  } catch {
    // 隐私模式等场景下读取失败时按默认关闭处理
    return false
  }
}

/**
 * 把水印开关状态写入 localStorage。
 * @param enabled 是否启用水印
 */
export const setWatermarkEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(WATERMARK_STORAGE_KEY, String(enabled))
  } catch {
    // 写入失败时静默忽略，不影响本次开关生效
  }
}

/**
 * 用 canvas 在图片上平铺半透明水印文字，返回处理后的 PNG blob。
 * @param blob 原始图片 blob
 * @param options 水印选项
 * @returns 处理后的 PNG blob；未启用水印时原样返回输入 blob
 */
export const applyWatermarkToBlob = async (blob: Blob, options: ApplyWatermarkOptions): Promise<Blob> => {
  const { enabled, theme } = options
  if (!enabled) {
    return blob
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return blob
    }
    context.drawImage(image, 0, 0)
    drawTiledWatermark(context, canvas.width, canvas.height, theme)
    return await canvasToPngBlob(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * 同 applyWatermarkToBlob，但返回可直接挂到 <img> 或 a[href] 上的 Object URL。
 * @param blob 原始图片 blob
 * @param options 水印选项
 * @returns 处理后图片的 Object URL，由调用方负责 URL.revokeObjectURL
 */
export const applyWatermark = async (blob: Blob, options: ApplyWatermarkOptions): Promise<string> => {
  const watermarked = await applyWatermarkToBlob(blob, options)
  return URL.createObjectURL(watermarked)
}

/**
 * 把 Object URL 加载为图片元素。
 * @param url 图片的 Object URL
 * @returns 加载完成的图片元素
 */
const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image), { once: true })
    image.addEventListener('error', () => reject(new Error('水印处理失败：图片加载出错')), { once: true })
    image.src = url
  })

/**
 * 把 canvas 内容导出为 PNG blob。
 * @param canvas 源画布
 * @returns PNG 格式的 blob
 */
const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result)
      } else {
        reject(new Error('水印处理失败：无法导出 PNG'))
      }
    }, 'image/png')
  })

/**
 * 在画布上按固定角度平铺半透明水印文字，覆盖整个可视区域。
 * @param context 画布 2D 上下文
 * @param width 画布宽度（像素）
 * @param height 画布高度（像素）
 * @param theme 面板主题：深色面板用浅灰文字，浅色面板用深灰文字
 */
const drawTiledWatermark = (context: CanvasRenderingContext2D, width: number, height: number, theme: 'light' | 'dark'): void => {
  // 字号随图片短边缩放，保证不同尺寸截图上水印密度接近
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 24))
  context.save()
  context.font = `${fontSize}px sans-serif`
  context.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.14)'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.rotate((WATERMARK_ROTATE_DEG * Math.PI) / 180)
  // 以画布对角线为半径向外铺，保证旋转后四角也被覆盖
  const radius = Math.ceil(Math.hypot(width, height))
  const stepX = fontSize * 20
  const stepY = fontSize * 8
  for (let x = -radius; x <= radius; x += stepX) {
    for (let y = -radius; y <= radius; y += stepY) {
      context.fillText(WATERMARK_TEXT, x, y)
    }
  }
  context.restore()
}
