import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { client, urlFor } from '../lib/sanity'
import { getWallPageCache, whenStationPreloaded } from '../lib/preloadStation'
import styled, { keyframes, css } from 'styled-components'
import ImageModal from '../components/ImageModal'
import OrnatePhotoFrame from '../components/OrnatePhotoFrame'
import FrostNote from '../components/FrostNote'
import { font } from '../styles/theme'

const drift = keyframes`
  from { transform: translateX(-50%); }
  to { transform: translateX(0); }
`

const Panel = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background:
    radial-gradient(ellipse 70% 55% at 50% 28%, #1a1410 0%, transparent 70%),
    #0a0908;
  color: #fff;
  box-sizing: border-box;
  padding: 16px 0 28px;
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
  font-family: ${font};
`

const Stage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  min-height: min(100%, 720px);
`

const Slide = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: ${(p) => (p.$show ? 1 : 0)};
  transition: opacity 1.1s ease;
  pointer-events: none;
  z-index: ${(p) => (p.$show ? 2 : 1)};
`

/** Full-bleed film strip under the frame. */
const StripRail = styled.div`
  width: 100vw;
  margin-left: calc(50% - 50vw);
  overflow: hidden;
  padding: 10px 0 6px;
  background:
    linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.35)),
    repeating-linear-gradient(
      90deg,
      #1a120c 0 10px,
      #120c08 10px 12px
    );
  border-top: 1px solid rgba(196, 160, 106, 0.18);
  border-bottom: 1px solid rgba(0, 0, 0, 0.55);
  mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
`

const StripTrack = styled.div`
  display: flex;
  width: max-content;
  gap: 8px;
  padding: 0 8px;
  ${(p) => (p.$run ? css`
    animation: ${drift} ${p.$sec}s linear infinite;
  ` : '')}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const StripShot = styled.button`
  flex: 0 0 auto;
  width: clamp(112px, 18vw, 168px);
  aspect-ratio: 4 / 3;
  padding: 0;
  border: 2px solid ${(p) => (p.$on ? '#c4a06a' : 'rgba(255, 230, 190, 0.18)')};
  background: #000;
  cursor: pointer;
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px rgba(0, 0, 0, 0.5);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: ${(p) => (p.$on ? 1 : 0.78)};
    transition: opacity 0.25s ease;
  }

  &:hover {
    border-color: #d4b07a;
  }

  &:hover img {
    opacity: 1;
  }
`

export default function PhotoPage() {
  const seed = getWallPageCache('photo')
  const [photos, setPhotos] = useState(() => (seed.status === 'ready' ? seed.data : []))
  const [status, setStatus] = useState(() => (seed.status === 'idle' ? 'loading' : seed.status))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [aspect, setAspect] = useState(4 / 3)
  const [layers, setLayers] = useState([{ key: 0, index: 0, show: true }])
  const layerKey = useRef(0)
  const aspects = useRef({})

  useEffect(() => {
    let alive = true
    whenStationPreloaded().then(() => {
      if (!alive) return
      const cached = getWallPageCache('photo')
      if (cached.status === 'ready' || cached.status === 'empty' || cached.status === 'error') {
        setPhotos(cached.data || [])
        setStatus(cached.status)
        return
      }
      client.fetch(`*[_type == "photos"][0].images`).then((data) => {
        if (!alive) return
        if (data?.length) {
          setPhotos(data)
          setStatus('ready')
        } else {
          setStatus('empty')
        }
      }).catch(() => {
        if (alive) setStatus('error')
      })
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    setLayers((prev) => {
      const top = prev.find((l) => l.show) || prev[prev.length - 1]
      if (!top || top.index === featuredIndex) return prev
      layerKey.current += 1
      return [
        { ...top, show: false },
        { key: layerKey.current, index: featuredIndex, show: true },
      ]
    })
    const clear = window.setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.show))
    }, 1200)
    return () => window.clearTimeout(clear)
  }, [featuredIndex])

  // When the featured slide changes, morph the frame to that photo's ratio.
  useEffect(() => {
    const cached = aspects.current[featuredIndex]
    if (cached) setAspect(cached)
  }, [featuredIndex])

  useEffect(() => {
    if (status !== 'ready' || photos.length < 2 || paused || isModalOpen) return undefined
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined

    const id = window.setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % photos.length)
    }, 5000)
    return () => window.clearInterval(id)
  }, [status, photos.length, paused, isModalOpen])

  const handleModalClose = (newImage) => {
    if (newImage) setSelectedImage(newImage)
    else {
      setIsModalOpen(false)
      setSelectedImage(null)
    }
  }

  const open = (photo, index) => {
    if (typeof index === 'number') setFeaturedIndex(index)
    setSelectedImage(photo)
    setIsModalOpen(true)
  }

  const rememberAspect = (index, img) => {
    if (!img?.naturalWidth || !img?.naturalHeight) return
    const next = img.naturalWidth / img.naturalHeight
    aspects.current[index] = next
    if (index === featuredIndex) setAspect(next)
  }

  const featured = photos[featuredIndex] || photos[0]
  const strip = useMemo(() => {
    if (!photos.length) return []
    const base = photos.length < 6 ? [...photos, ...photos, ...photos] : photos
    return [...base, ...base]
  }, [photos])

  const mediaItems = photos.map((photo) => ({ type: 'image', image: photo }))
  const stripSec = Math.max(28, photos.length * 4.5)
  const caption = `${String(featuredIndex + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`

  return (
    <>
      <Panel>
        {status === 'loading' && <FrostNote>Loading photos…</FrostNote>}
        {status === 'empty' && <FrostNote>No photos yet.</FrostNote>}
        {status === 'error' && <FrostNote>Could not load photos.</FrostNote>}
        {status === 'ready' && featured ? (
          <Stage>
            <OrnatePhotoFrame
              aspect={aspect}
              caption={caption}
              onClick={() => open(featured, featuredIndex)}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              aria-label="Open featured photo"
            >
              {layers.map((layer) => {
                const photo = photos[layer.index]
                if (!photo) return null
                return (
                  <Slide
                    key={layer.key}
                    src={urlFor(photo).width(1200).url()}
                    alt=""
                    $show={layer.show}
                    onLoad={(e) => rememberAspect(layer.index, e.currentTarget)}
                  />
                )
              })}
            </OrnatePhotoFrame>

            <StripRail aria-label="Photo strip">
              <StripTrack $run={photos.length > 1} $sec={stripSec}>
                {strip.map((photo, i) => {
                  const real = i % photos.length
                  const on = real === featuredIndex
                  return (
                    <StripShot
                      key={`${photo.asset?._ref || real}-${i}`}
                      type="button"
                      $on={on}
                      onClick={() => setFeaturedIndex(real)}
                      aria-label={`Show photo ${real + 1}`}
                      aria-current={on ? 'true' : undefined}
                    >
                      <img
                        src={urlFor(photo).width(420).height(315).fit('crop').url()}
                        alt=""
                        loading="lazy"
                        draggable={false}
                      />
                    </StripShot>
                  )
                })}
              </StripTrack>
            </StripRail>
          </Stage>
        ) : null}
      </Panel>
      {typeof document !== 'undefined'
        ? createPortal(
          <ImageModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            currentImage={selectedImage}
            mediaItems={mediaItems}
          />,
          document.body,
        )
        : null}
    </>
  )
}
