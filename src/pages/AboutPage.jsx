import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { client, urlFor } from '../lib/sanity'
import { PortableText } from '@portabletext/react'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'
import FrostNote from '../components/FrostNote'
import { cushy } from '../styles/theme'

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
  color: #f5f5f5;

  p {
    margin-bottom: 1em;
  }

  a {
    color: #fccc0a;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`

const portableTextComponents = {
  block: {
    h1: ({ children }) => <Title>{children}</Title>,
    normal: ({ children }) => <p>{children}</p>,
  },
  marks: {
    link: ({ children, value }) => {
      const rel = !value.href.startsWith('/') ? 'noreferrer noopener' : undefined
      return (
        <a href={value.href} rel={rel}>
          {children}
        </a>
      )
    },
  },
}

export default function AboutPage() {
  const [aboutData, setAboutData] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const fetchAboutPage = async () => {
      try {
        const data = await client.fetch(`*[_type == "aboutPage"][0]{
          title,
          mainImage{
            asset->{
              _id,
              url
            }
          },
          landscapeImage{
            asset->{
              _id,
              url
            }
          },
          body
        }`)
        if (data) {
          setAboutData(data)
          setStatus('ready')
        } else {
          setStatus('empty')
        }
      } catch (error) {
        console.error('Error fetching about page:', error)
        setStatus('error')
      }
    }

    fetchAboutPage()
  }, [])

  return (
    <Container>
      {status === 'loading' && <FrostNote>Loading about info…</FrostNote>}
      {status === 'empty' && <FrostNote>No about info yet.</FrostNote>}
      {status === 'error' && <FrostNote>Could not load about info.</FrostNote>}
      {status === 'ready' && aboutData && (
        <Content>
          <TopSection>
            {aboutData.mainImage && (
              <PhotoContainer>
                <img
                  src={urlFor(aboutData.mainImage).width(400).url()}
                  alt={aboutData.title || 'About Image'}
                />
              </PhotoContainer>
            )}
            {aboutData.body && (
              <Description>
                <PortableText
                  value={aboutData.body}
                  components={portableTextComponents}
                />
              </Description>
            )}
          </TopSection>
          {aboutData.landscapeImage && (
            <LandscapePhotoContainer>
              <img
                src={urlFor(aboutData.landscapeImage).width(800).url()}
                alt={aboutData.title || 'About Landscape Image'}
              />
            </LandscapePhotoContainer>
          )}
        </Content>
      )}
    </Container>
  )
}
