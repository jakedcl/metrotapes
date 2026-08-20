import styled, { keyframes } from 'styled-components'
import { theme } from '../styles/theme'

const drift = keyframes`
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-8%, 6%, 0); }
`

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${theme.z.atmosphere};
  pointer-events: none;
  overflow: hidden;
`

/** Dirty air over the line signals. This is what makes them recede. */
const Haze = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(9, 10, 14, 0.58);
`

const StationLight = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 50% at 50% -18%, rgba(255, 220, 150, 0.2), transparent 58%),
    radial-gradient(ellipse 50% 28% at 12% 100%, rgba(252, 204, 10, 0.08), transparent 70%),
    radial-gradient(ellipse 48% 26% at 92% 108%, rgba(0, 57, 166, 0.1), transparent 70%);
`

const Tiles = styled.div`
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
  background-size: 72px 36px;
  mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, #000 8%, transparent 78%);
`

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 22%, rgba(0, 0, 0, 0.55) 100%),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.35), transparent 22%, transparent 62%, rgba(0, 0, 0, 0.5));
`

const Grain = styled.div`
  position: fixed;
  inset: -20%;
  z-index: ${theme.z.grain};
  pointer-events: none;
  opacity: 0.11;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  background-size: 160px 160px;
  animation: ${drift} 1.1s steps(2) infinite;
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export default function Atmosphere() {
  return (
    <>
      <Root aria-hidden="true">
        <Haze />
        <Tiles />
        <StationLight />
        <Vignette />
      </Root>
      <Grain aria-hidden="true" />
    </>
  )
}
