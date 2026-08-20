import styled, { keyframes } from 'styled-components'
import { theme } from '../styles/theme'

const LineContainer = styled.div`
  width: 100%;
  height: 16rem;
  pointer-events: none;
  position: relative;

  @media (min-width: 768px) {
    height: 17.5rem;
  }
`

const slotPulse = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.85; }
`

const Line = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  background:
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0) 50%,
      rgba(0, 0, 0, 0.18) 100%
    ),
    url('/metal.jpg') repeat,
    linear-gradient(
      to right,
      #888 0%,
      #CCC 20%,
      #CCC 80%,
      #888 100%
    );
  background-blend-mode: overlay, multiply, normal;
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.3),
    inset 0 -2px 5px rgba(0, 0, 0, 0.5),
    0 -1px 2px rgba(0, 0, 0, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
  clip-path: polygon(
    0 100%,
    0 50%,
    60% 50%,
    70% 35%,
    100% 35%,
    100% 100%
  );

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      linear-gradient(
        45deg,
        rgba(255, 255, 255, 0) 30%,
        rgba(255, 255, 255, 0.12) 45%,
        rgba(255, 255, 255, 0.12) 55%,
        rgba(255, 255, 255, 0) 70%
      );
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    left: 63%;
    top: 35%;
    width: 120px;
    height: 3px;
    background: linear-gradient(to right, transparent, ${theme.color.yellow}, transparent);
    box-shadow: 0 0 18px ${theme.color.yellow};
    animation: ${slotPulse} 1.8s ease-in-out infinite;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      opacity: 0.6;
    }
  }
`

export default function SwipeLine() {
  return (
    <LineContainer>
      <Line />
    </LineContainer>
  )
}
