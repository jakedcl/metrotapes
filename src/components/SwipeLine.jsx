/* eslint-disable react/no-unknown-property */
import styled, { keyframes } from 'styled-components'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import PropTypes from 'prop-types'

const GOLDEN = '#fff4d4'
const SLOT_DARK = '#141414'

const gleam = keyframes`
  0% { transform: translateX(-80%) skewX(-18deg); }
  100% { transform: translateX(180%) skewX(-18deg); }
`

const metalClip = `
  clip-path: polygon(
    0 100%,
    0 36%,
    62% 40%,
    100% 78%,
    100% 100%
  );

  @media (max-width: 767px) {
    clip-path: polygon(
      0 100%,
      0 44%,
      52% 48%,
      100% 70%,
      100% 100%
    );
  }
`

const LineContainer = styled.div`
  width: 100%;
  height: 18rem;
  pointer-events: none;
  overflow: visible;

  @media (min-width: 768px) {
    height: 22rem;
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
  ${metalClip}

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

  &::after {
    content: '';
    position: absolute;
    left: 6%;
    width: 58%;
    top: 46%;
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.72) 0%,
      rgba(20, 20, 20, 0.95) 45%,
      rgba(0, 0, 0, 0.8) 100%
    );
    box-shadow:
      inset 0 3px 4px rgba(0, 0, 0, 0.85),
      0 1px 0 rgba(255, 255, 255, 0.28);
    pointer-events: none;
  }
`

const Stage = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;

  canvas {
    display: block;
  }
`

const Gleam = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  ${metalClip}

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
      rgba(255, 255, 255, 0.22) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    animation: ${gleam} 5.5s ease-in-out infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }
`

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function cloneMetal(texture, repeatX, repeatY) {
  const map = texture.clone()
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.repeat.set(repeatX, repeatY)
  map.anisotropy = 8
  map.needsUpdate = true
  return map
}

function useRoundedBox(width, height, depth, radius, segments = 4) {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(width, height, depth, segments, radius),
    [width, height, depth, radius, segments],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function createArrowShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.38, -0.16)
  s.lineTo(0.12, -0.16)
  s.lineTo(0.12, -0.3)
  s.lineTo(0.52, 0)
  s.lineTo(0.12, 0.3)
  s.lineTo(0.12, 0.16)
  s.lineTo(-0.38, 0.16)
  s.closePath()
  return s
}

function createWedgeShape() {
  const s = new THREE.Shape()
  s.moveTo(0, 0.05)
  s.lineTo(1.12, 0.05)
  s.lineTo(1.12, 0.46)
  s.closePath()
  return s
}

function Metal({ map, roughness = 0.42, metalness = 0.72, color = '#c5c5c5' }) {
  return (
    <meshStandardMaterial
      map={map}
      color={color}
      roughness={roughness}
      metalness={metalness}
    />
  )
}

Metal.propTypes = {
  map: PropTypes.object,
  roughness: PropTypes.number,
  metalness: PropTypes.number,
  color: PropTypes.string,
}

function ReaderHousing({ isMobile }) {
  const { viewport } = useThree()
  const source = useLoader(THREE.TextureLoader, '/metal.jpg')
  const housingMap = useMemo(() => cloneMetal(source, 1.8, 0.7), [source])
  const deckMap = useMemo(() => cloneMetal(source, 3.2, 1.35), [source])
  const wedgeMap = useMemo(() => cloneMetal(source, 1.1, 0.55), [source])

  const deckW = viewport.width * 1.18
  const deckH = 0.42
  const deckD = Math.max(2.6, viewport.height * 0.72)
  const len = isMobile ? 6.4 : 7.8
  const railW = isMobile ? 0.7 : 0.82
  const railH = isMobile ? 1.12 : 1.28
  const slot = isMobile ? 0.24 : 0.28
  const railR = 0.2
  const yaw = isMobile ? 0.34 : 0.42
  const xShift = isMobile ? -0.55 : -1.35

  const deckGeo = useRoundedBox(deckW, deckH, deckD, 0.07, 3)
  const railGeo = useRoundedBox(len, railH, railW, railR, 4)
  const arrow = useMemo(() => createArrowShape(), [])
  const wedge = useMemo(() => createWedgeShape(), [])
  const arrowExtrude = useMemo(() => ({
    depth: 0.045,
    bevelEnabled: false,
  }), [])
  const wedgeExtrude = useMemo(() => ({
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  }), [])

  const railZ = (railW + slot) / 2
  const housingY = deckH / 2 + railH / 2 - 0.02

  return (
    <group position={[0, -viewport.height * 0.22, 0]}>
      <mesh geometry={deckGeo} position={[0, 0, -0.15]} rotation={[-0.1, 0.04, 0]}>
        <Metal map={deckMap} roughness={0.5} metalness={0.62} />
      </mesh>

      <group position={[xShift, housingY, 0.22]} rotation={[0, yaw, 0]}>
        <mesh geometry={railGeo} position={[0, 0, railZ]}>
          <Metal map={housingMap} />
        </mesh>
        <mesh geometry={railGeo} position={[0, 0, -railZ]}>
          <Metal map={housingMap} />
        </mesh>

        <mesh position={[0, -railH * 0.28, 0]}>
          <boxGeometry args={[len - 0.12, 0.1, slot]} />
          <meshStandardMaterial
            color={SLOT_DARK}
            roughness={0.92}
            metalness={0.18}
          />
        </mesh>
        <mesh position={[0, 0.06, slot / 2 + 0.01]}>
          <boxGeometry args={[len - 0.16, railH * 0.72, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.78} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.06, -(slot / 2 + 0.01)]}>
          <boxGeometry args={[len - 0.16, railH * 0.72, 0.02]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.78} metalness={0.35} />
        </mesh>

        <mesh
          position={[len / 2 - 0.08, railH / 2 - 0.02, -railZ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <extrudeGeometry args={[wedge, wedgeExtrude]} />
          <Metal map={wedgeMap} />
        </mesh>
        <mesh
          position={[len / 2 - 0.08, railH / 2 - 0.02, railZ]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
        >
          <extrudeGeometry args={[wedge, wedgeExtrude]} />
          <Metal map={wedgeMap} />
        </mesh>

        <mesh
          position={[0.15, 0.08, railZ + railW / 2 + 0.01]}
          rotation={[0, 0, 0]}
        >
          <extrudeGeometry args={[arrow, arrowExtrude]} />
          <meshStandardMaterial color="#161616" roughness={0.55} metalness={0.25} />
        </mesh>
      </group>
    </group>
  )
}

ReaderHousing.propTypes = {
  isMobile: PropTypes.bool,
}

function GleamLight({ reducedMotion, isMobile }) {
  const light = useRef()

  useFrame(({ clock, viewport }) => {
    if (!light.current || reducedMotion) return
    const u = (clock.elapsedTime % 5.5) / 5.5
    const span = viewport.width * 0.85
    const start = isMobile ? -span * 0.42 : -span * 0.48
    light.current.position.x = start + u * span
    light.current.position.y = 1.7
    light.current.position.z = 2.2
  })

  return (
    <pointLight
      ref={light}
      intensity={2.05}
      color={GOLDEN}
      distance={11}
    />
  )
}

GleamLight.propTypes = {
  reducedMotion: PropTypes.bool,
  isMobile: PropTypes.bool,
}

function AimCamera({ isMobile }) {
  const { camera } = useThree()

  useEffect(() => {
    camera.lookAt(isMobile ? -0.15 : -0.55, 0.22, 0)
  }, [camera, isMobile])

  return null
}

AimCamera.propTypes = {
  isMobile: PropTypes.bool,
}

function ReaderScene({ isMobile, reducedMotion }) {
  return (
    <>
      <AimCamera isMobile={isMobile} />
      <ambientLight intensity={0.52} />
      <directionalLight position={[-3.4, 4.6, 5.2]} intensity={1.45} />
      <directionalLight position={[3.2, 1.6, 2.4]} intensity={0.32} />
      <directionalLight position={[-1.2, 0.4, -2.8]} intensity={0.18} />
      <GleamLight reducedMotion={reducedMotion} isMobile={isMobile} />
      <ReaderHousing isMobile={isMobile} />
    </>
  )
}

ReaderScene.propTypes = {
  isMobile: PropTypes.bool,
  reducedMotion: PropTypes.bool,
}

export default function SwipeLine() {
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
    && window.matchMedia('(max-width: 767px)').matches,
  )
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <LineContainer>
      {use3d ? (
        <Stage>
          <Suspense fallback={<Line />}>
            <Canvas
              gl={{ alpha: true, antialias: true }}
              dpr={[1, 2]}
              camera={{
                position: isMobile ? [-1.7, 2.45, 5.4] : [-2.35, 2.65, 5.85],
                fov: 32,
              }}
              style={{ width: '100%', height: '100%', background: 'transparent', pointerEvents: 'none' }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0)
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                  event.preventDefault()
                  setUse3d(false)
                })
              }}
            >
              <ReaderScene isMobile={isMobile} reducedMotion={reducedMotion} />
            </Canvas>
          </Suspense>
          <Gleam />
        </Stage>
      ) : (
        <Line />
      )}
    </LineContainer>
  )
}
