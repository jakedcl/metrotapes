import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { useSpring, animated } from '@react-spring/web'

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
  background: linear-gradient(180deg, #9B9B9B 0%, #666 100%);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.5),
    0 10px 20px rgba(0, 0, 0, 0.4),
    0 5px 10px rgba(0, 0, 0, 0.3),
    inset 0 2px 2px rgba(255, 255, 255, 0.2);
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
    border-radius: 4px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.15) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.2) 100%
    );
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    left: -4px;
    right: -4px;
    bottom: -4px;
    height: 10px;
    background: rgba(0, 0, 0, 0.4);
    filter: blur(4px);
    border-radius: 50%;
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
    width: 6px;
    height: 6px;
    background: #0f0;
    border-radius: 50%;
    margin-right: 4px;
    box-shadow: 
      0 0 4px #0f0,
      0 0 8px #0f0;
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
  background: rgba(0, 0, 0, 0.15);
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

const Screen = styled.div`
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.8),
    0 1px 0 rgba(255, 255, 255, 0.1);
  border: 4px solid #444;
  aspect-ratio: 16/9;
  flex: 1;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.1) 0%,
      transparent 20%,
      transparent 80%,
      rgba(0, 0, 0, 0.2) 100%
    );
    z-index: 1;
    pointer-events: none;
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
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 900;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
  text-transform: lowercase;
  position: relative;
  transition: all 0.2s ease;
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  @media (max-width: 480px) {
    height: 44px;
    font-size: 1.2rem;
  }

  &:hover {
    filter: brightness(1.1);
    color: white;
    transform: translateY(-2px);
    box-shadow: 
      0 4px 8px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
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
    from: { opacity: 0, transform: 'scale(0.9) translateY(40px)' },
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
            <NavButton to="/photo" color="#0039A6">
              photo
            </NavButton>
            <NavButton to="/video" color="#00933C">
              video
            </NavButton>
            <NavButton to="/about" color="#996633">
              about
            </NavButton>
          </ButtonSection>
        </MainSection>
      </AnimatedMachine>
    </Container>
  )
}