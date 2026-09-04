import styled, { keyframes, css } from 'styled-components'
import { font, station } from '../styles/theme'
import { SUBWAY_LINES } from '../lib/subwayLines'
import PropTypes from 'prop-types'

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

const pulse = keyframes`
  0%, 100% { opacity: 0.35; transform: scaleX(0.55); }
  50% { opacity: 1; transform: scaleX(1); }
`

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background:
    radial-gradient(ellipse 80% 50% at 50% 110%, rgba(252, 204, 10, 0.08), transparent 55%),
    ${station};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  ${(p) => p.$leaving && css`
    animation: ${fadeOut} 0.55s ease forwards;
    pointer-events: none;
  `}
`

const Bullets = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
  max-width: 280px;
  margin-bottom: 0.35rem;
`

const Bullet = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${font};
  font-weight: 800;
  font-size: 0.72rem;
  color: ${(p) => p.$fg};
  background: ${(p) => p.$bg};
  animation: ${float} 2.4s ease-in-out infinite;
  animation-delay: ${(p) => p.$i * 0.08}s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Word = styled.div`
  font-family: ${font};
  font-weight: 800;
  font-size: clamp(0.9rem, 2.5vw, 1.05rem);
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #fff;
`

const Bar = styled.div`
  width: 160px;
  height: 2px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
  border-radius: 1px;
`

const Fill = styled.div`
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: #fccc0a;
  animation: ${pulse} 1.15s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    width: 70%;
    opacity: 0.85;
  }
`

/** Show a tight set of line bullets — enough vibe, light on phones. */
const BOOT_LINES = SUBWAY_LINES.filter((l) => (
  ['1', 'A', 'C', 'E', 'B', 'D', 'F', 'N', 'Q', 'R', 'G', 'L', '7'].includes(l.line)
))

export default function BootScreen({ leaving = false }) {
  return (
    <Root $leaving={leaving} aria-busy="true" aria-live="polite">
      <Bullets aria-hidden="true">
        {BOOT_LINES.map((line, i) => (
          <Bullet
            key={line.line}
            $bg={line.color}
            $fg={line.textColor}
            $i={i}
          >
            {line.line}
          </Bullet>
        ))}
      </Bullets>
      <Word>Metrotapes</Word>
      <Bar>
        <Fill />
      </Bar>
    </Root>
  )
}

BootScreen.propTypes = {
  leaving: PropTypes.bool,
}
