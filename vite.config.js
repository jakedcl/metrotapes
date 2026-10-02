import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { allowVideosRequest } from './server/videosGuard.js'
import { getPlaylistConfig, loadPlaylistVideos } from './server/youtubePlaylist.js'

function videosApiPlugin(env) {
  return {
    name: 'videos-api',
    configureServer(server) {
      server.middlewares.use('/api/videos', async (req, res) => {
        const guard = allowVideosRequest(req)
        if (!guard.ok) {
          res.statusCode = guard.status
          if (guard.status === 405) res.setHeader('Allow', 'GET')
          if (guard.status === 429) res.setHeader('Retry-After', '60')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(guard.body))
          return
        }

        try {
          const result = await loadPlaylistVideos(getPlaylistConfig(env))
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        } catch (error) {
          console.error('videos api', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            detail: error?.message || 'Could not load videos.',
          }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), videosApiPlugin(env)],
    base: '/',
    server: {
      port: 5173,
      host: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/postprocessing/')) return 'postprocessing'
            if (id.includes('node_modules/three/')) return 'three'
            return undefined
          },
        },
      },
    }
  }
})

