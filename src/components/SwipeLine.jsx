/* eslint-disable react/no-unknown-property */
import styled, { keyframes, css } from 'styled-components'
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

const metalFill = css`
  background:
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.16) 0%,
      rgba(255, 255, 255, 0) 48%,
      rgba(0, 0, 0, 0.18) 100%
    ),
    url('/metal.jpg') repeat,
    linear-gradient(
      to right,
      #888 0%,
      #ccc 22%,
      #ccc 78%,
      #888 100%
    );
  background-blend-mode: overlay, multiply, normal;
  box-shadow:
    inset 0 2px 5px rgba(255, 255, 255, 0.3),
    inset 0 -2px 5px rgba(0, 0, 0, 0.5),
    0 1px 3px rgba(0, 0, 0, 0.35);
`

const LineContainer = styled.div`
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
`

const Stage = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: auto;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;

  canvas {
    display: block;
    touch-action: none;
  }
`

const Fallback = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`

const Pillar = styled.div`
  ${metalFill}
  position: absolute;
  right: 26%;
  bottom: 2%;
  width: 14%;
  height: 90%;
  border-radius: 4px 4px 2px 2px;

  @media (max-width: 767px) {
    right: 18%;
    width: 18%;
  }
`

const Beam = styled.div`
  ${metalFill}
  position: absolute;
  left: 16%;
  right: 32%;
  bottom: 44%;
  height: 16%;
  border-radius: 3px;
  overflow: hidden;

  @media (max-width: 767px) {
    left: 8%;
    right: 26%;
    bottom: 42%;
    height: 15%;
  }

  &::after {
    content: '';
    position: absolute;
    left: 8%;
    right: 14%;
    top: 32%;
    height: 28%;
    border-radius: 5px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.72) 0%,
      rgba(20, 20, 20, 0.95) 45%,
      rgba(0, 0, 0, 0.8) 100%
    );
    box-shadow:
      inset 0 3px 4px rgba(0, 0, 0, 0.85),
      0 1px 0 rgba(255, 255, 255, 0.28);
  }
`

const Arm = styled.div`
  ${metalFill}
  position: absolute;
  width: 11px;
  height: 38%;
  left: 38%;
  bottom: 8%;
  border-radius: 6px;
  transform-origin: top center;
  transform: rotate(${(p) => p.$rot}deg);

  @media (max-width: 767px) {
    left: 32%;
    width: 9px;
  }
`

const GleamSweep = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;

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
      rgba(255, 255, 255, 0.2) 50%,
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

function useRoundedBox(width, height, depth, radius, segments = 3) {
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

function createReaderShape(len, height, slotLen, slotH) {
  const s = new THREE.Shape()
  roundedRect(s, -len / 2, -height / 2, len, height, Math.min(0.05, height * 0.22))
  const hole = new THREE.Path()
  roundedRect(hole, -slotLen / 2, -slotH / 2, slotLen, slotH, Math.min(0.02, slotH * 0.4), true)
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

function createLampArrow() {
  const s = new THREE.Shape()
  s.moveTo(-0.62, -0.17)
  s.lineTo(0.06, -0.17)
  s.lineTo(0.06, -0.44)
  s.lineTo(0.68, 0)
  s.lineTo(0.06, 0.44)
  s.lineTo(0.06, 0.17)
  s.lineTo(-0.62, 0.17)
  s.closePath()
  return s
}

function createEntryLabelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f3f3f3'
  ctx.fillRect(0, 0, 512, 160)
  ctx.fillStyle = '#111111'
  ctx.font = 'bold 96px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Entry', 256, 86)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function createLampFaceTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const glow = ctx.createRadialGradient(128, 118, 8, 128, 128, 128)
  glow.addColorStop(0, '#7dff9a')
  glow.addColorStop(0.28, '#22d954')
  glow.addColorStop(0.72, '#0ea338')
  glow.addColorStop(1, '#067a28')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(128, 128, 128, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function Metal({ map, roughness = 0.36, metalness = 0.78, color = '#e6e6e6' }) {
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

function OrbitRig({ orbit, reducedMotion, pivot, children }) {
  const group = useRef()

  useFrame(({ clock }) => {
    if (!group.current) return
    const idle = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.22) * 0.18
    const yaw = orbit.current.yaw + idle
    const pitch = orbit.current.pitch
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, yaw, 0.12)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pitch, 0.12)
  })

  return (
    <group ref={group} position={pivot}>
      <group position={[-pivot[0], -pivot[1], -pivot[2]]}>
        {children}
      </group>
    </group>
  )
}

OrbitRig.propTypes = {
  orbit: PropTypes.shape({ current: PropTypes.object }).isRequired,
  reducedMotion: PropTypes.bool,
  pivot: PropTypes.arrayOf(PropTypes.number).isRequired,
  children: PropTypes.node,
}

function EntryLamp({ position }) {
  const entryMap = useMemo(() => createEntryLabelTexture(), [])
  const lampMap = useMemo(() => createLampFaceTexture(), [])
  const arrow = useMemo(() => createLampArrow(), [])
  const arrowExtrude = useMemo(() => ({
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.006,
    bevelSegments: 1,
  }), [])

  useEffect(() => {
    return () => {
      entryMap.dispose()
      lampMap.dispose()
    }
  }, [entryMap, lampMap])

  return (
    <group position={position}>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.36, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 20]} />
          <meshStandardMaterial color="#141414" roughness={0.32} metalness={0.62} />
        </mesh>
      ))}

      <mesh position={[0, 0.16, 0.01]}>
        <boxGeometry args={[0.44, 0.14, 0.018]} />
        <meshStandardMaterial color="#ececec" roughness={0.48} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.16, 0.02]}>
        <planeGeometry args={[0.42, 0.12]} />
        <meshBasicMaterial map={entryMap} toneMapped={false} />
      </mesh>

      <group position={[0, -0.14, 0.02]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.188, 0.188, 0.036, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.34} metalness={0.78} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.008]}>
          <torusGeometry args={[0.158, 0.016, 10, 32]} />
          <meshStandardMaterial color="#2c2c2c" roughness={0.3} metalness={0.82} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
          <cylinderGeometry args={[0.148, 0.148, 0.022, 32]} />
          <meshStandardMaterial
            color="#0d9a34"
            emissive="#1ad24a"
            emissiveIntensity={0.7}
            roughness={0.35}
            metalness={0}
          />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <circleGeometry args={[0.146, 32]} />
          <meshBasicMaterial map={lampMap} toneMapped={false} />
        </mesh>
        <mesh
          position={[0, 0, 0.03]}
          rotation={[0, 0, -Math.PI * 0.78]}
          scale={0.185}
        >
          <extrudeGeometry args={[arrow, arrowExtrude]} />
          <meshBasicMaterial color="#d9a40f" toneMapped={false} />
        </mesh>
        <pointLight color="#3dff6a" intensity={0.55} distance={1.5} position={[0, 0, 0.2]} />
      </group>
    </group>
  )
}

EntryLamp.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
}

function Tripod({ map }) {
  const len = 1.22
  const r = 0.085
  const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]

  return (
    <group position={[-0.7, 0.58, 0.22]} rotation={[1.22, 0.08, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.32, 16]} />
        <Metal map={map} roughness={0.34} metalness={0.82} />
      </mesh>
      {angles.map((angle) => (
        <group key={angle} rotation={[angle, 0, 0]}>
          <mesh position={[0, len / 2, 0]}>
            <cylinderGeometry args={[r, r, len, 12]} />
            <Metal map={map} roughness={0.34} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

Tripod.propTypes = {
  map: PropTypes.object,
}

function Turnstile({ isMobile, orbit, reducedMotion }) {
  const source = useLoader(THREE.TextureLoader, '/metal.jpg')
  const pillarMap = useMemo(() => cloneMetal(source, 0.55, 2.1), [source])
  const beamMap = useMemo(() => cloneMetal(source, 2.2, 0.45), [source])
  const readerMap = useMemo(() => cloneMetal(source, 1.4, 0.45), [source])
  const armMap = useMemo(() => cloneMetal(source, 0.35, 1.3), [source])

  const pillarW = 0.78
  const pillarH = 2.42
  const pillarD = 0.64
  const beamW = 2.72
  const beamH = 0.42
  const beamD = 0.56
  const readerL = 1.78
  const readerH = 0.4
  const readerD = 0.4
  const slotL = 1.52
  const slotH = 0.085

  const pillarGeo = useRoundedBox(pillarW, pillarH, pillarD, 0.045)
  const footGeo = useRoundedBox(0.9, 0.12, 0.72, 0.03)
  const beamGeo = useRoundedBox(beamW, beamH, beamD, 0.04)
  const readerShape = useMemo(
    () => createReaderShape(readerL, readerH, slotL, slotH),
    [readerL, readerH, slotL, slotH],
  )
  const readerExtrude = useMemo(() => ({
    depth: readerD,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  }), [readerD])
  const arrow = useMemo(() => createArrowShape(), [])
  const arrowExtrude = useMemo(() => ({
    depth: 0.014,
    bevelEnabled: false,
  }), [])

  const pillarX = 1.52
  const beamY = 1.18
  const beamX = -0.22
  const readerX = beamX - 0.12
  const readerY = beamY + beamH / 2 + readerH / 2 - 0.04
  const readerZ = beamD / 2 + readerD / 2 - 0.1
  const scale = isMobile ? 1.02 : 0.95
  const pivot = [0.65, 1.12, 0]

  return (
    <group position={isMobile ? [-0.62, 0.04, 0] : [-0.75, 0, 0]} scale={scale}>
      <OrbitRig orbit={orbit} reducedMotion={reducedMotion} pivot={pivot}>
        <mesh geometry={footGeo} position={[pillarX, 0.06, 0]}>
          <Metal map={pillarMap} roughness={0.46} metalness={0.66} />
        </mesh>

        <mesh geometry={pillarGeo} position={[pillarX, pillarH / 2, 0]}>
          <Metal map={pillarMap} />
        </mesh>

        <EntryLamp position={[pillarX, 1.7, pillarD / 2 + 0.018]} />

        <mesh geometry={beamGeo} position={[beamX, beamY, 0]}>
          <Metal map={beamMap} roughness={0.38} metalness={0.76} />
        </mesh>

        <group position={[readerX, readerY, readerZ]}>
          <mesh position={[0, 0, -readerD / 2]}>
            <extrudeGeometry args={[readerShape, readerExtrude]} />
            <Metal map={readerMap} roughness={0.32} metalness={0.82} color="#f0f0f0" />
          </mesh>

          <mesh>
            <boxGeometry args={[slotL * 0.98, slotH * 0.92, readerD * 0.78]} />
            <meshStandardMaterial
              color={SLOT_DARK}
              roughness={0.92}
              metalness={0.14}
            />
          </mesh>

          <mesh
            position={[-readerL / 2 + 0.008, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[readerD * 0.55, slotH]} />
            <meshBasicMaterial color={SLOT_DARK} />
          </mesh>

          <mesh
            position={[0.22, readerH * 0.28, readerD / 2 + 0.006]}
            scale={0.2}
          >
            <extrudeGeometry args={[arrow, arrowExtrude]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.55} metalness={0.22} />
          </mesh>
        </group>

        <Tripod map={armMap} />
      </OrbitRig>
    </group>
  )
}

Turnstile.propTypes = {
  isMobile: PropTypes.bool,
  orbit: PropTypes.shape({ current: PropTypes.object }).isRequired,
  reducedMotion: PropTypes.bool,
}

function GleamLight({ reducedMotion, isMobile }) {
  const light = useRef()

  useFrame(({ clock }) => {
    if (!light.current || reducedMotion) return
    const u = (clock.elapsedTime % 5.5) / 5.5
    const start = isMobile ? -2.4 : -3.1
    const span = isMobile ? 4.6 : 5.6
    light.current.position.x = start + u * span
    light.current.position.y = 2.05
    light.current.position.z = 3.1
  })

  return (
    <pointLight
      ref={light}
      intensity={2.2}
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
    if (isMobile) {
      camera.position.set(-0.05, 2.12, 8.7)
      camera.fov = 34
      camera.lookAt(-0.2, 1.02, 0)
    } else {
      camera.position.set(-0.1, 2.35, 9.6)
      camera.fov = 28
      camera.lookAt(-0.2, 1.0, 0)
    }
    camera.updateProjectionMatrix()
  }, [camera, isMobile])

  return null
}

AimCamera.propTypes = {
  isMobile: PropTypes.bool,
}

function TurnstileScene({ isMobile, reducedMotion, orbit }) {
  return (
    <>
      <AimCamera isMobile={isMobile} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[-3.6, 3.2, 7.4]} intensity={2.05} />
      <directionalLight position={[0.2, 2.4, 8.2]} intensity={0.9} />
      <directionalLight position={[3.2, 4.2, 2.2]} intensity={0.55} />
      <directionalLight position={[-2.2, 0.6, -3.0]} intensity={0.28} />
      <GleamLight reducedMotion={reducedMotion} isMobile={isMobile} />
      <Turnstile isMobile={isMobile} orbit={orbit} reducedMotion={reducedMotion} />
    </>
  )
}

TurnstileScene.propTypes = {
  isMobile: PropTypes.bool,
  reducedMotion: PropTypes.bool,
  orbit: PropTypes.shape({ current: PropTypes.object }).isRequired,
}

function CssTurnstile() {
  return (
    <Fallback>
      <Pillar />
      <Beam />
      <Arm $rot={-48} />
      <Arm $rot={8} />
      <Arm $rot={62} />
      <GleamSweep />
    </Fallback>
  )
}

export default function SwipeLine() {
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
    && window.matchMedia('(max-width: 767px)').matches,
  )
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const orbit = useRef({ yaw: 0, pitch: 0 })
  const drag = useRef({
    pointerId: null,
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
    moved: false,
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      yaw: orbit.current.yaw,
      pitch: orbit.current.pitch,
      moved: false,
    }
  }

  const onPointerMove = (event) => {
    const state = drag.current
    if (state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moved && Math.hypot(dx, dy) < 8) return
    state.moved = true
    orbit.current.yaw = state.yaw + dx * 0.0075
    orbit.current.pitch = THREE.MathUtils.clamp(state.pitch + dy * 0.0038, -0.42, 0.32)
  }

  const onPointerUp = (event) => {
    if (drag.current.pointerId !== event.pointerId) return
    drag.current.pointerId = null
  }

  const onClick = (event) => {
    if (!drag.current.moved) return
    event.preventDefault()
    event.stopPropagation()
    drag.current.moved = false
  }

  return (
    <LineContainer>
      {use3d ? (
        <Stage
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
        >
          <Suspense fallback={<CssTurnstile />}>
            <Canvas
              gl={{ alpha: true, antialias: true }}
              dpr={[1, 2]}
              camera={{
                position: isMobile ? [-0.05, 2.12, 8.7] : [-0.1, 2.35, 9.6],
                fov: isMobile ? 34 : 28,
              }}
              style={{ width: '100%', height: '100%', background: 'transparent', pointerEvents: 'auto' }}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0)
                gl.toneMappingExposure = 1.2
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                  event.preventDefault()
                  setUse3d(false)
                })
              }}
            >
              <TurnstileScene
                isMobile={isMobile}
                reducedMotion={reducedMotion}
                orbit={orbit}
              />
            </Canvas>
          </Suspense>
        </Stage>
      ) : (
        <CssTurnstile />
      )}
    </LineContainer>
  )
}
