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
  right: 20%;
  bottom: 2%;
  width: 6.2%;
  height: 88%;
  border-radius: 4px 4px 2px 2px;

  @media (max-width: 767px) {
    right: 14%;
    width: 8%;
  }
`

const FarBlock = styled.div`
  ${metalFill}
  position: absolute;
  left: 14%;
  bottom: 2%;
  width: 4.8%;
  height: 58%;
  border-radius: 3px 3px 2px 2px;

  @media (max-width: 767px) {
    left: 8%;
    width: 6.5%;
  }
`

const Beam = styled.div`
  ${metalFill}
  position: absolute;
  left: 16%;
  right: 25%;
  bottom: 52%;
  height: 4.2%;
  border-radius: 3px;
  overflow: visible;

  @media (max-width: 767px) {
    left: 10%;
    right: 20%;
    bottom: 50%;
    height: 4.8%;
  }
`

const CssSwipeHead = styled.div`
  ${metalFill}
  position: absolute;
  left: 14%;
  top: -22%;
  width: 44%;
  height: 48%;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 3px 6px 3px 4px;
  box-sizing: border-box;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.28),
    0 1px 3px rgba(0, 0, 0, 0.35);
`

const CssRail = styled.div`
  ${metalFill}
  height: 36%;
  border-radius: 50% / 85%;
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, 0.38),
    inset 0 -2px 3px rgba(0, 0, 0, 0.4);
`

const CssGroove = styled.div`
  height: 18%;
  margin: 0 12% 0 2%;
  border-radius: 1px;
  background: ${SLOT_DARK};
  clip-path: polygon(0 0, 14% 22%, 100% 22%, 100% 78%, 14% 78%, 0 100%);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.85);
`

const Arm = styled.div`
  ${metalFill}
  position: absolute;
  width: 7px;
  height: 50%;
  left: 40%;
  bottom: 4%;
  border-radius: 4px;
  transform-origin: top center;
  transform: rotate(${(p) => p.$rot}deg);

  @media (max-width: 767px) {
    left: 34%;
    width: 6px;
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

function createRailBodyShape(length, width, chamferLen, chamferWidth) {
  const s = new THREE.Shape()
  const hl = length / 2
  const corner = Math.min(0.028, width * 0.14)

  s.moveTo(-hl, chamferWidth)
  s.lineTo(-hl + chamferLen, 0)
  s.lineTo(hl - corner, 0)
  s.quadraticCurveTo(hl, 0, hl, corner)
  s.lineTo(hl, width - corner)
  s.quadraticCurveTo(hl, width, hl - corner, width)
  s.lineTo(-hl + corner, width)
  s.quadraticCurveTo(-hl, width, -hl, width - corner)
  s.lineTo(-hl, chamferWidth)
  s.closePath()
  return s
}

function createRailBodyGeometry(length, width, height, chamferLen, chamferWidth) {
  const shape = createRailBodyShape(length, width, chamferLen, chamferWidth)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 6,
  })
  geo.rotateX(-Math.PI / 2)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  geo.translate(
    -(bb.min.x + bb.max.x) / 2,
    -bb.min.y,
    -bb.min.z,
  )
  geo.computeVertexNormals()
  return geo
}

function mirrorGeometryZ(source) {
  const geo = source.clone()
  geo.scale(1, 1, -1)
  const idx = geo.index
  if (idx) {
    const a = idx.array
    for (let i = 0; i < a.length; i += 3) {
      const tmp = a[i]
      a[i] = a[i + 2]
      a[i + 2] = tmp
    }
    idx.needsUpdate = true
  }
  geo.computeVertexNormals()
  return geo
}

function createRailDomeGeometry(radius, length) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 28, 1, false, 0, Math.PI)
  geo.rotateZ(Math.PI / 2)
  geo.computeVertexNormals()
  return geo
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

function EntryLamp({ position, rotation = [0, 0, 0] }) {
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
    <group position={position} rotation={rotation} scale={0.86}>
      <mesh position={[0, 0.16, 0.01]}>
        <boxGeometry args={[0.44, 0.138, 0.012]} />
        <meshStandardMaterial color="#000000" roughness={0.62} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.16, 0.017]}>
        <planeGeometry args={[0.44, 0.138]} />
        <meshBasicMaterial map={entryMap} toneMapped={false} />
      </mesh>

      <group position={[0, -0.14, 0.02]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.188, 0.188, 0.036, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.34} metalness={0.78} />
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
  rotation: PropTypes.arrayOf(PropTypes.number),
}

function Tripod({ map }) {
  const len = 1.42
  const r = 0.042
  const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]

  return (
    <group position={[-0.1, 1.54, 0.2]} rotation={[1.16, 0.05, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.068, 0.068, 0.2, 20]} />
        <Metal map={map} roughness={0.34} metalness={0.82} />
      </mesh>
      {angles.map((angle) => (
        <group key={angle} rotation={[angle, 0, 0]}>
          <mesh position={[0, len / 2, 0]}>
            <cylinderGeometry args={[r, r, len, 18]} />
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

function SwipeHead({ map, position }) {
  const wellL = 1.14
  const wellW = 0.34
  const wellH = 0.005
  const plateL = 1.06
  const plateW = 0.3
  const plateH = 0.007
  const railL = 1.06
  const railW = 0.176
  const railBodyH = 0.055
  const grooveW = 0.068
  const chamferLen = 0.2
  const chamferWidth = 0.08
  const domeR = railW * 0.36
  const domeL = railL - chamferLen * 0.45
  const railZ = grooveW / 2

  const wellGeo = useRoundedBox(wellL, wellH, wellW, 0.003)
  const plateGeo = useRoundedBox(plateL, plateH, plateW, 0.004)
  const nearBody = useMemo(
    () => createRailBodyGeometry(railL, railW, railBodyH, chamferLen, chamferWidth),
    [railL, railW, railBodyH, chamferLen, chamferWidth],
  )
  const farBody = useMemo(() => mirrorGeometryZ(nearBody), [nearBody])
  const domeGeo = useMemo(() => createRailDomeGeometry(domeR, domeL), [domeR, domeL])

  useEffect(() => () => {
    nearBody.dispose()
    farBody.dispose()
    domeGeo.dispose()
  }, [nearBody, farBody, domeGeo])

  const plateTop = wellH + plateH
  const domeX = chamferLen * 0.18
  const domeY = plateTop + railBodyH
  const domeZ = railZ + railW / 2

  return (
    <group position={position}>
      <mesh geometry={wellGeo} position={[0, wellH / 2, 0]}>
        <Metal map={map} roughness={0.4} metalness={0.74} color="#d8d8d8" />
      </mesh>
      <mesh geometry={plateGeo} position={[0, wellH + plateH / 2, 0]}>
        <Metal map={map} roughness={0.34} metalness={0.8} color="#ececec" />
      </mesh>

      <mesh geometry={nearBody} position={[0, plateTop, railZ]}>
        <Metal map={map} roughness={0.26} metalness={0.88} color="#f3f3f3" />
      </mesh>
      <mesh geometry={farBody} position={[0, plateTop, -railZ]}>
        <Metal map={map} roughness={0.26} metalness={0.88} color="#f3f3f3" />
      </mesh>

      <mesh geometry={domeGeo} position={[domeX, domeY, domeZ]}>
        <Metal map={map} roughness={0.24} metalness={0.9} color="#f6f6f6" />
      </mesh>
      <mesh geometry={domeGeo} position={[domeX, domeY, -domeZ]}>
        <Metal map={map} roughness={0.24} metalness={0.9} color="#f6f6f6" />
      </mesh>

      <mesh position={[chamferLen * 0.42, plateTop + railBodyH * 0.46, 0]}>
        <boxGeometry args={[railL - chamferLen * 0.55, railBodyH * 0.92, grooveW * 0.7]} />
        <meshStandardMaterial
          color={SLOT_DARK}
          roughness={0.95}
          metalness={0.08}
        />
      </mesh>
      <mesh
        position={[-railL / 2 + 0.008, plateTop + railBodyH * 0.42, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[grooveW + chamferWidth * 0.65, railBodyH * 0.9]} />
        <meshBasicMaterial color={SLOT_DARK} />
      </mesh>

      <pointLight
        color={GOLDEN}
        intensity={0.85}
        distance={1.8}
        position={[0.05, 0.28, 0.35]}
      />
    </group>
  )
}

SwipeHead.propTypes = {
  map: PropTypes.object,
  position: PropTypes.arrayOf(PropTypes.number).isRequired,
}

function Turnstile({ isMobile, orbit, reducedMotion }) {
  const source = useLoader(THREE.TextureLoader, '/metal.jpg')
  const pillarMap = useMemo(() => cloneMetal(source, 0.55, 2.1), [source])
  const beamMap = useMemo(() => cloneMetal(source, 2.4, 0.32), [source])
  const readerMap = useMemo(() => cloneMetal(source, 0.9, 0.4), [source])
  const armMap = useMemo(() => cloneMetal(source, 0.35, 1.3), [source])

  const pillarW = 0.28
  const pillarH = 2.58
  const pillarD = 0.32
  const beamW = 3.12
  const beamH = 0.1
  const beamD = 0.24
  const farW = 0.24
  const farH = 1.78
  const farD = 0.28

  const pillarGeo = useRoundedBox(pillarW, pillarH, pillarD, 0.028)
  const pillarFootGeo = useRoundedBox(0.36, 0.06, 0.38, 0.018)
  const beamGeo = useRoundedBox(beamW, beamH, beamD, 0.016)
  const farGeo = useRoundedBox(farW, farH, farD, 0.024)
  const farFootGeo = useRoundedBox(0.32, 0.06, 0.34, 0.018)
  const baseGeo = useRoundedBox(3.28, 0.045, 0.26, 0.014)

  const pillarX = 1.52
  const beamY = 1.62
  const beamX = -0.16
  const beamTop = beamY + beamH / 2
  const farX = beamX - beamW / 2 + farW / 2 + 0.02
  const baseX = (pillarX + farX) / 2
  const readerX = -0.58
  const scale = isMobile ? 1.1 : 1.06
  const pivot = [0.28, 1.32, 0]

  return (
    <group position={isMobile ? [-0.55, 0.06, 0] : [-0.68, 0, 0]} scale={scale}>
      <OrbitRig orbit={orbit} reducedMotion={reducedMotion} pivot={pivot}>
        <mesh geometry={baseGeo} position={[baseX, 0.03, 0]}>
          <Metal map={pillarMap} roughness={0.5} metalness={0.62} />
        </mesh>
        <mesh geometry={pillarFootGeo} position={[pillarX, 0.055, 0]}>
          <Metal map={pillarMap} roughness={0.46} metalness={0.66} />
        </mesh>
        <mesh geometry={farFootGeo} position={[farX, 0.055, 0]}>
          <Metal map={pillarMap} roughness={0.46} metalness={0.66} />
        </mesh>

        <mesh geometry={pillarGeo} position={[pillarX, pillarH / 2, 0]}>
          <Metal map={pillarMap} />
        </mesh>

        <mesh geometry={farGeo} position={[farX, farH / 2, 0]}>
          <Metal map={pillarMap} />
        </mesh>

        <EntryLamp
          position={[
            pillarX - pillarW / 2 - 0.016,
            beamTop + 0.32,
            0,
          ]}
          rotation={[0, -Math.PI / 2, 0]}
        />

        <mesh geometry={beamGeo} position={[beamX, beamY, 0]}>
          <Metal map={beamMap} roughness={0.38} metalness={0.76} />
        </mesh>

        <SwipeHead map={readerMap} position={[readerX, beamTop, 0]} />

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
      camera.position.set(-0.2, 2.08, 7.2)
      camera.fov = 32
      camera.lookAt(-0.28, 1.28, 0)
    } else {
      camera.position.set(-0.32, 2.22, 7.55)
      camera.fov = 26
      camera.lookAt(-0.28, 1.32, 0)
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
      <Pillar />
      <FarBlock />
      <Beam>
        <CssSwipeHead>
          <CssRail />
          <CssGroove />
          <CssRail />
        </CssSwipeHead>
      </Beam>
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
                position: isMobile ? [-0.2, 2.08, 7.2] : [-0.32, 2.22, 7.55],
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
