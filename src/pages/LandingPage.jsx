import styled from 'styled-components'
import SwipeSection from '../components/SwipeSection'
import SubwaySign from '../components/SubwaySign'
import PropTypes from 'prop-types'
import { useRef, useState } from 'react'
import { useSpring, animated } from '@react-spring/web'

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
    padding-top: 20vh;
  }
`

const TitleContainer = styled(animated.div)`
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(0, 0);
  padding: 0;
  width: calc(100% - 5rem);
  margin-left: auto;

  @media (min-width: 768px) {
    width: auto;
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