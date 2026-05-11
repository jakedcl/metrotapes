import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { client, urlFor } from '../lib/sanity'
import { PortableText } from '@portabletext/react'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'

const Container = styled.div`
  padding: 2rem;
  color: white;
  max-width: 1000px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`

const Content = styled.div`
  ${frostedPanel}
  ${frostedPanelShadow}
  border-radius: 12px;
  padding: 2rem;
`

const Title = styled.h1`
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 2rem;
  margin-bottom: 1.5rem;
  color: white;
  letter-spacing: -0.02em;

  @media (min-width: 768px) {
    font-size: 2.5rem;
  }
`

const TopSection = styled.div`
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`

const PhotoContainer = styled.div`
  flex: 1;
  max-width: 400px;

  @media (max-width: 768px) {
    max-width: 100%;
  }

  img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }
`

const LandscapePhotoContainer = styled.div`
  width: 100%;
  margin-top: 2rem;

  img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }
`

const Description = styled.div`
  flex: 1;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.1rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: -0.02em;

  p {
    margin-bottom: 1rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  strong {
    color: white;
    font-weight: 600;
  }

  em {
    font-style: italic;
  }

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`

const InstagramLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: white;
  text-decoration: none;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
  transition: transform 0.2s ease;
  margin: 2rem 0;
  opacity: 0.9;

  &:hover {
    transform: translateY(-1px);
    opacity: 1;
  }

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
`

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
    <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
  </svg>
)

export default function AboutPage() {
  const [aboutContent, setAboutContent] = useState(null)

  useEffect(() => {
    const fetchAboutContent = async () => {
      try {
        const data = await client.fetch(`*[_type == "about"][0] {
                    title,
                    description,
                    photo1,
                    photo2,
                    instagramUrl
                }`)
        setAboutContent(data)
      } catch (error) {
        console.error('Error fetching about content:', error)
      }
    }

    fetchAboutContent()
  }, [])

  if (!aboutContent) return null

  return (
    <Container>
      <Content>
        <Title>{aboutContent.title}</Title>
        <TopSection>
          <PhotoContainer>
            <img
              src={urlFor(aboutContent.photo2).width(800).url()}
              alt="Profile"
            />
          </PhotoContainer>
          <Description>
            <PortableText value={aboutContent.description} />
            {aboutContent.instagramUrl && (
              <InstagramLink
                href={aboutContent.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <InstagramIcon />
                @metrotapes
              </InstagramLink>
            )}
          </Description>
        </TopSection>
        <LandscapePhotoContainer>
          <img
            src={urlFor(aboutContent.photo1).width(1200).url()}
            alt="Landscape"
          />
        </LandscapePhotoContainer>
      </Content>
    </Container>
  )
} 