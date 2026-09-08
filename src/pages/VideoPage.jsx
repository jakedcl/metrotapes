import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import FrostNote from '../components/FrostNote'
import { font, route } from '../styles/theme'

const GREEN = route.video

const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #0c0e10;
  padding: 8px 10px 20px;
  box-sizing: border-box;
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
  color: #fff;
  font-family: ${font};
`

const Shell = styled.div`
  max-width: 900px;
  margin: 0 auto;
`

const Hero = styled.section`
  margin: 0 0 12px;
`

const Frame = styled.div`
  position: relative;
  width: min(100%, calc(46vh * 16 / 9));
  aspect-ratio: 16 / 9;
  margin: 0 auto;
  background: #000;
  overflow: hidden;
`

const VideoIframe = styled.iframe`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
`

const Thumb = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`

const PlayDisc = styled.span`
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  margin: ${(p) => `-${p.$size / 2}px 0 0 -${p.$size / 2}px`};
  border-radius: 50%;
  background: rgba(10, 10, 12, 0.62);
  border: 1.5px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    left: 54%;
    top: 50%;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: ${(p) => `${Math.round(p.$size * 0.16)}px 0 ${Math.round(p.$size * 0.16)}px ${Math.round(p.$size * 0.28)}px`};
    border-color: transparent transparent transparent #fff;
    transform: translate(-35%, -50%);
  }
`

const Time = styled.span`
  position: absolute;
  right: 6px;
  bottom: 6px;
  z-index: 1;
  padding: 2px 5px;
  background: rgba(0, 0, 0, 0.82);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1.2;
  pointer-events: none;
`

const Scrim = styled.span`
  position: absolute;
  inset: auto 0 0;
  height: 38%;
  pointer-events: none;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
`

const PlayButton = styled.button`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: #000;
  cursor: pointer;

  &:hover img { opacity: 0.88; }
  &:hover ${PlayDisc} { background: rgba(10, 10, 12, 0.78); }
`

const HeroTitle = styled.h1`
  margin: 10px 4px 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.25;
`

const Label = styled.p`
  margin: 18px 4px 8px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${GREEN};
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 10px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const Clip = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:hover img { opacity: 0.9; }
  &:hover ${PlayDisc} { background: rgba(10, 10, 12, 0.78); }
`

const ClipFrame = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
`

const ClipTitle = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 6px 1px 0;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: ${(p) => (p.$on ? '#fff' : 'rgba(255, 255, 255, 0.82)')};
`

function YtThumb({ videoId, alt = '', lazy = false }) {
  const [src, setSrc] = useState(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`)
  return (
    <Thumb
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      onError={() => setSrc(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`)}
    />
  )
}

function ThumbChrome({ videoId, duration, lazy = false, size = 40 }) {
  return (
    <>
      <YtThumb videoId={videoId} lazy={lazy} />
      <Scrim aria-hidden="true" />
      <PlayDisc $size={size} aria-hidden="true" />
      {duration ? <Time>{duration}</Time> : null}
    </>
  )
}

export default function VideoPage() {
  const scroller = useRef(null)
  const [videos, setVideos] = useState([])
  const [status, setStatus] = useState('loading')
  const [statusDetail, setStatusDetail] = useState('')
  const [featuredId, setFeaturedId] = useState(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let alive = true
    const fetchVideos = async () => {
      setStatus('loading')
      setStatusDetail('')
      setPlaying(false)

      try {
        const response = await fetch('/api/videos')
        const data = await response.json().catch(() => ({}))
        if (!alive) return

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
        setFeaturedId(data.videos[0].videoId)
        setStatus('ready')
      } catch (error) {
        console.error('Error fetching videos:', error)
        if (!alive) return
        setVideos([])
        setStatus('error')
        setStatusDetail(error?.message || 'Could not load videos.')
      }
    }

    fetchVideos()
    return () => { alive = false }
  }, [])

  const featured = videos.find((v) => v.videoId === featuredId) || videos[0]
  const rest = videos.filter((v) => v.videoId !== featured?.videoId)

  const openClip = (videoId) => {
    setFeaturedId(videoId)
    setPlaying(true)
    scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Container ref={scroller} data-wall-page="video">
      {status === 'loading' && <FrostNote>Loading playlist…</FrostNote>}
      {(status === 'empty' || status === 'error') && (
        <FrostNote>
          {status === 'error' ? 'Could not load videos.' : 'No videos to show.'}
          {statusDetail ? (
            <span style={{ display: 'block', marginTop: '0.75rem', opacity: 0.8, fontSize: '0.95rem' }}>
              {statusDetail}
            </span>
          ) : null}
        </FrostNote>
      )}
      {status === 'ready' && featured ? (
        <Shell>
          <Hero>
            <Frame>
              {playing ? (
                <VideoIframe
                  src={`https://www.youtube.com/embed/${featured.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                  title={featured.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <PlayButton
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label={`Play ${featured.title}`}
                >
                  <ThumbChrome videoId={featured.videoId} duration={featured.duration} size={52} />
                </PlayButton>
              )}
            </Frame>
            <HeroTitle>{featured.title}</HeroTitle>
          </Hero>
          {rest.length ? (
            <>
              <Label>More from the playlist</Label>
              <Grid>
                {rest.map((video) => (
                  <Clip
                    key={video.id || video.videoId}
                    type="button"
                    onClick={() => openClip(video.videoId)}
                    aria-label={`Play ${video.title}`}
                  >
                    <ClipFrame>
                      <ThumbChrome videoId={video.videoId} duration={video.duration} lazy size={40} />
                    </ClipFrame>
                    <ClipTitle>{video.title}</ClipTitle>
                  </Clip>
                ))}
              </Grid>
            </>
          ) : null}
        </Shell>
      ) : null}
    </Container>
  )
}
