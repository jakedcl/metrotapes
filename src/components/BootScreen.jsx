import styled, { keyframes, css } from 'styled-components'
import { font, signage, station } from '../styles/theme'
import { SUBWAY_LINES } from '../lib/subwayLines'
import PropTypes from 'prop-types'

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

/* Hard on/off — platform lamps, not a soft SaaS pulse. */
const lamp = keyframes`
  0%, 100% { opacity: 0.18; }
  40%, 60% { opacity: 1; }
`

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background: ${station};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  ${(p) => p.$leaving && css`
    animation: ${fadeOut} 0.55s ease forwards;
    pointer-events: none;
  `}
`

const Strip = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  max-width: 220px;
`

const Bullet = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${font};
  font-weight: 800;
  font-size: 0.65rem;
  line-height: 1;
  color: ${(p) => p.$fg};
  background: ${(p) => p.$bg};
`

const Brand = styled.div`
  font-family: ${font};
  font-weight: 700;
  font-size: clamp(1.6rem, 5vw, 1.9rem);
  letter-spacing: 0.02em;
  line-height: 1;
  color: #fff;
`

const Status = styled.div`
  font-family: ${signage};
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fccc0a;
`

const Track = styled.div`
  display: flex;
  gap: 3px;
  width: 148px;
`

const Seg = styled.div`
  flex: 1;
  height: 4px;
  background: #fccc0a;
  opacity: 0.18;
  animation: ${lamp} 1.05s steps(1, end) infinite;
  animation-delay: ${(p) => p.$i * 0.09}s;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: ${(p) => (p.$i < 5 ? 1 : 0.18)};
  }
`

/** Tight set — strip map, not a confetti pile. */
const BOOT_LINES = SUBWAY_LINES.filter((l) => (
  ['A', 'C', 'E', '1', '2', '3', 'N', 'Q', 'R', 'L', 'G', '7'].includes(l.line)
))

const SEGS = 12

export default function BootScreen({ leaving = false }) {
  return (
    <Root $leaving={leaving} aria-busy="true" aria-live="polite">
      <Strip aria-hidden="true">
        {BOOT_LINES.map((line) => (
          <Bullet
            key={line.line}
            $bg={line.color}
            $fg={line.textColor}
          >
            {line.line}
          </Bullet>
        ))}
      </Strip>
      <Brand>metrotapes</Brand>
      <Status>Please wait</Status>
      <Track aria-hidden="true">
        {Array.from({ length: SEGS }, (_, i) => (
          <Seg key={i} $i={i} />
        ))}
      </Track>
    </Root>
  )
}

BootScreen.propTypes = {
  leaving: PropTypes.bool,
}
