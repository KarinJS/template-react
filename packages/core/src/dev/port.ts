import { execFile } from 'node:child_process'
import net from 'node:net'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 占用端口的进程信息。 */
export interface PortHolder {
  /** 进程 ID。 */
  pid: number
  /** 进程名，查询失败时缺省。 */
  name?: string
}

/**
 * 探测端口是否已被占用。
 * @param port 待探测端口。
 * @param host 监听主机，与 dev server 保持一致。
 * @returns 端口已被占用时返回 true。
 */
export const isPortInUse = (port: number, host?: string): Promise<boolean> =>
  new Promise((resolve) => {
    const targets: (string | undefined)[] = []
    if (host === 'localhost') {
      targets.push(undefined, '::1')
    } else if (host && host !== '0.0.0.0' && host !== '::') {
      targets.push(host)
    } else {
      targets.push(undefined)
    }

    let index = 0
    const tryTarget = (): void => {
      const socket = net.createServer()
      const cleanup = (done: () => void): void => {
        socket.removeAllListeners()
        socket.close(() => done())
      }
      socket.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          cleanup(() => resolve(true))
          return
        }
        index += 1
        if (index < targets.length) {
          cleanup(tryTarget)
        } else {
          cleanup(() => resolve(false))
        }
      })
      socket.once('listening', () => {
        index += 1
        if (index < targets.length) {
          cleanup(tryTarget)
        } else {
          cleanup(() => resolve(false))
        }
      })
      socket.listen(port, targets[index])
    }

    tryTarget()
  })

/**
 * 按 PID 查询进程名，用于让提示更可读。
 * @param pid 进程 ID。
 * @returns 进程名，查询失败时返回 undefined。
 */
const processName = async (pid: number): Promise<string | undefined> => {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'])
    return stdout.match(/^"([^"]+)"/m)?.[1]
  } catch {
    return undefined
  }
}

/**
 * 查询占用指定端口的进程，Windows 走 netstat，类 Unix 走 lsof。
 * @param port 被占用的端口。
 * @returns 占用该端口的进程列表，查询失败时返回空数组。
 */
export const findPortHolders = async (port: number): Promise<PortHolder[]> => {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano'])
      const pids = new Set<number>()
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue
        const columns = line.trim().split(/\s+/)
        if (!(columns[1] ?? '').endsWith(`:${port}`)) continue
        const pid = Number(columns.at(-1))
        if (Number.isInteger(pid) && pid > 0) {
          pids.add(pid)
        }
      }
      return await Promise.all(
        Array.from(pids).map(async (pid) => {
          const name = await processName(pid)
          return name ? { pid, name } : { pid }
        })
      )
    }

    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-F', 'pc'])
    const holders: PortHolder[] = []
    let current: PortHolder | null = null
    for (const line of stdout.split(/\r?\n/)) {
      if (line.startsWith('p')) {
        const pid = Number(line.slice(1))
        if (Number.isInteger(pid) && pid > 0) {
          current = { pid }
          holders.push(current)
        }
      } else if (line.startsWith('c') && current) {
        current.name = line.slice(1)
      }
    }
    return holders
  } catch {
    return []
  }
}

/**
 * 生成当前平台下终止占用进程的命令。
 * @param port 被占用的端口。
 * @param holders 占用该端口的进程列表。
 * @returns 可直接复制执行的命令列表。
 */
export const killCommands = (port: number, holders: PortHolder[]): string[] => {
  if (process.platform === 'win32') {
    if (holders.length > 0) {
      return [`taskkill /F ${holders.map((holder) => `/PID ${holder.pid}`).join(' ')}`]
    }
    return [`netstat -ano | findstr :${port}`, 'taskkill /F /PID <上一步最后一列的 PID>']
  }
  if (holders.length > 0) {
    return [`kill -9 ${holders.map((holder) => holder.pid).join(' ')}`]
  }
  return [`lsof -ti tcp:${port} | xargs kill -9`]
}
