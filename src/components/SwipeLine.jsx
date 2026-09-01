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
  const housingMap = useMemo(() => cloneMetal(source, 1.6, 0.55), [source])
  const deckMap = useMemo(() => cloneMetal(source, 2.6, 0.8), [source])
  const wedgeMap = useMemo(() => cloneMetal(source, 0.9, 0.45), [source])

  const vh = viewport.height
  const vw = viewport.width
  const deckW = vw * 1.16
  const deckH = vh * 0.2
  const deckD = vh * 0.42
  const len = isMobile ? vw * 0.62 : vw * 0.58
  const railH = vh * 0.62
  const railW = vh * 0.28
  const slot = vh * 0.11
  const railR = Math.min(railW, railH) * 0.22
  const yaw = isMobile ? 0.52 : 0.58
  const xShift = isMobile ? -vw * 0.06 : -vw * 0.12

  const deckGeo = useRoundedBox(deckW, deckH, deckD, 0.08, 3)
  const railGeo = useRoundedBox(len, railH, railW, railR, 4)
  const arrow = useMemo(() => createArrowShape(), [])
  const wedge = useMemo(() => createWedgeShape(), [])
  const arrowExtrude = useMemo(() => ({
    depth: 0.05,
    bevelEnabled: false,
  }), [])
  const wedgeExtrude = useMemo(() => ({
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 1,
  }), [])

  const railZ = (railW + slot) / 2
  const housingY = deckH / 2 + railH / 2 - 0.01
  const wedgeScale = Math.max(0.7, railH * 0.55)

  return (
    <group position={[0, -vh * 0.18, 0.15]}>
      <mesh geometry={deckGeo} position={[vw * 0.04, 0, -0.05]} rotation={[-0.08, 0.02, 0]}>
        <Metal map={deckMap} roughness={0.48} metalness={0.64} />
      </mesh>

      <group position={[xShift, housingY, 0.18]} rotation={[-0.04, yaw, 0]}>
        <mesh geometry={railGeo} position={[0, 0, railZ]}>
          <Metal map={housingMap} />
        </mesh>
        <mesh geometry={railGeo} position={[0, 0, -railZ]}>
          <Metal map={housingMap} />
        </mesh>

        <mesh position={[0, -railH * 0.22, 0]}>
          <boxGeometry args={[len - 0.08, railH * 0.18, slot]} />
          <meshStandardMaterial
            color={SLOT_DARK}
            roughness={0.92}
            metalness={0.18}
          />
        </mesh>
        <mesh position={[0, 0.04, slot / 2 + 0.012]}>
          <boxGeometry args={[len - 0.12, railH * 0.78, 0.025]} />
          <meshStandardMaterial color="#171717" roughness={0.8} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.04, -(slot / 2 + 0.012)]}>
          <boxGeometry args={[len - 0.12, railH * 0.78, 0.025]} />
          <meshStandardMaterial color="#171717" roughness={0.8} metalness={0.3} />
        </mesh>

        <group
          position={[len / 2 - 0.06, railH / 2 - 0.02, 0]}
          scale={wedgeScale}
        >
          <mesh
            position={[0, 0, -railZ / wedgeScale]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <extrudeGeometry args={[wedge, wedgeExtrude]} />
            <Metal map={wedgeMap} />
          </mesh>
          <mesh
            position={[0, 0, railZ / wedgeScale]}
            rotation={[-Math.PI / 2, 0, Math.PI]}
          >
            <extrudeGeometry args={[wedge, wedgeExtrude]} />
            <Metal map={wedgeMap} />
          </mesh>
        </group>

        <mesh
          position={[-len * 0.08, railH * 0.02, railZ + railW / 2 + 0.012]}
          scale={railH * 0.7}
        >
          <extrudeGeometry args={[arrow, arrowExtrude]} />
          <meshStandardMaterial color="#141414" roughness={0.55} metalness={0.25} />
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
    light.current.position.y = 1.35
    light.current.position.z = 2.6
  })

  return (
    <pointLight
      ref={light}
      intensity={2.35}
      color={GOLDEN}
      distance={10}
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
    camera.lookAt(isMobile ? -0.2 : -0.7, 0.12, 0.2)
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
      <ambientLight intensity={0.48} />
      <directionalLight position={[-4.2, 2.1, 6.4]} intensity={1.85} />
      <directionalLight position={[2.4, 4.2, 1.6]} intensity={0.55} />
      <directionalLight position={[3.6, 1.2, 3.2]} intensity={0.38} />
      <directionalLight position={[-2.2, 0.2, -3.4]} intensity={0.22} />
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
                position: isMobile ? [-2.15, 1.55, 4.35] : [-2.9, 1.62, 4.7],
                fov: 30,
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
