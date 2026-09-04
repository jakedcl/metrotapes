/**
 * Intro chrome only — the MetroCard wind flight lives in StationScene.
 */
import styled from 'styled-components'
import { useRef } from 'react'
import PropTypes from 'prop-types'
import { font } from '../styles/theme'

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
`

const Skip = styled.button`
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  z-index: 5;
  pointer-events: auto;
  font-family: ${font};
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  border: 0;
  cursor: pointer;
`

export default function StationIntro({ onComplete }) {
  const sent = useRef(false)
  const finish = () => {
    if (sent.current) return
    sent.current = true
    onComplete?.()
  }

  return (
    <Root>
      <Skip type="button" onClick={finish}>Skip</Skip>
    </Root>
  )
}

StationIntro.propTypes = {
  onComplete: PropTypes.func.isRequired,
}
