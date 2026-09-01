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

function roundedRect(path, x, y, w, h, r, clockwise = false) {
  const rad = Math.min(r, w / 2, h / 2)
  if (clockwise) {
    path.moveTo(x + rad, y)
    path.quadraticCurveTo(x, y, x, y + rad)
    path.lineTo(x, y + h - rad)
    path.quadraticCurveTo(x, y + h, x + rad, y + h)
    path.lineTo(x + w - rad, y + h)
    path.quadraticCurveTo(x + w, y + h, x + w, y + h - rad)
    path.lineTo(x + w, y + rad)
    path.quadraticCurveTo(x + w, y, x + w - rad, y)
    path.closePath()
    return
  }
  path.moveTo(x + rad, y)
  path.lineTo(x + w - rad, y)
  path.quadraticCurveTo(x + w, y, x + w, y + rad)
  path.lineTo(x + w, y + h - rad)
  path.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  path.lineTo(x + rad, y + h)
  path.quadraticCurveTo(x, y + h, x, y + h - rad)
  path.lineTo(x, y + rad)
  path.quadraticCurveTo(x, y, x + rad, y)
  path.closePath()
}

function createHousingShape(width, height, slotW, slotH, slotY) {
  const s = new THREE.Shape()
  roundedRect(s, -width / 2, -height / 2, width, height, Math.min(0.16, height * 0.12), false)
  const hole = new THREE.Path()
  roundedRect(hole, -slotW / 2, slotY - slotH / 2, slotW, slotH, Math.min(0.06, slotH * 0.35), true)
  s.holes.push(hole)
  return s
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
  s.moveTo(0, 0)
  s.lineTo(0.7, 0.28)
  s.lineTo(0.7, -0.28)
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
  const housingMap = useMemo(() => cloneMetal(source, 1.55, 0.5), [source])
  const deckMap = useMemo(() => cloneMetal(source, 2.4, 0.7), [source])
  const wedgeMap = useMemo(() => cloneMetal(source, 0.85, 0.4), [source])

  const vh = viewport.height
  const vw = viewport.width
  const deckW = vw * 1.16
  const deckH = vh * 0.16
  const deckD = vh * 0.38
  const bodyW = isMobile ? vw * 0.68 : vw * 0.56
  const bodyH = vh * 0.72
  const bodyD = vh * 0.42
  const slotW = bodyW * 0.84
  const slotH = bodyH * 0.28
  const slotY = bodyH * 0.02
  const yaw = isMobile ? 0.28 : 0.32
  const xShift = isMobile ? -vw * 0.03 : -vw * 0.09

  const deckGeo = useRoundedBox(deckW, deckH, deckD, 0.07, 3)
  const housingShape = useMemo(
    () => createHousingShape(bodyW, bodyH, slotW, slotH, slotY),
    [bodyW, bodyH, slotW, slotH, slotY],
  )
  const housingExtrude = useMemo(() => ({
    depth: bodyD,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 2,
  }), [bodyD])
  const arrow = useMemo(() => createArrowShape(), [])
  const wedge = useMemo(() => createWedgeShape(), [])
  const arrowExtrude = useMemo(() => ({
    depth: 0.045,
    bevelEnabled: false,
  }), [])
  const wedgeExtrude = useMemo(() => ({
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  }), [])

  const housingY = deckH / 2 + bodyH / 2

  return (
    <group position={[0, -vh * 0.14, 0.18]}>
      <mesh geometry={deckGeo} position={[vw * 0.05, 0, -0.02]} rotation={[-0.08, 0.02, 0]}>
        <Metal map={deckMap} roughness={0.48} metalness={0.64} />
      </mesh>

      <group position={[xShift, housingY, 0.08]} rotation={[-0.2, yaw, 0]}>
        <mesh position={[0, 0, -bodyD / 2]}>
          <extrudeGeometry args={[housingShape, housingExtrude]} />
          <Metal map={housingMap} />
        </mesh>

        <mesh position={[0, slotY, 0]}>
          <boxGeometry args={[slotW * 0.98, slotH * 0.92, bodyD * 0.72]} />
          <meshStandardMaterial
            color={SLOT_DARK}
            roughness={0.92}
            metalness={0.16}
          />
        </mesh>

        <mesh
          position={[slotW * 0.28, slotY, bodyD / 2 + 0.01]}
          scale={Math.max(0.28, bodyH * 0.22)}
        >
          <extrudeGeometry args={[wedge, wedgeExtrude]} />
          <Metal map={wedgeMap} />
        </mesh>

        <mesh
          position={[-bodyW * 0.22, -bodyH * 0.28, bodyD / 2 + 0.01]}
          scale={Math.max(0.2, bodyH * 0.2)}
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
    camera.lookAt(isMobile ? -0.15 : -0.55, 0.55, 0.15)
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
                position: isMobile ? [-1.9, 2.05, 4.5] : [-2.55, 2.15, 4.85],
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
