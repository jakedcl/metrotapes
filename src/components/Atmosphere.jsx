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

const StationLight = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 100% 60% at 50% -12%, rgba(255, 236, 190, 0.22), transparent 62%),
    radial-gradient(ellipse 46% 34% at 16% 100%, rgba(252, 204, 10, 0.07), transparent 72%),
    radial-gradient(ellipse 52% 30% at 90% 110%, rgba(0, 57, 166, 0.1), transparent 72%);
`

const Tiles = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0.55;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 85% 75% at 50% 42%, #000 10%, transparent 82%);
`

const Vignette = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 28%, rgba(0, 0, 0, 0.72) 100%),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.28), transparent 18%, transparent 70%, rgba(0, 0, 0, 0.45));
`

const Grain = styled.div`
  position: fixed;
  inset: -20%;
  z-index: ${theme.z.grain};
  pointer-events: none;
  opacity: 0.09;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>");
  background-size: 180px 180px;
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
        <Tiles />
        <StationLight />
        <Vignette />
      </Root>
      <Grain aria-hidden="true" />
    </>
  )
}
