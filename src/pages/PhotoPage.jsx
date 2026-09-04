import { useEffect, useState } from 'react'
import { client } from '../lib/sanity'
import styled from 'styled-components'
import ImageModal from '../components/ImageModal'
import FrostNote from '../components/FrostNote'
import { CABIN_PHOTO_EVENT } from '../lib/cabinGallery'

const Stage = styled.div`
  min-height: calc(100vh - 64px);
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 20px 16px;
`

const Hint = styled.div`
  pointer-events: none;
  margin-top: 8px;
  padding: 8px 12px;
  font-family: Helvetica, "Helvetica Neue", Arial, sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.65);
`

const Note = styled.div`
  pointer-events: none;
  padding: 24px 16px;
`

/**
 * Thin HUD for /photo — frames live in the 3D car.
 * Listens for frame clicks and opens the existing modal.
 */
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

  useEffect(() => {
    const onPick = (e) => {
      const photo = e.detail?.photo
      if (!photo) return
      setSelectedImage(photo)
      setIsModalOpen(true)
      if (e.detail?.photos?.length) setPhotos(e.detail.photos)
    }
    window.addEventListener(CABIN_PHOTO_EVENT, onPick)
    return () => window.removeEventListener(CABIN_PHOTO_EVENT, onPick)
  }, [])

  const handleModalClose = (newImage) => {
    if (newImage) {
      setSelectedImage(newImage)
    } else {
      setIsModalOpen(false)
      setSelectedImage(null)
    }
  }

  const mediaItems = photos.map((photo) => ({
    type: 'image',
    image: photo,
  }))

  return (
    <Stage>
      {status === 'loading' && <Note><FrostNote>Loading photos…</FrostNote></Note>}
      {status === 'empty' && <Note><FrostNote>No photos yet.</FrostNote></Note>}
      {status === 'error' && <Note><FrostNote>Could not load photos.</FrostNote></Note>}
      {status === 'ready' ? (
        <Hint>Scroll to look · click a frame</Hint>
      ) : null}
      <ImageModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        currentImage={selectedImage}
        mediaItems={mediaItems}
      />
    </Stage>
  )
}
