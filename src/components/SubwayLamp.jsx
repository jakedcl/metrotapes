/* eslint-disable react/no-unknown-property */
import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import styled from 'styled-components'
import PropTypes from 'prop-types'

/**
 * NYC subway globe, built from primitives so it can emit light.
 * Frosted green-over-cream glass, painted iron — not a neon.
 * Header lamp stays the PNG button.
 */
const IRON = { color: '#2f5d52', roughness: 0.72, metalness: 0.1 }
const IRON_DARK = { color: '#1c3f38', roughness: 0.8, metalness: 0.06 }
const BAND = { color: '#2a2a2a', roughness: 0.45, metalness: 0.4 }

const Slot = styled.div`
  position: relative;
  width: 200px;
  height: 520px;
  pointer-events: none;
  overflow: visible;

  @media (min-width: 768px) {
    width: 320px;
    height: 600px;
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
    if (!group.current || reducedMotion) return
    const t = clock.elapsedTime
    group.current.rotation.y = 0.38 + Math.sin(t * 0.2) * 0.1
    group.current.rotation.x = 0.05 + Math.sin(t * 0.16) * 0.02
  })

  return (
    <group ref={group} position={[0, -0.12, 0]}>
      <group position={[0, 1.55, 0]}>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color="#fff4dc"
            emissive="#f0d090"
            emissiveIntensity={0.7}
            roughness={0.4}
            metalness={0}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.48, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#3aaa52"
            emissive="#1f6e34"
            emissiveIntensity={0.55}
            roughness={0.62}
            metalness={0}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.48, 32, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color="#f2ead6"
            emissive="#e2c58a"
            emissiveIntensity={0.38}
            roughness={0.58}
            metalness={0}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.026, 10, 40]} />
          <meshStandardMaterial {...BAND} />
        </mesh>
        <pointLight
          color="#ffe8c2"
          intensity={0.95}
          distance={4.5}
          position={[0, -0.04, 0]}
        />
      </group>

      <mesh position={[0, 1.07, 0]}>
        <cylinderGeometry args={[0.22, 0.16, 0.16, 20]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.93, 0]}>
        <cylinderGeometry args={[0.14, 0.17, 0.16, 12]} />
        <meshStandardMaterial {...IRON} />
      </mesh>
      <mesh position={[0, 0.79, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.4, 0.16, 0.18, 4]} />
        <meshStandardMaterial {...IRON} />
      </mesh>

      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.73, 0]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <mesh position={[0, 0, -0.025]}>
            <extrudeGeometry args={[finShape, finExtrude]} />
            <meshStandardMaterial {...IRON} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[0.3, 2.55, 0.3]} />
        <meshStandardMaterial {...IRON} />
      </mesh>

      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <mesh
            key={`panel-${i}`}
            position={[Math.cos(a) * 0.155, -0.62, Math.sin(a) * 0.155]}
            rotation={[0, a, 0]}
          >
            <boxGeometry args={[0.03, 2.2, 0.18]} />
            <meshStandardMaterial {...IRON_DARK} />
          </mesh>
        )
      })}

      <mesh position={[0, 0.48, 0.15]}>
        <extrudeGeometry args={[triangleShape, markExtrude]} />
        <meshStandardMaterial color="#071210" />
      </mesh>
      <mesh position={[0, 0.38, 0.17]}>
        <boxGeometry args={[0.1, 0.18, 0.04]} />
        <meshStandardMaterial color="#071210" />
      </mesh>
    </group>
  )
}

LampMesh.propTypes = {
  reducedMotion: PropTypes.bool,
}

function LivingLight({ reducedMotion }) {
  const light = useRef()

  useFrame(({ clock }) => {
    if (!light.current || reducedMotion) return
    const t = clock.elapsedTime
    // Slow station key around the post — highlights on fins and square iron, not a spin
    light.current.position.x = Math.cos(t * 0.22) * 2.5
    light.current.position.y = 0.3 + Math.sin(t * 0.16) * 1.2
    light.current.position.z = 0.9 + Math.sin(t * 0.22) * 2.3
  })

  return (
    <pointLight
      ref={light}
      intensity={0.9}
      color="#fff3c4"
      distance={10}
      position={[2.5, 0.3, 0.9]}
    />
  )
}

LivingLight.propTypes = {
  reducedMotion: PropTypes.bool,
}

function LampScene({ reducedMotion }) {
  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight position={[-2.4, 3.2, 3.6]} intensity={0.85} />
      <directionalLight position={[2.2, 1.2, 2]} intensity={0.28} />
      <LivingLight reducedMotion={reducedMotion} />
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
            camera={{ position: [1.5, -0.05, 10.2], fov: 24 }}
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
