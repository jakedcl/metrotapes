import { useEffect, useState } from 'react'
import { client } from '../lib/sanity'
import styled from 'styled-components'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'

const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  background: #1a1a1a;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
`

const VideoGrid = styled.div`
  columns: 1;
  column-gap: 16px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  flex: 1;
  
  @media (min-width: 640px) {
    columns: 2;
  }
  
  @media (min-width: 1024px) {
    columns: 3;
  }
  
  @media (min-width: 1280px) {
    columns: 4;
    padding: 0 32px;
  }
`

/* Frost lives on ::before so backdrop-filter does not flatten embeds (WebKit/Chromium iframe bug). */
const VideoItem = styled.div`
  break-inside: avoid;
  margin-bottom: 16px;
  position: relative;
  isolation: isolate;
  border-radius: 8px;
  overflow: hidden;
  ${frostedPanelShadow}
  transition: transform 0.2s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    border-radius: inherit;
    ${frostedPanel}
  }

  &:hover {
    transform: translateY(-4px);
  }
`

const VideoEmbed = styled.div`
  position: relative;
  z-index: 1;
  padding-top: 56.25%; // 16:9 aspect ratio
  background: #000;
  overflow: hidden;
`

const VideoIframe = styled.iframe`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 0;
  z-index: 1;
`

const StatusBlock = styled.div`
  ${frostedPanel}
  ${frostedPanelShadow}
  border-radius: 12px;
  padding: 2rem 1.5rem;
  max-width: 28rem;
  margin: 2rem auto 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  letter-spacing: -0.02em;
  line-height: 1.5;
`

export default function VideoPage() {
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading')
  const [statusDetail, setStatusDetail] = useState('')
  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

  useEffect(() => {
    const fetchVideos = async () => {
      setStatus('loading')
      setStatusDetail('')

      if (!YOUTUBE_API_KEY) {
        setVideos([])
        setStatus('error')
        setStatusDetail(
          'Missing VITE_YOUTUBE_API_KEY. Add it to your .env file for local dev or in Vercel env vars for production.'
        )
        return
      }

      try {
        const playlistId = await client.fetch(`*[_type == "videos"][0].playlistId`)
        if (!playlistId) {
          setVideos([])
          setStatus('empty')
          setStatusDetail('No YouTube playlist is set in Sanity yet.')
          return
        }

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`
        )
        const data = await response.json()

        if (!response.ok) {
          setVideos([])
          setStatus('error')
          setStatusDetail(
            data?.error?.message ||
              `YouTube API error (${response.status}). Check the API key and quota.`
          )
          return
        }

        if (!data.items?.length) {
          setVideos([])
          setStatus('empty')
          setStatusDetail('Playlist loaded but has no videos (or API returned no items).')
          return
        }

        const formattedVideos = data.items.map(item => ({
          id: item.id,
          title: item.snippet.title,
          videoId: item.snippet.resourceId.videoId
        }))
        setVideos(formattedVideos)
        setStatus('ready')
      } catch (error) {
        console.error('Error fetching videos:', error)
        setVideos([])
        setStatus('error')
        setStatusDetail(error?.message || 'Could not load videos.')
      }
    }

    fetchVideos()
  }, [YOUTUBE_API_KEY])

  return (
    <Container>
      {status === 'loading' && (
        <StatusBlock>Loading playlist…</StatusBlock>
      )}
      {(status === 'empty' || status === 'error') && (
        <StatusBlock>
          {status === 'error' ? 'Could not load videos.' : 'No videos to show.'}
          {statusDetail ? (
            <>
              {' '}
              <span style={{ display: 'block', marginTop: '0.75rem', opacity: 0.8, fontSize: '0.95rem' }}>
                {statusDetail}
              </span>
            </>
          ) : null}
        </StatusBlock>
      )}
      {status === 'ready' && (
        <VideoGrid>
          {videos.map(video => (
            <VideoItem key={video.id}>
              <VideoEmbed>
                <VideoIframe
                  src={`https://www.youtube.com/embed/${video.videoId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </VideoEmbed>
            </VideoItem>
          ))}
        </VideoGrid>
      )}
    </Container>
  )
}