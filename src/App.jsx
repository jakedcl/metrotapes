import { createGlobalStyle } from 'styled-components'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import PhotoPage from './pages/PhotoPage'
import VideoPage from './pages/VideoPage'
import AboutPage from './pages/AboutPage'
import Header from './components/Header'
import SubwayBubbles from './components/SubwayBubbles'
import Atmosphere from './components/Atmosphere'
import { useState, useEffect } from 'react'
import { useTransition, animated } from '@react-spring/web'
import styled from 'styled-components'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Blog from './pages/Blog'
import { theme } from './styles/theme'

const GlobalStyle = createGlobalStyle`
  :root {
    color-scheme: dark;
    --ink: ${theme.color.ink};
    --station: ${theme.color.station};
    --white: ${theme.color.white};
    --yellow: ${theme.color.yellow};
    --font: ${theme.font};
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    min-height: 100%;
    background: var(--ink);
  }

  body {
    background: var(--ink);
    color: var(--white);
    font-family: var(--font);
    font-weight: 500;
    min-height: 90vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: -0.02em;
    text-rendering: optimizeLegibility;
  }

  #root {
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(ellipse 120% 80% at 50% -20%, #1c1c1c 0%, var(--ink) 55%);
    min-height: 100vh;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  p, span, a, button, input, textarea {
    font-family: var(--font);
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  ::selection {
    background: var(--yellow);
    color: #111;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--ink);
  }

  ::-webkit-scrollbar-thumb {
    background: #3a3a3a;
    border-radius: 8px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    html:focus-within {
      scroll-behavior: auto;
    }
  }
`

const Layout = styled.div`
  padding-top: 64px;
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  min-height: 100vh;
`

const AnimatedHeaderArea = styled(animated.header)`
  height: 64px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${theme.z.header};
  background: transparent;
  transform-origin: top;
`

const ContentArea = styled.main`
  width: 100%;
  min-height: 90vh;
  position: relative;
  z-index: ${theme.z.content};
`

const AnimatedContainer = styled(animated.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  z-index: ${theme.z.landing};
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
      <Atmosphere />
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
