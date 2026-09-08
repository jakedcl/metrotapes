import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { client, urlFor } from '../lib/sanity'
import styled from 'styled-components'
import ImageModal from '../components/ImageModal'
import FrostNote from '../components/FrostNote'
import { font } from '../styles/theme'

const Panel = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #0c0e10;
  color: #fff;
  box-sizing: border-box;
  padding: 12px 14px 24px;
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
  font-family: ${font};
`

const Shell = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`

const Hero = styled.button`
  display: block;
  width: min(100%, calc(38vh * 16 / 9));
  margin: 0 auto 12px;
  padding: 0;
  border: 0;
  background: #000;
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }

  &:hover img { opacity: 0.92; }
  &:active img { opacity: 0.85; }
`

const Masonry = styled.div`
  columns: 5;
  column-gap: 8px;
  width: 100%;

  @media (max-width: 1100px) {
    columns: 4;
  }
  @media (max-width: 820px) {
    columns: 3;
  }
  @media (max-width: 560px) {
    columns: 2;
  }
`

const PhotoItem = styled.button`
  break-inside: avoid;
  margin: 0 0 8px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: block;
  width: 100%;
  text-align: left;

  img {
    width: 100%;
    height: auto;
    display: block;
  }

  &:hover img { opacity: 0.92; }
  &:active img { opacity: 0.85; }
`

export default function PhotoPage() {
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    let alive = true
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
    return () => { alive = false }
  }, [])

  const handleModalClose = (newImage) => {
    if (newImage) setSelectedImage(newImage)
    else {
      setIsModalOpen(false)
      setSelectedImage(null)
    }
  }

  const open = (photo) => {
    setSelectedImage(photo)
    setIsModalOpen(true)
  }

  const featured = photos[0]
  const rest = photos.slice(1)
  const mediaItems = photos.map((photo) => ({ type: 'image', image: photo }))

  return (
    <>
      <Panel>
        {status === 'loading' && <FrostNote>Loading photos…</FrostNote>}
        {status === 'empty' && <FrostNote>No photos yet.</FrostNote>}
        {status === 'error' && <FrostNote>Could not load photos.</FrostNote>}
        {status === 'ready' && featured ? (
          <Shell>
            <Hero type="button" onClick={() => open(featured)} aria-label="Open photo">
              <img
                src={urlFor(featured).width(1200).url()}
                alt=""
              />
            </Hero>
            {rest.length ? (
              <Masonry>
                {rest.map((photo, index) => (
                  <PhotoItem
                    key={photo.asset?._ref || index}
                    type="button"
                    onClick={() => open(photo)}
                    aria-label="Open photo"
                  >
                    <img
                      src={urlFor(photo).width(560).url()}
                      alt=""
                      loading="lazy"
                    />
                  </PhotoItem>
                ))}
              </Masonry>
            ) : null}
          </Shell>
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
