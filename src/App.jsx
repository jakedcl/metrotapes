import { createGlobalStyle } from 'styled-components'
import PhotoPage from './pages/PhotoPage'
import VideoPage from './pages/VideoPage'
import AboutPage from './pages/AboutPage'
import Header from './components/Header'
import BootScreen from './components/BootScreen'
import { preloadStationAssets } from './lib/preloadStation'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Blog from './pages/Blog'
import { font, station } from './styles/theme'
import usePageMeta from './hooks/usePageMeta'
import { KioskLeaveProvider } from './context/KioskLeaveContext'
import { GfxProvider } from './lib/gfxTier'

const StationScene = lazy(() => import('./components/StationScene'))

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
    min-height: 100dvh;
  }

  html {
    min-height: 100%;
  }

  body {
    background: ${station};
    color: white;
    font-family: ${font};
    font-weight: 500;
    min-height: 100dvh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    letter-spacing: -0.02em;
  }

  #root {
    display: flex;
    flex-direction: column;
    background: ${station};
    min-height: 100dvh;
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
  padding-top: ${(p) => (p.$pad ? `${p.$header}px` : '0')};
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  min-height: 100%;
`

const HeaderArea = styled.header`
  min-height: 64px;
  height: auto;
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
  top: ${(p) => p.$header}px;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: ${(p) => (p.$front ? 5 : 0)};
  pointer-events: ${(p) => (p.$hit ? 'auto' : 'none')};
  transition: z-index 0s;
`

const ContentArea = styled.main`
  width: 100%;
  min-height: calc(100% - ${(p) => p.$header}px);
  position: relative;
  z-index: 1;
  pointer-events: ${(p) => (p.$pass ? 'none' : 'auto')};
`

const SHOT = {
  '/': 'kiosk',
  '/photo': 'photo',
  '/video': 'video',
  '/about': 'about',
}

function AppContent() {
  const location = useLocation()
  const shotFromRoute = SHOT[location.pathname]
  const atKiosk = location.pathname === '/'
  const onBlog = location.pathname === '/blog'
  const skipIntro = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // Intro is a first-load ceremony on `/` only. Wall pages (and reduced motion)
  // start already inside the station so going home is a camera move, not a replay.
  const [entered, setEntered] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    return window.location.pathname !== '/'
  })
  const [assetsReady, setAssetsReady] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [bootLeaving, setBootLeaving] = useState(false)
  const [bootGone, setBootGone] = useState(skipIntro)
  const booted = assetsReady && sceneReady
  const arriving = atKiosk && !entered
  const showBoot = arriving && !bootGone
  const shot = arriving ? 'kiosk' : (shotFromRoute || 'kiosk')
  const onPage = Boolean(shotFromRoute && shotFromRoute !== 'kiosk')
  const showPage = onPage && pageReady
  const leaveRef = useRef({ tryLeave: () => false })
  const kioskLeave = useMemo(() => ({
    tryLeave: (to) => leaveRef.current.tryLeave(to),
  }), [])
  const wallPages = useMemo(() => ({
    photo: <PhotoPage />,
    video: <VideoPage />,
    about: <AboutPage />,
  }), [])
  const headerRef = useRef(null)
  const [headerH, setHeaderH] = useState(64)
  usePageMeta()

  useEffect(() => {
    const el = headerRef.current
    if (!el) return undefined
    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      if (h > 0) setHeaderH(h)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [entered])

  useEffect(() => {
    // New route → wait for camera to finish turning to the wall
    setPageReady(!onPage)
  }, [location.pathname, onPage])

  useEffect(() => {
    let alive = true
    preloadStationAssets().then(() => {
      if (alive) setAssetsReady(true)
    })
    return () => { alive = false }
  }, [])

  // First visit: hold loading until scene + assets ready, then fade into the intro.
  // Replays skip the gate once the station is already warm.
  useEffect(() => {
    if (!arriving) {
      setBootGone(true)
      setBootLeaving(false)
      return undefined
    }
    if (booted) {
      if (bootGone) return undefined
      setBootLeaving(true)
      const t = window.setTimeout(() => setBootGone(true), 560)
      return () => window.clearTimeout(t)
    }
    setBootGone(false)
    setBootLeaving(false)
    return undefined
  }, [arriving, booted, bootGone])

  const handleArrive = (pov) => {
    if (pov === 'photo' || pov === 'video' || pov === 'about') {
      setPageReady(true)
    }
  }

  return (
    <KioskLeaveProvider value={kioskLeave}>
    <Layout $pad $header={headerH}>
      <HeaderArea ref={headerRef} $show={entered}>
        <Header />
      </HeaderArea>
      {(!onBlog && (shotFromRoute || arriving || entered)) ? (
        <StationStage $header={headerH} $front={arriving} $hit={!arriving && (entered || !!shotFromRoute)}>
          <Suspense fallback={null}>
            <StationScene
              shot={shot}
              kioskLive={atKiosk && entered}
              dimmed={arriving}
              introReady={booted && bootGone}
              onIntroComplete={() => setEntered(true)}
              onReady={() => setSceneReady(true)}
              onArrive={handleArrive}
              leaveRef={leaveRef}
              wallPages={wallPages}
              wallInteractive={showPage}
              headerH={headerH}
            />
          </Suspense>
        </StationStage>
      ) : null}
      {showBoot ? (
        <BootScreen leaving={bootLeaving} />
      ) : null}
      <ContentArea $header={headerH} $pass={atKiosk || onPage}>
        <Routes>
          <Route path="/" element={null} />
          <Route path="/photo" element={null} />
          <Route path="/video" element={null} />
          <Route path="/about" element={null} />
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
      <GfxProvider>
        <AppContent />
      </GfxProvider>
    </BrowserRouter>
  )
}

export default App
