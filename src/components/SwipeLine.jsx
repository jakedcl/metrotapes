/* eslint-disable react/no-unknown-property */
import styled, { keyframes } from 'styled-components'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import PropTypes from 'prop-types'

const DEPTH = 0.26
const TILE = 3.4
const GOLDEN = '#fff4d4'

const gleam = keyframes`
  0% { transform: translateX(-80%) skewX(-18deg); }
  100% { transform: translateX(180%) skewX(-18deg); }
`

const metalClip = `
  clip-path: polygon(
    0 100%,
    0 50%,
    60% 50%,
    70% 35%,
    100% 35%,
    100% 100%
  );

  @media (max-width: 767px) {
    clip-path: polygon(
      0 100%,
      0 56%,
      48% 56%,
      100% 50%,
      100% 100%
    );
  }
`

const LineContainer = styled.div`
  width: 100%;
  height: 16rem;
  pointer-events: none;
  overflow: visible;

  @media (min-width: 768px) {
    height: 17.5rem;
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

const metalUV = {
  generateTopUV(geometry, vertices, a, b, c) {
    return [
      new THREE.Vector2(vertices[a * 3] / TILE, vertices[a * 3 + 1] / TILE),
      new THREE.Vector2(vertices[b * 3] / TILE, vertices[b * 3 + 1] / TILE),
      new THREE.Vector2(vertices[c * 3] / TILE, vertices[c * 3 + 1] / TILE),
    ]
  },
  generateSideWallUV(geometry, vertices, a, b, c, d) {
    const ax = vertices[a * 3]
    const ay = vertices[a * 3 + 1]
    const az = vertices[a * 3 + 2]
    const bx = vertices[b * 3]
    const by = vertices[b * 3 + 1]
    const bz = vertices[b * 3 + 2]
    const cx = vertices[c * 3]
    const cy = vertices[c * 3 + 1]
    const cz = vertices[c * 3 + 2]
    const dx = vertices[d * 3]
    const dy = vertices[d * 3 + 1]
    const dz = vertices[d * 3 + 2]
    if (Math.abs(ay - by) < Math.abs(ax - bx)) {
      return [
        new THREE.Vector2(ax / TILE, 1 - az),
        new THREE.Vector2(bx / TILE, 1 - bz),
        new THREE.Vector2(cx / TILE, 1 - cz),
        new THREE.Vector2(dx / TILE, 1 - dz),
      ]
    }
    return [
      new THREE.Vector2(ay / TILE, 1 - az),
      new THREE.Vector2(by / TILE, 1 - bz),
      new THREE.Vector2(cy / TILE, 1 - cz),
      new THREE.Vector2(dy / TILE, 1 - dz),
    ]
  },
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function createBarShape(w, h, isMobile) {
  const x = (p) => -w / 2 + w * p
  const yFromTop = (p) => h / 2 - h * p
  const s = new THREE.Shape()

  if (isMobile) {
    s.moveTo(x(0), yFromTop(1))
    s.lineTo(x(0), yFromTop(0.56))
    s.lineTo(x(0.48), yFromTop(0.56))
    s.lineTo(x(1), yFromTop(0.5))
    s.lineTo(x(1), yFromTop(1))
  } else {
    s.moveTo(x(0), yFromTop(1))
    s.lineTo(x(0), yFromTop(0.5))
    s.lineTo(x(0.6), yFromTop(0.5))
    s.lineTo(x(0.7), yFromTop(0.35))
    s.lineTo(x(1), yFromTop(0.35))
    s.lineTo(x(1), yFromTop(1))
  }

  s.closePath()
  return s
}

function MetalMesh({ isMobile }) {
  const { viewport } = useThree()
  const texture = useLoader(THREE.TextureLoader, '/metal.jpg')
  const w = viewport.width * 1.06
  const h = viewport.height * 1.08
  const shape = useMemo(
    () => createBarShape(w, h, isMobile),
    [w, h, isMobile],
  )
  const extrude = useMemo(() => ({
    depth: DEPTH,
    bevelEnabled: false,
    UVGenerator: metalUV,
  }), [])

  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8

  return (
    <group rotation={[-0.22, 0.03, 0]} position={[0, -0.04, 0]}>
      <mesh position={[0, 0, -DEPTH / 2]}>
        <extrudeGeometry args={[shape, extrude]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.38}
          metalness={0.78}
        />
      </mesh>
    </group>
  )
}

MetalMesh.propTypes = {
  isMobile: PropTypes.bool,
}

function GleamLight({ reducedMotion }) {
  const light = useRef()

  useFrame(({ clock, viewport }) => {
    if (!light.current || reducedMotion) return
    const u = (clock.elapsedTime % 5.5) / 5.5
    const span = viewport.width * 1.4
    light.current.position.x = -span * 0.45 + u * span
    light.current.position.y = 0.55
    light.current.position.z = 2.4
  })

  return (
    <pointLight
      ref={light}
      intensity={1.35}
      color={GOLDEN}
      distance={10}
    />
  )
}

GleamLight.propTypes = {
  reducedMotion: PropTypes.bool,
}

function BarScene({ isMobile, reducedMotion }) {
  return (
    <>
      <ambientLight intensity={0.72} />
      <directionalLight position={[2.6, 3.4, 5]} intensity={1.15} />
      <directionalLight position={[-3.2, 0.6, 2.4]} intensity={0.32} />
      <GleamLight reducedMotion={reducedMotion} />
      <MetalMesh isMobile={isMobile} />
    </>
  )
}

BarScene.propTypes = {
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
              camera={{ position: [0, 0.85, 7.2], fov: 26 }}
              style={{ width: '100%', height: '100%', background: 'transparent', pointerEvents: 'none' }}
              onCreated={({ gl, camera }) => {
                camera.lookAt(0, -0.15, 0)
                gl.domElement.addEventListener('webglcontextlost', (event) => {
                  event.preventDefault()
                  setUse3d(false)
                })
              }}
            >
              <BarScene isMobile={isMobile} reducedMotion={reducedMotion} />
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
