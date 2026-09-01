/* eslint-disable react/no-unknown-property */
import styled, { keyframes, css } from 'styled-components'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import PropTypes from 'prop-types'

const GOLDEN = '#fff4d4'
const SLOT_DARK = '#141414'

// Real-world proportions in meters (NYC tripod turnstile reference).
const BODY_W = 0.28
const LEG_D = 0.2
const THROAT = 0.78
const H_TALL = 1.0
const H_SHORT = 0.56
const H_BASE = 0.045
const ARM_LEN = 0.5
const ARM_R = 0.019
const SCENE_SCALE = 2.62
const BEVEL = 0.008

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

const CssTallLeg = styled.div`
  ${metalFill}
  position: absolute;
  right: 18%;
  bottom: 2%;
  width: 7%;
  height: 90%;
  border-radius: 3px 3px 2px 2px;
  transform: skewY(-4deg);
  transform-origin: bottom right;

  @media (max-width: 767px) {
    right: 12%;
    width: 9%;
  }
`

const CssShortLeg = styled.div`
  ${metalFill}
  position: absolute;
  left: 12%;
  bottom: 2%;
  width: 6%;
  height: 54%;
  border-radius: 3px 3px 2px 2px;

  @media (max-width: 767px) {
    left: 7%;
    width: 8%;
  }
`

const CssBase = styled.div`
  ${metalFill}
  position: absolute;
  left: 10%;
  right: 16%;
  bottom: 2%;
  height: 3.5%;
  border-radius: 2px;
`

const CssSwipeHead = styled.div`
  ${metalFill}
  position: absolute;
  right: 17%;
  top: 8%;
  width: 10%;
  height: 7%;
  border-radius: 3px;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.28);

  &::after {
    content: '';
    position: absolute;
    left: 12%;
    right: 12%;
    top: 38%;
    height: 18%;
    background: ${SLOT_DARK};
    border-radius: 1px;
  }

  @media (max-width: 767px) {
    right: 11%;
    width: 12%;
  }
`

const CssEntry = styled.div`
  position: absolute;
  right: 17.5%;
  top: 22%;
  width: 6.5%;
  height: 14%;
  background: #000;
  border: 1px solid #fff;
  border-radius: 2px;

  @media (max-width: 767px) {
    right: 12%;
    width: 8%;
  }
`

const Arm = styled.div`
  ${metalFill}
  position: absolute;
  width: 6px;
  height: 38%;
  left: 42%;
  bottom: 18%;
  border-radius: 4px;
  transform-origin: left center;
  transform: rotateZ(${(p) => p.$rot}deg);

  @media (max-width: 767px) {
    left: 36%;
    width: 5px;
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
  const width = 1024
  const height = 320
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  const border = 9
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = border
  ctx.lineJoin = 'miter'
  ctx.strokeRect(border / 2, border / 2, width - border, height - border)

  const label = 'Entry'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.03em'

  const padX = 52
  const padY = 24
  const maxW = width - border * 2 - padX * 2
  const maxH = height - border * 2 - padY * 2
  let size = maxH * 1.18
  for (let i = 0; i < 10; i += 1) {
    ctx.font = `bold ${size}px Helvetica, "Helvetica Neue", Arial, sans-serif`
    const metrics = ctx.measureText(label)
    const textW = metrics.width
    const textH = (metrics.actualBoundingBoxAscent || size * 0.72)
      + (metrics.actualBoundingBoxDescent || size * 0.18)
    const scale = Math.min(maxW / textW, maxH / textH, 1.08)
    if (Math.abs(1 - scale) < 0.015) break
    size *= scale
  }

  ctx.font = `bold ${size}px Helvetica, "Helvetica Neue", Arial, sans-serif`
  const metrics = ctx.measureText(label)
  const ascent = metrics.actualBoundingBoxAscent || size * 0.72
  const descent = metrics.actualBoundingBoxDescent || size * 0.18
  const y = (height - (ascent + descent)) / 2 + ascent
  ctx.fillText(label, width / 2, y)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  tex.needsUpdate = true
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

function Metal({ map, roughness = 0.4, metalness = 0.76, color = '#dedede' }) {
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

function EntryPanel({ position }) {
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

  useEffect(() => () => {
    entryMap.dispose()
    lampMap.dispose()
  }, [entryMap, lampMap])

  return (
    <group position={position}>
      <mesh position={[0, 0.14, 0.004]}>
        <boxGeometry args={[0.2, 0.064, 0.01]} />
        <meshStandardMaterial color="#050505" roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.14, 0.01]}>
        <planeGeometry args={[0.2, 0.064]} />
        <meshBasicMaterial map={entryMap} toneMapped={false} />
      </mesh>

      <group position={[0, 0.04, 0.012]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.086, 0.086, 0.018, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.34} metalness={0.78} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.005]}>
          <cylinderGeometry args={[0.068, 0.068, 0.012, 32]} />
          <meshStandardMaterial
            color="#0d9a34"
            emissive="#1ad24a"
            emissiveIntensity={0.65}
            roughness={0.35}
            metalness={0}
          />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[0.067, 32]} />
          <meshBasicMaterial map={lampMap} toneMapped={false} />
        </mesh>
        <mesh
          position={[0, 0, 0.016]}
          rotation={[0, 0, -Math.PI * 0.78]}
          scale={0.085}
        >
          <extrudeGeometry args={[arrow, arrowExtrude]} />
          <meshBasicMaterial color="#d9a40f" toneMapped={false} />
        </mesh>
        <pointLight color="#3dff6a" intensity={0.35} distance={0.9} position={[0, 0, 0.1]} />
      </group>
    </group>
  )
}

EntryPanel.propTypes = {
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
}

function SwipeHead({ map, position, rotation = [0, 0, 0] }) {
  const housingGeo = useRoundedBox(0.16, 0.034, 0.1, 0.004)
  const lipGeo = useRoundedBox(0.14, 0.008, 0.084, 0.002)

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={housingGeo} position={[0, 0.017, 0]}>
        <Metal map={map} roughness={0.36} metalness={0.8} color="#ececec" />
      </mesh>
      <mesh geometry={lipGeo} position={[0, 0.036, 0]}>
        <Metal map={map} roughness={0.32} metalness={0.84} color="#f4f4f4" />
      </mesh>
      <mesh position={[0, 0.038, 0]}>
        <boxGeometry args={[0.11, 0.006, 0.048]} />
        <meshStandardMaterial color={SLOT_DARK} roughness={0.92} metalness={0.06} />
      </mesh>
      <mesh position={[-0.048, 0.038, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.048, 0.005]} />
        <meshBasicMaterial color={SLOT_DARK} />
      </mesh>
      <pointLight color={GOLDEN} intensity={0.45} distance={1.1} position={[0, 0.08, 0.12]} />
    </group>
  )
}

SwipeHead.propTypes = {
  map: PropTypes.object,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
  rotation: PropTypes.arrayOf(PropTypes.number),
}

function Rotor({ map, position }) {
  const armAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.036, 0.036, 0.055, 20]} />
        <Metal map={map} roughness={0.38} metalness={0.82} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.044, 16, 12]} />
        <Metal map={map} roughness={0.36} metalness={0.84} />
      </mesh>
      {armAngles.map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[ARM_LEN / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[ARM_R, ARM_R, ARM_LEN, 18]} />
            <Metal map={map} roughness={0.38} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

Rotor.propTypes = {
  map: PropTypes.object,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
}

function Frame({ map }) {
  const tallZ = THROAT / 2 + LEG_D / 2
  const shortZ = -(THROAT / 2 + LEG_D / 2)
  const lowerH = H_TALL * 0.68
  const slopeH = H_TALL - lowerH
  const slopeAngle = 0.42

  const baseGeo = useRoundedBox(BODY_W + 0.04, H_BASE, THROAT + LEG_D * 2 + 0.06, BEVEL)
  const tallLowerGeo = useRoundedBox(BODY_W, lowerH, LEG_D, BEVEL)
  const tallSlopeGeo = useRoundedBox(BODY_W, slopeH * 1.05, LEG_D * 0.92, BEVEL)
  const shortGeo = useRoundedBox(BODY_W, H_SHORT, LEG_D, BEVEL)
  const shortCapGeo = useRoundedBox(BODY_W * 0.92, 0.05, LEG_D * 0.88, BEVEL)

  return (
    <group>
      <mesh geometry={baseGeo} position={[0, H_BASE / 2, 0]}>
        <Metal map={map} roughness={0.44} metalness={0.7} />
      </mesh>

      <mesh geometry={tallLowerGeo} position={[0, H_BASE + lowerH / 2, tallZ]}>
        <Metal map={map} />
      </mesh>

      <mesh
        geometry={tallSlopeGeo}
        position={[0, H_BASE + lowerH + slopeH * 0.42, tallZ + 0.012]}
        rotation={[slopeAngle, 0, 0]}
      >
        <Metal map={map} roughness={0.38} metalness={0.78} />
      </mesh>

      <mesh geometry={shortGeo} position={[0, H_BASE + H_SHORT / 2, shortZ]}>
        <Metal map={map} />
      </mesh>

      <mesh
        geometry={shortCapGeo}
        position={[0, H_BASE + H_SHORT + 0.024, shortZ]}
      >
        <Metal map={map} roughness={0.38} metalness={0.78} color="#e8e8e8" />
      </mesh>
    </group>
  )
}

Frame.propTypes = {
  map: PropTypes.object,
}

function Turnstile({ isMobile, orbit, reducedMotion }) {
  const source = useLoader(THREE.TextureLoader, '/metal.jpg')
  const bodyMap = useMemo(() => cloneMetal(source, 0.45, 1.8), [source])
  const readerMap = useMemo(() => cloneMetal(source, 0.7, 0.35), [source])
  const armMap = useMemo(() => cloneMetal(source, 0.3, 1.2), [source])

  const tallZ = THROAT / 2 + LEG_D / 2
  const lowerH = H_TALL * 0.68
  const slopeH = H_TALL - lowerH
  const slopeAngle = 0.42
  const slopeCenterY = H_BASE + lowerH + slopeH * 0.42
  const slopeCenterZ = tallZ + 0.012
  const pivot = [0, H_BASE + 0.48, 0]
  const scale = isMobile ? 1.12 : 1.08

  return (
    <group position={isMobile ? [-0.52, 0.04, 0] : [-0.64, 0, 0]} scale={SCENE_SCALE * scale}>
      <OrbitRig orbit={orbit} reducedMotion={reducedMotion} pivot={pivot}>
        <Frame map={bodyMap} />

        <EntryPanel position={[0, H_BASE + 0.62, tallZ + LEG_D / 2 + 0.006]} />

        <SwipeHead
          map={readerMap}
          position={[0, slopeCenterY + 0.04, slopeCenterZ + 0.04]}
          rotation={[slopeAngle, 0, 0]}
        />

        <Rotor
          map={armMap}
          position={[0, H_BASE + 0.48, tallZ - LEG_D / 2 - 0.02]}
        />
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
    light.current.position.y = 2.45
    light.current.position.z = 2.8
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
      camera.position.set(-0.18, 2.08, 6.85)
      camera.fov = 32
      camera.lookAt(-0.22, 1.34, 0.18)
    } else {
      camera.position.set(-0.28, 2.14, 7.05)
      camera.fov = 26
      camera.lookAt(-0.22, 1.38, 0.18)
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
      <directionalLight position={[-0.7, 5.4, 2.6]} intensity={0.85} />
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
      <CssBase />
      <CssTallLeg />
      <CssShortLeg />
      <CssEntry />
      <CssSwipeHead />
      <Arm $rot={0} />
      <Arm $rot={120} />
      <Arm $rot={240} />
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
  const orbit = useRef({ yaw: 0.42, pitch: 0.08 })
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
                position: isMobile ? [-0.18, 2.08, 6.85] : [-0.28, 2.14, 7.05],
                fov: isMobile ? 32 : 26,
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
