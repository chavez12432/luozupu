/**
 * 同时启动云代理(3000) + Vite(8080)
 * Windows / macOS / Linux 通用
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const isWin = process.platform === 'win32'
const npmCmd = isWin ? 'npm.cmd' : 'npm'

function run(cwd, args, name) {
  const child = spawn(npmCmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin
  })
  child.on('exit', (code) => {
    console.log(`[${name}] 已退出 code=${code}`)
    process.exit(code || 0)
  })
  return child
}

console.log('启动云代理 http://127.0.0.1:3000 …')
const proxy = run(path.join(root, 'proxy-server'), ['start'], 'proxy')

console.log('启动后台 http://127.0.0.1:8080 …')
const vite = run(root, ['run', 'dev'], 'vite')

function shutdown() {
  proxy.kill()
  vite.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
