import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { getPlaylistConfig, loadPlaylistVideos } from './server/youtubePlaylist.js'

function videosApiPlugin(env) {
  return {
    name: 'videos-api',
    configureServer(server) {
      server.middlewares.use('/api/videos', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.setHeader('Allow', 'GET')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ detail: 'Method not allowed' }))
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
      sourcemap: true
    }
  }
})

