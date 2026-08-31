/* eslint-disable react/no-unknown-property */
import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import styled, { keyframes } from 'styled-components'
import PropTypes from 'prop-types'

/**
 * NYC subway globe, built from primitives so it can emit light.
 * Green over cream glass, dark equatorial band, teal iron post with 4 flared fins.
 * Header lamp stays the PNG button.
 */
const IRON = { color: '#1c3d38', roughness: 0.46, metalness: 0.28 }
const IRON_DARK = { color: '#102926', roughness: 0.62, metalness: 0.18 }
const BAND = { color: '#1a1a1a', roughness: 0.35, metalness: 0.58 }

const glow = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
`

const Slot = styled.div`
  position: relative;
  width: 240px;
  height: 360px;
  pointer-events: none;
  overflow: visible;

  @media (min-width: 768px) {
    width: 340px;
    height: 500px;
  }

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 28%;
    width: 200px;
    height: 200px;
    transform: translate(-50%, -50%);
    background: radial-gradient(
      circle,
      rgba(61, 220, 90, 0.45) 0%,
      rgba(61, 220, 90, 0.14) 32%,
      transparent 66%
    );
    pointer-events: none;
    animation: ${glow} 3.6s ease-in-out infinite;

    @media (min-width: 768px) {
      width: 260px;
      height: 260px;
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
      opacity: 0.7;
    }
  }

  canvas {
    position: relative;
    display: block;
    overflow: visible;
  }
`

const FallbackLamp = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function createFinShape() {
  const s = new THREE.Shape()
  s.moveTo(0.04, 0.16)
  s.lineTo(0.14, 0.13)
  s.quadraticCurveTo(0.34, 0.04, 0.4, -0.18)
  s.quadraticCurveTo(0.38, -0.28, 0.22, -0.26)
  s.quadraticCurveTo(0.1, -0.12, 0.05, 0.02)
  s.lineTo(0.04, 0.02)
  s.closePath()
  return s
}

function createTriangleShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.04, 0)
  s.lineTo(0.04, 0)
  s.lineTo(0, 0.065)
  s.closePath()
  return s
}

function LampMesh({ reducedMotion }) {
  const group = useRef()
  const globe = useRef()
  const greenLight = useRef()
  const warmLight = useRef()
  const finShape = useMemo(() => createFinShape(), [])
  const triangleShape = useMemo(() => createTriangleShape(), [])
  const finExtrude = useMemo(() => ({
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  }), [])
  const markExtrude = useMemo(() => ({
    depth: 0.04,
    bevelEnabled: false,
  }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pulse = reducedMotion ? 1 : 0.9 + Math.sin(t * 1.35) * 0.1
    if (greenLight.current) greenLight.current.intensity = 1.15 * pulse
    if (warmLight.current) warmLight.current.intensity = 1.7 * pulse
    if (globe.current && !reducedMotion) {
      globe.current.scale.setScalar(1 + (pulse - 1) * 0.035)
    }
    if (group.current && !reducedMotion) {
      group.current.rotation.y = 0.4 + Math.sin(t * 0.32) * 0.2
      group.current.rotation.x = 0.06 + Math.sin(t * 0.24) * 0.03
    }
  })

  return (
    <group ref={group} position={[0, -0.35, 0]}>
      <group ref={globe} position={[0, 1.22, 0]}>
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#fff4c4" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.48, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#3ddc5a"
            emissive="#1aa83c"
            emissiveIntensity={2.2}
            roughness={0.28}
            metalness={0}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.48, 32, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color="#f4ecd0"
            emissive="#ffe7a0"
            emissiveIntensity={1.45}
            roughness={0.32}
            metalness={0}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.026, 10, 40]} />
          <meshStandardMaterial {...BAND} />
        </mesh>
        <pointLight
          ref={greenLight}
          color="#b8ffc4"
          intensity={1.15}
          distance={5}
          position={[0, 0.18, 0]}
        />
        <pointLight
          ref={warmLight}
          color="#ffe7b0"
          intensity={1.7}
          distance={5}
          position={[0, -0.12, 0]}
        />
      </group>

      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[0.22, 0.16, 0.16, 20]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.14, 0.17, 0.16, 12]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.46, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.4, 0.16, 0.18, 4]} />
        <meshStandardMaterial {...IRON} />
      </mesh>

      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.4, 0]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <mesh position={[0, 0, -0.025]}>
            <extrudeGeometry args={[finShape, finExtrude]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[0.32, 1.18, 0.32]} />
        <meshStandardMaterial {...IRON} />
      </mesh>

      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <mesh
            key={`panel-${i}`}
            position={[Math.cos(a) * 0.165, -0.38, Math.sin(a) * 0.165]}
            rotation={[0, a, 0]}
          >
            <boxGeometry args={[0.03, 0.88, 0.2]} />
            <meshStandardMaterial {...IRON_DARK} />
          </mesh>
        )
      })}

      <mesh position={[0, 0.145, 0.15]}>
        <extrudeGeometry args={[triangleShape, markExtrude]} />
        <meshStandardMaterial color="#071210" />
      </mesh>
      <mesh position={[0, 0.04, 0.17]}>
        <boxGeometry args={[0.1, 0.18, 0.04]} />
        <meshStandardMaterial color="#071210" />
      </mesh>
    </group>
  )
}

LampMesh.propTypes = {
  reducedMotion: PropTypes.bool,
}

function LampScene({ reducedMotion }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2.2, 3, 4]} intensity={0.8} />
      <directionalLight position={[-2, 0.6, 1.4]} intensity={0.22} />
      <LampMesh reducedMotion={reducedMotion} />
    </>
  )
}

LampScene.propTypes = {
  reducedMotion: PropTypes.bool,
}

export default function SubwayLamp() {
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <Slot aria-hidden="true">
      {use3d ? (
        <Suspense fallback={<FallbackLamp src="/lamp.png" alt="" />}>
          <Canvas
            gl={{ alpha: true, antialias: true }}
            dpr={[1, 2]}
            camera={{ position: [1.25, 0.05, 7.6], fov: 24 }}
            style={{ background: 'transparent', overflow: 'visible' }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0)
              gl.domElement.addEventListener('webglcontextlost', (event) => {
                event.preventDefault()
                setUse3d(false)
              })
            }}
          >
            <LampScene reducedMotion={reducedMotion} />
          </Canvas>
        </Suspense>
      ) : (
        <FallbackLamp src="/lamp.png" alt="" />
      )}
    </Slot>
  )
}
