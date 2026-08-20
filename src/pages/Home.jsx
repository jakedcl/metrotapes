import { Link } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { useSpring, animated } from '@react-spring/web'
import { theme } from '../styles/theme'

const Container = styled.div`
  padding: 2rem;
  color: white;
  max-width: 1200px;
  margin: 0 auto;
  height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;

  @media (max-width: 480px) {
    padding: 1rem;
  }
`

export const Machine = styled.div`
  width: 90%;
  max-width: min(800px, 95vh);
  aspect-ratio: 4/3;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 28%),
    linear-gradient(180deg, #9B9B9B 0%, #5c5c5c 100%);
  border-radius: 10px;
  padding: 16px;
  box-shadow:
    0 28px 50px rgba(0, 0, 0, 0.5),
    0 12px 22px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 2px 2px rgba(255, 255, 255, 0.22);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 16px;
  position: relative;
  border: 2px solid #555;
  transform: perspective(1000px) rotateX(2deg);
  transform-origin: center bottom;

  @media (max-width: 480px) {
    width: 95%;
    max-width: none;
    padding: 12px;
    gap: 12px;
    margin-top: -10vh;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.16) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.22) 100%
    );
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    left: 6%;
    right: 6%;
    bottom: -36px;
    height: 40px;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.72), transparent 70%);
    filter: blur(10px);
    z-index: -1;
  }
`

const AnimatedMachine = animated(Machine)

const TopBar = styled.div`
  width: 100%;
  height: 20px;
  background: #111;
  border-radius: 2px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.8),
    0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid #000;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    background: #0f0;
    border-radius: 50%;
    margin-right: 6px;
    box-shadow:
      0 0 6px #0f0,
      0 0 14px #0f0,
      0 0 22px rgba(0, 255, 0, 0.5);
    animation: blink 2s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`

const MainSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  background: rgba(0, 0, 0, 0.18);
  padding: 12px;
  border-radius: 6px;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 2px rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.3);

  @media (max-width: 480px) {
    gap: 6px;
    padding: 8px;
  }
`

const powerOn = keyframes`
  0% {
    opacity: 0;
    filter: brightness(3);
    transform: scaleY(0.02);
  }
  35% {
    opacity: 1;
    filter: brightness(1.6);
    transform: scaleY(1);
  }
  100% {
    opacity: 1;
    filter: brightness(1);
    transform: scaleY(1);
  }
`

const Screen = styled.div`
  background: #000 url('https://i.ytimg.com/vi/trA9owC00HI/hqdefault.jpg') center / cover;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.8),
    0 0 28px rgba(180, 200, 255, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.1);
  border: 4px solid #444;
  aspect-ratio: 16/9;
  flex: 1;
  animation: ${powerOn} 0.7s ease-out both;
  animation-delay: 0.35s;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.12) 0%,
      transparent 22%,
      transparent 78%,
      rgba(0, 0, 0, 0.22) 100%
    );
    z-index: 1;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 2px,
      rgba(0, 0, 0, 0.14) 2px,
      rgba(0, 0, 0, 0.14) 3px
    );
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const VideoContainer = styled.div`
  width: 110%;
  height: 100%;
  margin-left: -5%;
`

const Video = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  transform: scale(1.05);
  background: #000;
`

const ButtonSection = styled.div`
  display: flex;
  gap: 0.5rem;
  width: 100%;
  justify-content: center;
  padding-top: 0.25rem;

  @media (max-width: 480px) {
    gap: 0.375rem;
    padding-top: 0.125rem;
  }
`

const NavButton = styled(Link)`
  flex: 1;
  min-width: 0;
  height: 52px;
  background: ${props => props.color};
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-decoration: none;
  font-family: ${theme.font};
  font-weight: 800;
  font-size: 1.45rem;
  letter-spacing: -0.03em;
  text-transform: lowercase;
  position: relative;
  transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 0 16px ${props => props.color}33,
    inset 0 1px 0 rgba(255, 255, 255, 0.22);

  @media (max-width: 480px) {
    height: 44px;
    font-size: 1.15rem;
  }

  &:hover {
    filter: brightness(1.1);
    color: white;
    transform: translateY(-2px);
    box-shadow:
      0 6px 12px rgba(0, 0, 0, 0.4),
      0 0 22px ${props => props.color}55,
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
  }

  &:active {
    filter: brightness(0.9);
    transform: translateY(1px);
    color: white;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  &:visited {
    color: white;
  }
`

export default function Home() {
  const machineSpring = useSpring({
    from: { opacity: 0, transform: 'scale(0.92) translateY(36px)' },
    to: { opacity: 1, transform: 'scale(1) translateY(0px)' },
    config: {
      mass: 1,
      tension: 210,
      friction: 20
    },
    delay: 250
  })

  return (
    <Container>
      <AnimatedMachine style={machineSpring}>
        <TopBar />
        <MainSection>
          <Screen>
            <VideoContainer>
              <Video
                src="https://www.youtube.com/embed/trA9owC00HI?autoplay=1&mute=1&controls=0&loop=1&playlist=trA9owC00HI&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&start=8&enablejsapi=0&origin=metrotapes.com&widget_referrer=metrotapes.com&color=white&disablekb=1&fs=0&version=3&autohide=1"
                title="Machine Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                frameBorder="0"
              />
            </VideoContainer>
          </Screen>
          <ButtonSection>
            <NavButton to="/photo" color={theme.route.photo.color}>
              photo
            </NavButton>
            <NavButton to="/video" color={theme.route.video.color}>
              video
            </NavButton>
            <NavButton to="/about" color={theme.route.about.color}>
              about
            </NavButton>
          </ButtonSection>
        </MainSection>
      </AnimatedMachine>
    </Container>
  )
}
