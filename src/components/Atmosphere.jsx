import styled, { keyframes } from 'styled-components'
import { theme } from '../styles/theme'

const drift = keyframes`
  0% { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-10%, 8%, 0); }
`

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${theme.z.atmosphere};
  pointer-events: none;
  overflow: hidden;
`

const StationLight = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 55% at 50% -8%, rgba(255, 244, 210, 0.14), transparent 58%),
    radial-gradient(ellipse 40% 30% at 18% 100%, rgba(252, 204, 10, 0.05), transparent 70%),
    radial-gradient(ellipse 50% 28% at 88% 108%, rgba(0, 57, 166, 0.08), transparent 70%);
`

const Tiles = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 20%, transparent 78%);
`

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, 0.55) 100%);
`

const Grain = styled.div`
  position: fixed;
  inset: -20%;
  z-index: ${theme.z.grain};
  pointer-events: none;
  opacity: 0.055;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>");
  background-size: 180px 180px;
  animation: ${drift} 0.9s steps(2) infinite;
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export default function Atmosphere() {
  return (
    <>
      <Root aria-hidden="true">
        <Tiles />
        <StationLight />
        <Vignette />
      </Root>
      <Grain aria-hidden="true" />
    </>
  )
}
