import styled, { keyframes } from 'styled-components'

const gleam = keyframes`
  0% { transform: translateX(-80%) skewX(-18deg); }
  100% { transform: translateX(180%) skewX(-18deg); }
`

const LineContainer = styled.div`
  width: 100%;
  height: 16rem;
  pointer-events: none;
  overflow: visible;

  @media (min-width: 768px) {
    height: 17.5rem;
  }
`

const Line = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: 
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.15) 0%,
      rgba(255, 255, 255, 0) 50%,
      rgba(0, 0, 0, 0.15) 100%
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

  @media (max-width: 767px) {
    clip-path: polygon(
      0 100%,
      0 54%,
      42% 54%,
      92% 44%,
      100% 44%,
      100% 100%
    );
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 38%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.18) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    pointer-events: none;
    animation: ${gleam} 5.5s ease-in-out infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
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
