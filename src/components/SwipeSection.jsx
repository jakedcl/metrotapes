import styled from 'styled-components'
import MetroCard from './MetroCard'
import SwipeLine from './SwipeLine'
import PropTypes from 'prop-types'
import { forwardRef } from 'react'

const SwipeContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 18rem;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
  overflow: visible;
  z-index: 1;

  @media (min-width: 768px) {
    height: 28rem;
  }
`

const CardWrapper = styled.div`
  position: absolute;
  left: 0;
  bottom: 2.4rem;
  z-index: 2;
  pointer-events: auto;
  overflow: visible;
  transform: scale(0.92);
  transform-origin: bottom left;
  transition: transform 0.3s ease;

  @media (min-width: 768px) {
    left: 4%;
    bottom: 7.2rem;
    transform: scale(0.86);
  }
`

const SwipeSection = forwardRef(({ onSwipeComplete }, ref) => {
  return (
    <SwipeContainer>
      <CardWrapper>
        <MetroCard
          onSwipeComplete={onSwipeComplete}
          ref={ref}
          className="metro-card"
        />
      </CardWrapper>
      <SwipeLine />
    </SwipeContainer>
  )
})

SwipeSection.propTypes = {
  onSwipeComplete: PropTypes.func.isRequired,
}

SwipeSection.displayName = 'SwipeSection'

export default SwipeSection 