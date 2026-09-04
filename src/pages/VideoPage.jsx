import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'
import FrostNote from '../components/FrostNote'
import { cushy, station } from '../styles/theme'
import { client } from '../lib/sanity'

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
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`

const Thumbnail = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
`

const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
`

const PlayMark = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    width: 0;
    height: 0;
    border-top: 15px solid transparent;
    border-bottom: 15px solid transparent;
    border-left: 20px solid white;
    margin-left: 5px;
  }
`

export default function VideoPage() {
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading')
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const data = await client.fetch(`*[_type == "video" && defined(videoId)]|order(publishDate desc) {
          ...,
          "_id": _id,
          "title": title,
          "videoId": videoId,
        }`)
        if (data?.length) {
          setVideos(data)
          setStatus('ready')
        } else {
          setStatus('empty')
        }
      } catch (error) {
        console.error('Error fetching videos:', error)
        setStatus('error')
      }
    }

    fetchVideos()
  }, [])

  return (
    <Container>
      {status === 'loading' && <FrostNote>Loading videos…</FrostNote>}
      {status === 'empty' && <FrostNote>No videos yet.</FrostNote>}
      {status === 'error' && <FrostNote>Could not load videos.</FrostNote>}
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
