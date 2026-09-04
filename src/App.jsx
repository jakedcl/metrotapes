import { createGlobalStyle } from 'styled-components'
import PhotoPage from './pages/PhotoPage'
import VideoPage from './pages/VideoPage'
import AboutPage from './pages/AboutPage'
import Header from './components/Header'
import StationScene from './components/StationScene'
import StationIntro from './components/StationIntro'
import { preloadStationAssets } from './lib/preloadStation'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Blog from './pages/Blog'
import { font, station } from './styles/theme'
import usePageMeta from './hooks/usePageMeta'
import { KioskLeaveProvider } from './context/KioskLeaveContext'

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    min-height: 100%;
  }

  body {
    background: ${station};
    color: white;
    font-family: ${font};
    font-weight: 500;
    min-height: 90vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: -0.02em;
  }

  #root {
    display: flex;
    flex-direction: column;
    background: ${station};
    min-height: 100vh;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${font};
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  p, span, a, button, input, textarea {
    font-family: ${font};
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  a, button {
    cursor: pointer;
  }
`

const Layout = styled.div`
  padding-top: ${(p) => (p.$pad ? '64px' : '0')};
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  min-height: 100vh;
`

const HeaderArea = styled.header`
  height: 64px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: ${station};
  opacity: ${(p) => (p.$show ? 1 : 0)};
  pointer-events: ${(p) => (p.$show ? 'auto' : 'none')};
  transition: opacity 0.9s ease;
`

const StationStage = styled.div`
  position: fixed;
  inset: 64px 0 0 0;
  z-index: ${(p) => (p.$front ? 5 : 0)};
  pointer-events: ${(p) => (p.$hit ? 'auto' : 'none')};
  transition: z-index 0s;
`

const ContentArea = styled.main`
  width: 100%;
  min-height: calc(100vh - 64px);
  position: relative;
  z-index: 1;
  pointer-events: ${(p) => (p.$pass ? 'none' : 'auto')};
`

const fadeUp = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const PageLayer = styled.div`
  animation: ${fadeUp} 0.55s ease both;
  background: ${(p) => (p.$clear
    ? 'transparent'
    : 'linear-gradient(180deg, rgba(10, 22, 16, 0.12) 0%, rgba(10, 22, 16, 0.55) 32%)')};
  min-height: calc(100vh - 64px);
  opacity: ${(p) => (p.$show ? 1 : 0)};
  pointer-events: ${(p) => {
    if (!p.$show) return 'none'
    return p.$clear ? 'none' : 'auto'
  }};
  transition: opacity 0.45s ease;
`

const SHOT = {
  '/': 'kiosk',
  '/photo': 'photo',
  '/video': 'video',
  '/about': 'about',
}

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const shotFromRoute = SHOT[location.pathname]
  const atKiosk = location.pathname === '/'
  const skipIntro = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [entered, setEntered] = useState(skipIntro)
  const [assetsReady, setAssetsReady] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [cabinReady, setCabinReady] = useState(false)
  const booted = assetsReady && sceneReady
  const arriving = atKiosk && !entered
  const shot = arriving ? 'kiosk' : (shotFromRoute || 'kiosk')
  const onPage = Boolean(shotFromRoute && shotFromRoute !== 'kiosk')
  const showPage = onPage && cabinReady
  const leaveRef = useRef({ tryLeave: () => false })
  const kioskLeave = useMemo(() => ({
    tryLeave: (to) => leaveRef.current.tryLeave(to),
  }), [])
  usePageMeta()

  useEffect(() => {
    // New route → wait for camera to finish flying into the car
    setCabinReady(!onPage)
  }, [location.pathname, onPage])

  useEffect(() => {
    let alive = true
    preloadStationAssets().then(() => {
      if (alive) setAssetsReady(true)
    })
    return () => { alive = false }
  }, [])

  const returnToIntro = () => {
    if (location.pathname !== '/') navigate('/')
    setEntered(false)
  }

  const handleArrive = (pov) => {
    if (pov === 'photo' || pov === 'video' || pov === 'about' || pov === 'cabin') {
      setCabinReady(true)
    }
  }

  return (
    <KioskLeaveProvider value={kioskLeave}>
    <Layout $pad>
      <HeaderArea $show={entered}>
        <Header />
      </HeaderArea>
      {shotFromRoute || arriving || entered ? (
        <StationStage $front={arriving} $hit={!arriving && !!shotFromRoute}>
          <StationScene
            shot={shot}
            kioskLive={atKiosk && entered}
            dimmed={arriving}
            introReady={booted}
            onIntroComplete={() => setEntered(true)}
            onReady={() => setSceneReady(true)}
            onExit={returnToIntro}
            onArrive={handleArrive}
            leaveRef={leaveRef}
          />
        </StationStage>
      ) : null}
      {arriving ? (
        <StationIntro onComplete={() => setEntered(true)} />
      ) : null}
      <ContentArea $pass={atKiosk || location.pathname === '/photo'}>
        <Routes>
          <Route path="/" element={null} />
          <Route path="/photo" element={<PageLayer $show={showPage} $clear><PhotoPage /></PageLayer>} />
          <Route path="/video" element={<PageLayer $show={showPage}><VideoPage /></PageLayer>} />
          <Route path="/about" element={<PageLayer $show={showPage}><AboutPage /></PageLayer>} />
          <Route path="/blog" element={<Blog />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ContentArea>
    </Layout>
    </KioskLeaveProvider>
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
