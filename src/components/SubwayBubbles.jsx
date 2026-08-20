import { useMemo } from 'react'
import styled, { keyframes } from 'styled-components'

const Container = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 0.22;
`

const drift = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(var(--dx), var(--dy), 0) scale(1.04); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
`

const Circle = styled.div`
  position: absolute;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 700;
  color: ${props => props.$textColor || 'white'};
  letter-spacing: -0.04em;
  box-shadow:
    0 0 18px ${props => props.$glow || 'transparent'},
    0 4px 10px rgba(0, 0, 0, 0.25);
  mix-blend-mode: screen;
  animation: ${drift} var(--duration) ease-in-out var(--delay) infinite;
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const SUBWAY_LINES = [
  { line: '1', color: '#EE352E', textColor: 'white' },
  { line: '2', color: '#EE352E', textColor: 'white' },
  { line: '3', color: '#EE352E', textColor: 'white' },
  { line: '4', color: '#00933C', textColor: 'white' },
  { line: '5', color: '#00933C', textColor: 'white' },
  { line: '6', color: '#00933C', textColor: 'white' },
  { line: '7', color: '#B933AD', textColor: 'white' },
  { line: 'A', color: '#0039A6', textColor: 'white' },
  { line: 'C', color: '#0039A6', textColor: 'white' },
  { line: 'E', color: '#0039A6', textColor: 'white' },
  { line: 'B', color: '#FF6319', textColor: 'white' },
  { line: 'D', color: '#FF6319', textColor: 'white' },
  { line: 'F', color: '#FF6319', textColor: 'white' },
  { line: 'M', color: '#FF6319', textColor: 'white' },
  { line: 'G', color: '#6CBE45', textColor: 'white' },
  { line: 'J', color: '#996633', textColor: 'white' },
  { line: 'Z', color: '#996633', textColor: 'white' },
  { line: 'L', color: '#A7A9AC', textColor: 'white' },
  { line: 'S', color: '#808183', textColor: 'white' },
  { line: 'Q', color: '#FCCC0A', textColor: 'black' },
  { line: 'R', color: '#FCCC0A', textColor: 'black' },
]

function seeded(index, salt) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export default function SubwayBubbles() {
  const bubbles = useMemo(() => (
    SUBWAY_LINES.map((line, index) => {
      const size = 36 + Math.round(seeded(index, 1) * 18)
      return {
        ...line,
        id: index,
        size,
        left: seeded(index, 2) * 92,
        top: seeded(index, 3) * 88,
        dx: `${(seeded(index, 4) - 0.5) * 70}px`,
        dy: `${(seeded(index, 5) - 0.5) * 80}px`,
        duration: `${16 + seeded(index, 6) * 18}s`,
        delay: `${-seeded(index, 7) * 20}s`,
        fontSize: size > 46 ? '1.35rem' : '1.1rem',
      }
    })
  ), [])

  return (
    <Container aria-hidden="true">
      {bubbles.map(bubble => (
        <Circle
          key={bubble.id}
          $textColor={bubble.textColor}
          $glow={`${bubble.color}66`}
          style={{
            backgroundColor: bubble.color,
            width: bubble.size,
            height: bubble.size,
            left: `${bubble.left}%`,
            top: `${bubble.top}%`,
            fontSize: bubble.fontSize,
            '--dx': bubble.dx,
            '--dy': bubble.dy,
            '--duration': bubble.duration,
            '--delay': bubble.delay,
          }}
        >
          {bubble.line}
        </Circle>
      ))}
    </Container>
  )
}
