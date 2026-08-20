import styled, { keyframes } from 'styled-components'
import SwipeSection from '../components/SwipeSection'
import SubwaySign from '../components/SubwaySign'
import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { theme } from '../styles/theme'

const Container = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  padding: 1rem;
  cursor: pointer;

  @media (max-width: 768px) {
    justify-content: flex-start;
    padding-top: 16vh;
  }
`

const TitleContainer = styled(animated.div)`
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(0, 0);
  padding: 0;
  width: calc(100% - 3.5rem);
  margin-left: auto;
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.45));

  @media (min-width: 768px) {
    width: auto;
  }
`

const pulse = keyframes`
  0%, 100% { opacity: 0.45; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(6px); }
`

const Hint = styled.div`
  position: absolute;
  right: 8%;
  bottom: 6.25rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: ${theme.color.white};
  font-family: ${theme.font};
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  opacity: ${props => props.$hidden ? 0 : 1};
  transition: opacity 0.4s ease;
  pointer-events: none;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.65);

  @media (min-width: 768px) {
    bottom: 7.5rem;
    right: 12%;
    font-size: 0.95rem;
  }
`

const Chevrons = styled.span`
  color: ${theme.color.yellow};
  font-weight: 800;
  letter-spacing: -0.12em;
  animation: ${pulse} 1.6s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export default function LandingPage({ onUnlock }) {
  const metroCardRef = useRef(null)
  const [isUnlocking, setIsUnlocking] = useState(false)

  const handleContainerClick = (e) => {
    if (e.target.closest('.metro-card')) return
    metroCardRef.current?.click()
  }

  const handleSwipeComplete = () => {
    setIsUnlocking(true)
    onUnlock()
  }

  const signSpring = useSpring({
    opacity: isUnlocking ? 0 : 1,
    transform: isUnlocking
      ? 'translate(20px, -30px) scale(0.95) rotateY(5deg)'
      : 'translate(0px, 0px) scale(1) rotateY(0deg)',
    config: {
      mass: 0.8,
      tension: 200,
      friction: 25
    }
  })

  return (
    <Container onClick={handleContainerClick}>
      <TitleContainer style={signSpring}>
        <SubwaySign />
      </TitleContainer>
      <Hint $hidden={isUnlocking}>
        <Chevrons aria-hidden="true">{'<<<'}</Chevrons>
        swipe to enter
      </Hint>
      <SwipeSection
        onSwipeComplete={handleSwipeComplete}
        ref={metroCardRef}
      />
    </Container>
  )
}

LandingPage.propTypes = {
  onUnlock: PropTypes.func.isRequired,
}
