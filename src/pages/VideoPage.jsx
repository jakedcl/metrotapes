import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'
import FrostNote from '../components/FrostNote'
import { cushy, station } from '../styles/theme'

const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  background: ${station};
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
  ${props => (props.$playing ? '' : cushy)}
  break-inside: avoid;
  margin-bottom: 16px;
  position: relative;
  isolation: isolate;
  border-radius: 8px;
  overflow: hidden;
  ${frostedPanelShadow}

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    border-radius: inherit;
    ${frostedPanel}
  }
`

const VideoEmbed = styled.div`
  position: relative;
  z-index: 1;
  padding-top: 56.25%;
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

const PlayButton = styled.button`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: #000;
  cursor: pointer;
`

const Thumbnail = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

const Scrim = styled.span`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  pointer-events: none;
`

const PlayMark = styled.span`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 16px 0 16px 26px;
  border-color: transparent transparent transparent #fff;
  transform: translate(-35%, -50%);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
  pointer-events: none;
`

export default function VideoPage() {
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading')
  const [statusDetail, setStatusDetail] = useState('')
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => {
    const fetchVideos = async () => {
      setStatus('loading')
      setStatusDetail('')
      setPlayingId(null)

      try {
        const response = await fetch('/api/videos')
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          setVideos([])
          setStatus('error')
          setStatusDetail(data.detail || `Could not load videos (${response.status}).`)
          return
        }

        if (!data.videos?.length) {
          setVideos([])
          setStatus('empty')
          setStatusDetail(data.detail || 'No videos to show.')
          return
        }

        setVideos(data.videos)
        setStatus('ready')
      } catch (error) {
        console.error('Error fetching videos:', error)
        setVideos([])
        setStatus('error')
        setStatusDetail(error?.message || 'Could not load videos.')
      }
    }

    fetchVideos()
  }, [])

  return (
    <Container>
      {status === 'loading' && (
        <FrostNote>Loading playlist…</FrostNote>
      )}
      {(status === 'empty' || status === 'error') && (
        <FrostNote>
          {status === 'error' ? 'Could not load videos.' : 'No videos to show.'}
          {statusDetail ? (
            <>
              {' '}
              <span style={{ display: 'block', marginTop: '0.75rem', opacity: 0.8, fontSize: '0.95rem' }}>
                {statusDetail}
              </span>
            </>
          ) : null}
        </FrostNote>
      )}
      {status === 'ready' && (
        <VideoGrid>
          {videos.map(video => {
            const isPlaying = playingId === video.videoId

            return (
              <VideoItem key={video.id} $playing={isPlaying}>
                <VideoEmbed>
                  {isPlaying ? (
                    <VideoIframe
                      src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <PlayButton
                      type="button"
                      onClick={() => setPlayingId(video.videoId)}
                      aria-label={`Play ${video.title}`}
                    >
                      <Thumbnail
                        src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                        alt=""
                      />
                      <Scrim />
                      <PlayMark aria-hidden="true" />
                    </PlayButton>
                  )}
                </VideoEmbed>
              </VideoItem>
            )
          })}
        </VideoGrid>
      )}
    </Container>
  )
}
