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
  height: 28rem;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
  overflow: visible;
  z-index: 1;

  @media (min-width: 768px) {
    height: 42rem;
  }
`

const CardWrapper = styled.div`
  position: absolute;
  left: -8px;
  bottom: 4.2rem;
  z-index: 2;
  pointer-events: auto;
  overflow: visible;
  transform: scale(0.52);
  transform-origin: bottom left;
  transition: transform 0.3s ease;

  @media (min-width: 768px) {
    left: 6%;
    bottom: 12rem;
    transform: scale(0.78);
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