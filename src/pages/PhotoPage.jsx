import { useEffect, useState } from 'react'
import { client, urlFor } from '../lib/sanity'
import styled from 'styled-components'
import ImageModal from '../components/ImageModal'

const Container = styled.div`
  padding: 32px 16px;
`

const MasonryGrid = styled.div`
  position: relative;
  z-index: 1;
  columns: 1;
  column-gap: 16px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 16px;
  
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

const PhotoItem = styled.div`
  break-inside: avoid;
  margin-bottom: 16px;
  cursor: pointer;
  
  img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
    transition: transform 0.2s ease;
    
    &:hover {
      transform: scale(1.02);
    }
  }
`

export default function PhotoPage() {
    const [photos, setPhotos] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState(null)

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const data = await client.fetch(`*[_type == "photos"][0].images`)
                if (data) setPhotos(data)
            } catch (error) {
                console.error('Error fetching photos:', error)
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

    // Convert photos to mediaItems format expected by ImageModal
    const mediaItems = photos.map(photo => ({
        type: 'image',
        image: photo
    }))

    return (
        <Container>
            <MasonryGrid>
                {photos.map((photo, index) => (
                    <PhotoItem
                        key={index}
                        onClick={() => handleImageClick(photo)}
                    >
                        <img
                            src={urlFor(photo).width(800).url()}
                            alt={`Photo ${index + 1}`}
                            loading="lazy"
                        />
                    </PhotoItem>
                ))}
            </MasonryGrid>
            <ImageModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                currentImage={selectedImage}
                mediaItems={mediaItems}
            />
        </Container>
    )
} 