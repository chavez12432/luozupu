import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

/** 代理未启动时，列表/导出可回退读本地合并库 */
function localDbMiddleware() {
  return {
    name: 'local-db-fallback',
    configureServer(server) {
      server.middlewares.use('/local-db/members.json', (req, res) => {
        const file = path.join(projectRoot, 'database', 'members_export.json')
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          res.end('members_export.json not found')
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        fs.createReadStream(file).pipe(res)
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), localDbMiddleware()],
  server: {
    port: 8080,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  }
})
