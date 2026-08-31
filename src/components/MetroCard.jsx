/* eslint-disable react/no-unknown-property */
import styled, { keyframes } from 'styled-components'
import { useSpring, animated } from '@react-spring/web'
import { Suspense, useMemo, useRef, useState, forwardRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import PropTypes from 'prop-types'

/* MetroCard PNG aspect 1200×759. Thin slab, clipped top-right like the real card. */
const CARD_W = 3.37
const CARD_H = 2.13
const CARD_R = 0.11
const CARD_CLIP = 0.34
const CARD_DEPTH = 0.07
const GOLD = '#d4a017'
const BACK = '#1a1a1a'

const float = keyframes`
  0% { 
    transform: translate(0, 0) scale(1);
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
  }
  50% {
    transform: translate(15px, -30px) scale(1.08);
    filter: drop-shadow(0 24px 32px rgba(0, 0, 0, 0.3));
  }
  100% { 
    transform: translate(0, 0) scale(1);
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
  }
`

const CardWrapper = styled.div`
  position: relative;
  z-index: 10;
  animation: ${float} 3s ease-in-out infinite;
  transform-origin: center;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  &:hover {
    filter: drop-shadow(0 32px 64px rgba(0, 0, 0, 0.25));
    animation-play-state: paused;
  }
`

const CardContainer = styled(animated.div)`
  cursor: pointer;
  touch-action: none;
  transform-origin: center;
  will-change: transform;
  -webkit-tap-highlight-color: transparent;
`

const Stage = styled.div`
  width: 240px;
  height: 170px;

  @media (min-width: 768px) {
    width: 310px;
    height: 220px;
  }

  canvas {
    display: block;
  }
`

const FallbackCard = styled.img`
  height: 140px;
  width: auto;
  user-select: none;
  -webkit-user-drag: none;
  transform: rotate(-2deg);

  @media (min-width: 768px) {
    height: 180px;
  }
`

function createMetroCardShape() {
  const hw = CARD_W / 2
  const hh = CARD_H / 2
  const r = CARD_R
  const clip = CARD_CLIP
  const s = new THREE.Shape()

  s.moveTo(-hw + r, -hh)
  s.lineTo(hw - r, -hh)
  s.quadraticCurveTo(hw, -hh, hw, -hh + r)
  s.lineTo(hw, hh - clip)
  s.lineTo(hw - clip, hh)
  s.lineTo(-hw + r, hh)
  s.quadraticCurveTo(-hw, hh, -hw, hh - r)
  s.lineTo(-hw, -hh + r)
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
  s.closePath()
  return s
}

function CardMesh({ tiltRef }) {
  const group = useRef()
  const texture = useLoader(THREE.TextureLoader, '/metrocard.png')
  const shape = useMemo(() => createMetroCardShape(), [])
  const extrude = useMemo(() => ({
    depth: CARD_DEPTH,
    bevelEnabled: false,
  }), [])

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  useFrame(() => {
    if (!group.current) return
    const { x, y } = tiltRef.current
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, x, 0.12)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, y, 0.12)
  })

  return (
    <group ref={group} rotation={[0, 0, THREE.MathUtils.degToRad(-8)]}>
      <mesh position={[0, 0, -CARD_DEPTH / 2]}>
        <extrudeGeometry args={[shape, extrude]} />
        <meshStandardMaterial color={GOLD} roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, CARD_DEPTH / 2 + 0.012]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial
          map={texture}
          transparent
          depthWrite={false}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0, -CARD_DEPTH / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial color={BACK} roughness={0.8} metalness={0} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

CardMesh.propTypes = {
  tiltRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function CardScene({ tiltRef }) {
  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.4, 2.8, 4]} intensity={1.35} />
      <directionalLight position={[-2, -1, 2]} intensity={0.35} />
      <CardMesh tiltRef={tiltRef} />
    </>
  )
}

CardScene.propTypes = {
  tiltRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
}

const REST_TILT = { x: -0.12, y: 0.28 }

const MetroCard = forwardRef(({ onSwipeComplete, className }, ref) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const tiltRef = useRef({ ...REST_TILT })

  const [{ x }, api] = useSpring(() => ({
    x: 0,
    config: {
      mass: 0.5,
      tension: 180,
      friction: 20
    }
  }))

  const triggerSwipe = () => {
    if (isAnimating) return
    setIsAnimating(true)
    onSwipeComplete?.()

    api.start({
      from: { x: 0 },
      to: { x: window.innerWidth * 1.2 },
      config: {
        duration: 600,
        easing: t => t * (2 - t)
      },
      onRest: () => {
        api.start({ x: 0, immediate: true })
        setIsAnimating(false)
      }
    })
  }

  const handlePointerMove = (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1
    tiltRef.current = {
      x: REST_TILT.x - ny * 0.22,
      y: REST_TILT.y + nx * 0.32,
    }
  }

  const handlePointerLeave = () => {
    tiltRef.current = { ...REST_TILT }
  }

  return (
    <CardWrapper>
      <CardContainer
        onClick={triggerSwipe}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ x }}
        className={className}
        ref={ref}
        role="button"
        aria-label="Swipe MetroCard to enter"
      >
        <Stage>
          {use3d ? (
            <Suspense fallback={<FallbackCard src="/metrocard.png" alt="" />}>
              <Canvas
                gl={{ alpha: true, antialias: true }}
                dpr={[1, 2]}
                camera={{ position: [0, 0, 5.4], fov: 28 }}
                style={{ background: 'transparent' }}
                onCreated={({ gl }) => {
                  gl.domElement.addEventListener('webglcontextlost', (event) => {
                    event.preventDefault()
                    setUse3d(false)
                  })
                }}
              >
                <CardScene tiltRef={tiltRef} />
              </Canvas>
            </Suspense>
          ) : (
            <FallbackCard src="/metrocard.png" alt="" />
          )}
        </Stage>
      </CardContainer>
    </CardWrapper>
  )
})

MetroCard.propTypes = {
  onSwipeComplete: PropTypes.func.isRequired,
  className: PropTypes.string
}

MetroCard.displayName = 'MetroCard'

export default MetroCard
