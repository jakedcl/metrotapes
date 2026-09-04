import { Link, useNavigate } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faVideo, faBook } from '@fortawesome/free-solid-svg-icons'
import { font, route } from '../styles/theme'
import MetroMachineFace from './MetroMachineFace'
import { KIOSK_PANEL_W, KIOSK_PANEL_H } from '../lib/kioskSize'
import { useKioskLeave } from '../context/KioskLeaveContext'

const Panel = styled.div`
  width: ${KIOSK_PANEL_W}px;
  height: ${KIOSK_PANEL_H}px;
  background: #0b1c3a;
  color: #fff;
  font-family: ${font};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 22px;
  pointer-events: ${(p) => (p.$live ? 'auto' : 'none')};
  box-sizing: border-box;
`

const Brand = styled.div`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  padding: 6px 0 4px;
  display: flex;
  justify-content: center;
  align-items: baseline;
  min-height: 20px;
  overflow: hidden;
  flex: 0 0 auto;
`

const dropLetter = keyframes`
  0%, 14% {
    max-width: 1.1em;
    opacity: 0.55;
    transform: translateY(0) scale(1);
    letter-spacing: 0.18em;
  }
  28%, 62% {
    max-width: 0;
    opacity: 0;
    transform: translateY(6px) scale(0.4);
    letter-spacing: 0;
  }
  78%, 100% {
    max-width: 1.1em;
    opacity: 0.55;
    transform: translateY(0) scale(1);
    letter-spacing: 0.18em;
  }
`

const keepLetter = keyframes`
  0%, 14% {
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.18em;
    transform: scale(1);
  }
  32%, 62% {
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: 0.08em;
    transform: scale(1.08);
  }
  78%, 100% {
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.18em;
    transform: scale(1);
  }
`

const Letter = styled.span`
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  line-height: 1;
  animation: ${({ $keep }) => ($keep ? keepLetter : dropLetter)} 6.4s ease-in-out infinite;
  animation-delay: ${({ $keep, $i }) => ($keep ? '0s' : `${0.06 * $i}s`)};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    max-width: 1.1em;
    opacity: 0.55;
    letter-spacing: 0.18em;
    transform: none;
  }
`

const WORD = 'METROTAPES'
const KEEP = new Set([0, 2, 6])

const ScreenHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
`

const Weather = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 700;
  min-height: 16px;
`

const WxIcon = styled.span`
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;

  svg {
    width: 16px;
    height: 16px;
    display: block;
  }
`

const SectionLabel = styled.div`
  padding: 4px 14px 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  flex: 0 0 auto;
`

const RecentList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
  padding: 0 14px 4px;
  flex: 0 0 auto;
`

const Clip = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: #000;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  color: inherit;
  position: relative;
  /* No transform hover inside CSS 3D kiosk overlay */
  transition: opacity 0.15s ease;

  &:hover { opacity: 0.92; }
  &:active { opacity: 0.85; }
`

const Thumb = styled.img`
  display: block;
  width: 100%;
  /* Landscape thumbs — frees ~40px vs square for the machine face */
  aspect-ratio: 16 / 10;
  object-fit: cover;
`

const ClipMeta = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 5px 4px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ClipFrame = styled.iframe`
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 0;
  background: #000;
`

const More = styled(Link)`
  display: block;
  margin: 0 14px 4px;
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  cursor: pointer;
  /* No transform hover — CSS 3D overlay hit-testing flickers with child transforms */
  transition: color 0.15s ease;

  &:visited { color: rgba(255, 255, 255, 0.45); }
  &:hover { color: rgba(255, 255, 255, 0.75); }
`

const Destinations = styled.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  padding: 6px 12px 10px;
  gap: 6px;
  background: rgba(0, 0, 0, 0.28);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  min-height: 0;
`

const DestLabel = styled.div`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fccc0a;
  padding: 1px 4px 2px;
`

const DestBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  margin: 0;
  text-decoration: none;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0;
  min-height: 52px;
  flex: 1 1 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
  /* Background-only hover — transform scales inside CSS 3D overlay cause enter/leave spam */
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.28);
  }
  &:active {
    background: rgba(255, 255, 255, 0.22);
  }
`

const Bullet = styled.span`
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;

  svg {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
  }
`

const Dest = styled.div`
  min-width: 0;
  strong {
    display: block;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
    text-transform: uppercase;
    line-height: 1;
  }
`

const DESTINATIONS = [
  { icon: faCamera, color: route.photo, title: 'Photo', to: '/photo' },
  { icon: faVideo, color: route.video, title: 'Video', to: '/video' },
  { icon: faBook, color: route.about, title: 'About', to: '/about' },
]

function WeatherGlyph({ code }) {
  if (code >= 71 && code <= 77) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="5" r="2.2" fill="#e8eef4" />
        <path d="M3 8.2h10M4 11h8M5.5 13.5h5" stroke="#d7e4f0" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (code >= 95) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 7.2a3.4 3.4 0 0 1 6.5-1.4A3 3 0 0 1 12.8 10H4.2A2.6 2.6 0 0 1 3.5 7.2Z" fill="#c5d0dc" />
        <path d="M8 9.2 6.4 12.4h2.1L7.2 15.2" fill="none" stroke="#fccc0a" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    )
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 6.8a3.4 3.4 0 0 1 6.5-1.4A3 3 0 0 1 12.8 9.6H4.2A2.6 2.6 0 0 1 3.5 6.8Z" fill="#c5d0dc" />
        <path d="M6 11.2v2.6M8.2 11.6v2.6M10.4 11.2v2.6" stroke="#7eb6e0" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  if (code === 45 || code === 48) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 7.2h11M3.2 10h9.6" stroke="#c8d0d8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (code === 2 || code === 3) {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="6" cy="5.2" r="2.4" fill="#fccc0a" />
        <path d="M4 9a3.2 3.2 0 0 1 6.1-1.2A2.8 2.8 0 0 1 13 11.2H4.8A2.4 2.4 0 0 1 4 9Z" fill="#d5dde6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" fill="#fccc0a" />
      <path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" stroke="#fccc0a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function useNycWeather() {
  const [wx, setWx] = useState(null)
  useEffect(() => {
    let alive = true
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.758&longitude=-73.9855&current=temperature_2m,weather_code&temperature_unit=fahrenheit&forecast_days=1'
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return
        const temp = data?.current?.temperature_2m
        const code = data?.current?.weather_code
        if (typeof temp !== 'number') return
        setWx({ temp: Math.round(temp), code: Number(code) || 0 })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return wx
}

function useRecentVideos() {
  const [clips, setClips] = useState([])
  useEffect(() => {
    let alive = true
    fetch('/api/videos')
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return
        setClips((data.videos || []).slice(0, 3))
      })
      .catch(() => {
        if (alive) setClips([])
      })
    return () => { alive = false }
  }, [])
  return clips
}

export default function KioskScreen({ live = false }) {
  const navigate = useNavigate()
  const kioskLeave = useKioskLeave()
  const time = useClock()
  const weather = useNycWeather()
  const clips = useRecentVideos()
  const [playingId, setPlayingId] = useState(null)
  const navLock = useRef(false)

  useEffect(() => {
    if (!live) {
      setPlayingId(null)
      navLock.current = false
    }
  }, [live])

  const goTo = (to) => {
    if (!live || navLock.current) return
    navLock.current = true
    if (kioskLeave?.tryLeave?.(to)) return
    navigate(to)
  }

  return (
    <Panel $live={live}>
      <Brand aria-label="metrotapes">
        {WORD.split('').map((ch, i) => (
          <Letter key={`${ch}-${i}`} $keep={KEEP.has(i)} $i={i}>{ch}</Letter>
        ))}
      </Brand>
      <ScreenHead>
        <Weather>
          {weather ? (
            <>
              <WxIcon>
                <WeatherGlyph code={weather.code} />
              </WxIcon>
              {weather.temp}°F
            </>
          ) : null}
        </Weather>
        <span>{time}</span>
      </ScreenHead>
      <SectionLabel>Recent work</SectionLabel>
      <RecentList>
        {clips.map((video) => {
          const playing = playingId === video.videoId
          return (
            <Clip
              key={video.id || video.videoId}
              type="button"
              onClick={() => setPlayingId(playing ? null : video.videoId)}
              aria-label={playing ? `Pause ${video.title}` : `Play ${video.title}`}
            >
              {playing ? (
                <ClipFrame
                  src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`}
                  title={video.title}
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              ) : (
                <>
                  <Thumb
                    src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                    alt=""
                  />
                  <ClipMeta>{video.title}</ClipMeta>
                </>
              )}
            </Clip>
          )
        })}
      </RecentList>
      <More
        to="/video"
        onClick={(e) => {
          e.preventDefault()
          goTo('/video')
        }}
      >
        See all on video →
      </More>
      <MetroMachineFace />
      <Destinations>
        <DestLabel>Go</DestLabel>
        {DESTINATIONS.map((row) => (
          <DestBtn
            key={row.to}
            type="button"
            onClick={() => goTo(row.to)}
          >
            <Bullet $color={row.color}>
              <FontAwesomeIcon icon={row.icon} />
            </Bullet>
            <Dest>
              <strong>{row.title}</strong>
            </Dest>
          </DestBtn>
        ))}
      </Destinations>
    </Panel>
  )
}
