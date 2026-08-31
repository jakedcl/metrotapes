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
const REST_TILT = { x: -0.1, y: 0.22 }
const REST_Z = THREE.MathUtils.degToRad(-8)

const glow = keyframes`
  0%, 100% {
    filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.4))
            drop-shadow(0 0 12px rgba(252, 204, 10, 0.22));
  }
  50% {
    filter: drop-shadow(0 22px 28px rgba(0, 0, 0, 0.28))
            drop-shadow(0 0 22px rgba(252, 204, 10, 0.38));
  }
`

const CardWrapper = styled.div`
  position: relative;
  z-index: 10;
  overflow: visible;
  animation: ${glow} 3.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const CardContainer = styled(animated.div)`
  cursor: pointer;
  touch-action: none;
  transform-origin: center;
  will-change: transform;
  overflow: visible;
  -webkit-tap-highlight-color: transparent;
`

const Stage = styled.div`
  width: 320px;
  height: 260px;
  overflow: visible;

  @media (min-width: 768px) {
    width: 420px;
    height: 340px;
  }

  canvas {
    display: block;
    overflow: visible;
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

function CardMesh({ tiltRef, reducedMotion }) {
  const group = useRef()
  const texture = useLoader(THREE.TextureLoader, '/metrocard.png')
  const shape = useMemo(() => createMetroCardShape(), [])
  const extrude = useMemo(() => ({
    depth: CARD_DEPTH,
    bevelEnabled: false,
  }), [])

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    const pointer = tiltRef.current
    const idleX = reducedMotion ? REST_TILT.x : REST_TILT.x + Math.sin(t * 0.7) * 0.1
    const idleY = reducedMotion ? REST_TILT.y : REST_TILT.y + Math.sin(t * 0.52) * 0.16
    const idleZ = reducedMotion ? REST_Z : REST_Z + Math.sin(t * 0.4) * 0.05
    const bobY = reducedMotion ? 0 : Math.sin(t * 0.85) * 0.16
    const bobX = reducedMotion ? 0 : Math.sin(t * 0.43) * 0.07

    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, idleX + pointer.x, 0.1)
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, idleY + pointer.y, 0.1)
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, idleZ, 0.1)
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, bobX, 0.08)
    group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, bobY, 0.08)
  })

  return (
    <group ref={group}>
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
  reducedMotion: PropTypes.bool,
}

function LivingLight({ reducedMotion }) {
  const light = useRef()

  useFrame(({ clock }) => {
    if (!light.current || reducedMotion) return
    const t = clock.elapsedTime
    light.current.position.x = Math.cos(t * 0.55) * 2.8
    light.current.position.y = 1.4 + Math.sin(t * 0.4) * 1.1
    light.current.position.z = 3.2
  })

  return <pointLight ref={light} intensity={0.7} color="#fff3c4" distance={12} />
}

LivingLight.propTypes = {
  reducedMotion: PropTypes.bool,
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function CardScene({ tiltRef, reducedMotion }) {
  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.4, 2.8, 4]} intensity={1.2} />
      <directionalLight position={[-2, -1, 2]} intensity={0.3} />
      <LivingLight reducedMotion={reducedMotion} />
      <CardMesh tiltRef={tiltRef} reducedMotion={reducedMotion} />
    </>
  )
}

CardScene.propTypes = {
  tiltRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
  reducedMotion: PropTypes.bool,
}

const MetroCard = forwardRef(({ onSwipeComplete, className }, ref) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const tiltRef = useRef({ x: 0, y: 0 })
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
    if (reducedMotion) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1
    tiltRef.current = {
      x: -ny * 0.18,
      y: nx * 0.24,
    }
  }

  const handlePointerLeave = () => {
    tiltRef.current = { x: 0, y: 0 }
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
                camera={{ position: [0, 0, 7.2], fov: 26 }}
                style={{ background: 'transparent' }}
                onCreated={({ gl }) => {
                  gl.domElement.addEventListener('webglcontextlost', (event) => {
                    event.preventDefault()
                    setUse3d(false)
                  })
                }}
              >
                <CardScene tiltRef={tiltRef} reducedMotion={reducedMotion} />
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
