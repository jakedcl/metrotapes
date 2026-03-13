import { createGlobalStyle } from 'styled-components'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import PhotoPage from './pages/PhotoPage'
import VideoPage from './pages/VideoPage'
import AboutPage from './pages/AboutPage'
import Header from './components/Header'
import SubwayBubbles from './components/SubwayBubbles'
import { useState, useEffect } from 'react'
import { useTransition, animated } from '@react-spring/web'
import styled from 'styled-components'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Blog from './pages/Blog'

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body, #root {
    min-height: 100%;
    height: 100%;
  }

  body {
    background: #1A1A1A;
    color: white;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-weight: 500;
    min-height: 90vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: -0.02em;
  }

  #root {
    display: flex;
    flex-direction: column;
    background: #1A1A1A;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  p, span, a, button, input, textarea {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
`

const Layout = styled.div`
  padding-top: 64px; // Height of header
  position: relative;
  overflow: hidden;
`

const AnimatedHeaderArea = styled(animated.header)`
  height: 64px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #1A1A1A;
  transform-origin: top;
`

const ContentArea = styled.main`
  width: 100%;
  min-height: 90vh;
`

const AnimatedContainer = styled(animated.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  z-index: 200;
`

function AppContent() {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  const transitions = useTransition(!isUnlocked && isHomePage ? true : null, {
    from: { opacity: 1 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: {
      duration: 800,
      easing: t => t * (2 - t)
    }
  })

  const headerTransition = useTransition(isUnlocked || !isHomePage, {
    from: { opacity: 0, transform: 'translateY(-100%)' },
    enter: { opacity: 1, transform: 'translateY(0%)' },
    leave: { opacity: 0, transform: 'translateY(-100%)' },
    config: {
      duration: 800,
      easing: t => t * (2 - t)
    }
  })

  useEffect(() => {
    if (!isHomePage) {
      setIsUnlocked(true)
    }
  }, [isHomePage])

  return (
    <Layout>
      <SubwayBubbles />
      {headerTransition((style, show) =>
        show && (
          <AnimatedHeaderArea style={style}>
            <Header />
          </AnimatedHeaderArea>
        )
      )}
      {(isUnlocked || !isHomePage) && (
        <ContentArea>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/photo" element={<PhotoPage />} />
            <Route path="/video" element={<VideoPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ContentArea>
      )}
      {transitions((style, item) =>
        item && (
          <AnimatedContainer style={style}>
            <LandingPage onUnlock={() => setIsUnlocked(true)} />
          </AnimatedContainer>
        )
      )}
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <GlobalStyle />
      <AppContent />
    </BrowserRouter>
  )
}

export default App