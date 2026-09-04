import styled from 'styled-components'
import PropTypes from 'prop-types'
import StationScene from '../components/StationScene'

const Stage = styled.div`
  position: relative;
  width: 100%;
  height: ${(p) => (p.$full ? '100vh' : 'calc(100vh - 64px)')};
  min-height: 420px;
  overflow: hidden;
`

export default function Home({ onReady, playIntro, introKey }) {
  return (
    <Stage $full={playIntro}>
      <StationScene onReady={onReady} playIntro={playIntro} introKey={introKey} />
    </Stage>
  )
}

Home.propTypes = {
  onReady: PropTypes.func,
  playIntro: PropTypes.bool,
  introKey: PropTypes.number,
}
