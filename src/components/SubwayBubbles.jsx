import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

const SIZE = 48

const Container = styled.div`
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 0.25;
`

const Circle = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: ${SIZE}px;
  height: ${SIZE}px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: bold;
  font-size: 1.5rem;
  color: ${props => props.$textColor || 'white'};
  background-color: ${props => props.$color};
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  will-change: transform;
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

function randomStart() {
    const maxX = Math.max(0, window.innerWidth - SIZE)
    const maxY = Math.max(0, window.innerHeight - SIZE)
    return {
        x: Math.random() * maxX,
        y: Math.random() * maxY,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
    }
}

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(() =>
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        const onChange = () => setReduced(media.matches)
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [])

    return reduced
}

export default function SubwayBubbles() {
    const reducedMotion = usePrefersReducedMotion()
    const nodeRefs = useRef([])
    const motionRef = useRef(null)
    const [placed] = useState(() =>
        SUBWAY_LINES.map((line, id) => ({
            ...line,
            id,
            ...randomStart(),
        }))
    )

    if (!motionRef.current) {
        motionRef.current = placed.map(({ x, y, vx, vy }) => ({ x, y, vx, vy }))
    }

    useEffect(() => {
        if (reducedMotion) return undefined

        let frame = 0
        const tick = () => {
            const maxX = Math.max(0, window.innerWidth - SIZE)
            const maxY = Math.max(0, window.innerHeight - SIZE)
            const motion = motionRef.current

            for (let i = 0; i < motion.length; i += 1) {
                let { x, y, vx, vy } = motion[i]
                x += vx * 2
                y += vy * 2

                if (x <= 0 || x >= maxX) {
                    vx = -vx * 0.9
                    x = x <= 0 ? 0 : maxX
                }
                if (y <= 0 || y >= maxY) {
                    vy = -vy * 0.9
                    y = y <= 0 ? 0 : maxY
                }

                motion[i] = { x, y, vx, vy }
                const node = nodeRefs.current[i]
                if (node) node.style.transform = `translate(${x}px, ${y}px)`
            }

            frame = requestAnimationFrame(tick)
        }

        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [reducedMotion])

    return (
        <Container>
            {placed.map((bubble, index) => (
                <Circle
                    key={bubble.id}
                    ref={el => { nodeRefs.current[index] = el }}
                    $color={bubble.color}
                    $textColor={bubble.textColor}
                    style={{ transform: `translate(${bubble.x}px, ${bubble.y}px)` }}
                >
                    {bubble.line}
                </Circle>
            ))}
        </Container>
    )
}
