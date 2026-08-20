import { useEffect, useState } from 'react'
import { client, urlFor } from '../lib/sanity'
import styled, { keyframes } from 'styled-components'
import ImageModal from '../components/ImageModal'
import StationMark from '../components/StationMark'
import StatusPanel from '../components/StatusPanel'
import { theme } from '../styles/theme'

const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const Container = styled.div`
  padding: 28px 16px 64px;
  position: relative;
  z-index: 1;
`

const Inner = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 8px;

  @media (min-width: 1280px) {
    padding: 0 24px;
  }
`

const MasonryGrid = styled.div`
  columns: 1;
  column-gap: 14px;
  width: 100%;

  @media (min-width: 640px) {
    columns: 2;
  }

  @media (min-width: 1024px) {
    columns: 3;
  }

  @media (min-width: 1280px) {
    columns: 4;
  }
`

const PhotoItem = styled.button`
  break-inside: avoid;
  margin-bottom: 14px;
  cursor: pointer;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  opacity: 0;
  animation: ${fadeUp} 0.7s ease both;
  animation-delay: ${props => Math.min(props.$index * 0.045, 0.6)}s;

  img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 2px;
    transition: transform 0.35s ease, box-shadow 0.35s ease, filter 0.35s ease;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
  }

  &:focus-visible {
    outline: 2px solid ${theme.color.yellow};
    outline-offset: 4px;
  }

  &:hover img {
    transform: translateY(-4px) scale(1.012);
    filter: brightness(1.06);
    box-shadow:
      0 16px 32px rgba(0, 0, 0, 0.42),
      0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }
`

export default function PhotoPage() {
    const [photos, setPhotos] = useState([])
    const [status, setStatus] = useState('loading')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState(null)

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const data = await client.fetch(`*[_type == "photos"][0].images`)
                if (data?.length) {
                    setPhotos(data)
                    setStatus('ready')
                } else {
                    setPhotos([])
                    setStatus('empty')
                }
            } catch (error) {
                console.error('Error fetching photos:', error)
                setStatus('error')
            }
        }

        fetchPhotos()
    }, [])

    const handleImageClick = (photo) => {
        setSelectedImage(photo)
        setIsModalOpen(true)
    }

    const handleModalClose = (newImage) => {
        if (newImage) {
            setSelectedImage(newImage)
        } else {
            setIsModalOpen(false)
            setSelectedImage(null)
        }
    }

    const mediaItems = photos.map(photo => ({
        type: 'image',
        image: photo
    }))

    return (
        <Container>
            <Inner>
                <StationMark letter={theme.route.photo.letter} color={theme.route.photo.color}>
                    photo
                </StationMark>
                {status === 'loading' && (
                    <StatusPanel pulsing>Loading stills…</StatusPanel>
                )}
                {status === 'empty' && (
                    <StatusPanel>No photos in this station yet.</StatusPanel>
                )}
                {status === 'error' && (
                    <StatusPanel>Could not load photos.</StatusPanel>
                )}
                {status === 'ready' && (
                <MasonryGrid>
                    {photos.map((photo, index) => (
                        <PhotoItem
                            key={index}
                            $index={index}
                            type="button"
                            onClick={() => handleImageClick(photo)}
                        >
                            <img
                                src={urlFor(photo).width(800).url()}
                                alt={`Photo ${index + 1}`}
                                loading="lazy"
                                decoding="async"
                            />
                        </PhotoItem>
                    ))}
                </MasonryGrid>
                )}
            </Inner>
            <ImageModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                currentImage={selectedImage}
                mediaItems={mediaItems}
            />
        </Container>
    )
}
