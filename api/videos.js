import { getPlaylistConfig, loadPlaylistVideos } from '../server/youtubePlaylist.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ detail: 'Method not allowed' })
  }

  try {
    const result = await loadPlaylistVideos(getPlaylistConfig(process.env))

    if (result.status === 200 && result.body.videos?.length) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400')
    }

    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('videos api', error)
    return res.status(500).json({
      detail: error?.message || 'Could not load videos.',
    })
  }
}
