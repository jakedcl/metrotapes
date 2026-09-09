/* eslint-disable react/no-unknown-property */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass } from 'postprocessing'
import styled from 'styled-components'
import KioskZapScreen from './KioskZapScreen'
import { KIOSK_CAB_H, KIOSK_CAB_W, KIOSK_POST_H, KIOSK_BEZEL, KIOSK_PANEL_W, KIOSK_PANEL_H, KIOSK_SCREEN_W, KIOSK_SCREEN_H, KIOSK_RADIUS_PX, KIOSK_RADIUS_M } from '../lib/kioskSize'
import { WALL_BEZEL, layoutWallFace, getWallFace, setWallFace } from '../lib/wallSize'
import { useGfx } from '../lib/gfxTier'

/**
 * 3D platform. Intro: one continuous MetroCard wind-flight onto litter, then kiosk home.
 *
 * HARD PLAN — one step at a time:
 *  0. Fullscreen Canvas, pointer-events none, overlays stay on top
 *  1. Grey floor + white wall + dark ceiling + locked camera
 *  2. Yellow tactile strip + repeating I-beam pillars
 *  3. Fluorescent tubes + fog
 *  4. Procedural tile + concrete materials
 *  5. Helvetica signage (Exit-style, pillar type)
 *  6. Track trench + simple silver car  ← here
 *  7. Subtle motion, pause after swipe, prefers-reduced-motion
 *
 * Space: +Y up, +X toward the tracks (right), camera looks down −Z.
 */
const LEN = 52
const HEIGHT = 3.22
const WALL_H = HEIGHT - 0.2
const WALL_X = -3.6
const EDGE_X = 1.38
const FLOOR_W = 10.45
const MID_Z = -18
const PILLAR_N = 11
const PILLAR_GAP = 7.5
const PILLAR_Z0 = -0.9
const TRACK_Y = -1.08
const TRACK_X0 = EDGE_X + 0.28
const TRACK_W = WALL_X + FLOOR_W - TRACK_X0
const TRACK_CX = TRACK_X0 + 2.05
const RAIL_HALF = 0.72
const PLAT_W = TRACK_X0 - WALL_X
const TRAIN_Z = -8.4
const TRAIN_REV = 24
const TRAIN_Y = TRACK_Y + 0.14
const WALL_BOARD_Z0 = -3.2

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

function isWallPov(key) {
  return key === 'photo' || key === 'video' || key === 'about'
}

function wallBoardZ(key) {
  const { pitch } = getWallFace()
  if (key === 'photo') return WALL_BOARD_Z0
  if (key === 'video') return WALL_BOARD_Z0 - pitch
  return WALL_BOARD_Z0 - pitch * 2
}

function viewAspect() {
  if (typeof window === 'undefined') return 16 / 9
  const h = Math.max(1, window.innerHeight - 64)
  return window.innerWidth / h
}

/** World-space center of the live CSS page on a wall board. */
function wallContentOrigin(z) {
  const wall = getWallFace()
  return {
    x: WALL_X + 0.04 + 0.038 + 0.004,
    y: (Number.isFinite(wall.boardY) ? wall.boardY : 1.72) + wall.contentY,
    z,
  }
}

/**
 * Park looking straight at the page so it covers the canvas.
 * Cover (not contain): no tile wall around the edges. The overlay then
 * goes fullscreen so you're on the page, not staring at a poster.
 */
function pageShot(z, aspect) {
  const wall = getWallFace()
  const a = Number.isFinite(aspect) && aspect > 0.25 ? aspect : viewAspect()
  const o = wallContentOrigin(z)
  const fov = isMobileViewport() ? 34 : 28
  const vFov = THREE.MathUtils.degToRad(fov)
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * a)
  const dist = Math.min(
    (wall.contentH / 2) / Math.tan(vFov / 2),
    (wall.contentW / 2) / Math.tan(hFov / 2),
  ) * 0.985
  return {
    position: [o.x + dist, o.y, o.z],
    lookAt: [o.x, o.y, o.z],
    fov,
    ease: 1.35,
  }
}

const POVS = {
  approach: {
    position: [-1.35, 1.68, 5.8],
    lookAt: [0.45, 1.12, -8],
    fov: 52,
    ease: 0.82,
  },
  kiosk: {
    // Standing in front, slightly above the screen, looking down
    position: [0.38, 1.54, -2.18],
    lookAt: [0.38, 1.08, -4.28],
    fov: 52,
    ease: 1.35,
  },
  kioskMobile: {
    position: [0.38, 1.48, -2.0],
    lookAt: [0.38, 1.1, -4.35],
    fov: 54,
    ease: 1.35,
  },
  // Over the tracks, near the far wall — train + trench + rat, stairs back-left
  kioskWideRight: {
    position: [5.78, 1.72, -2.55],
    lookAt: [2.62, 0.78, -7.85],
    fov: 50,
    ease: 1.18,
  },
  // Portrait hFOV is tight — stand further back so the car stays in frame
  kioskWideRightMobile: {
    position: [5.52, 1.92, 0.42],
    lookAt: [3.12, 0.62, -8.05],
    fov: 80,
    ease: 1.18,
  },
  // In front of the kiosk, toward the wall — cabinet off the right edge.
  kioskWideLeft: {
    position: [-1.48, 1.46, -2.02],
    lookAt: [-3.52, 1.34, -5.85],
    fov: 88,
    ease: 1.18,
  },
  // Portrait: pulled back so PHOTO / VIDEO / ABOUT all fit
  kioskWideLeftMobile: {
    position: [-0.15, 1.6, -0.28],
    lookAt: [-3.48, 1.4, -5.15],
    fov: 82,
    ease: 1.18,
  },
}

const CAM = POVS.kiosk

function isLandscapeZoom(zoom) {
  return zoom === 'left' || zoom === 'right' || zoom === 'wide'
}

/** NDC X from an R3F pointer event or a raw canvas click. Left is -1. */
function ndcXFromEvent(e) {
  if (typeof e?.pointer?.x === 'number') return e.pointer.x
  const t = e?.target
  if (!t?.getBoundingClientRect || e.clientX == null) return null
  const rect = t.getBoundingClientRect()
  if (!rect.width) return null
  return ((e.clientX - rect.left) / rect.width) * 2 - 1
}

/** Active camera shot — phones use a pulled-back kiosk framing. */
function resolvePov(key, aspect, kioskZoom = 'close') {
  if (key === 'kiosk') {
    if (kioskZoom === 'left') {
      return aspect < 0.85 ? POVS.kioskWideLeftMobile : POVS.kioskWideLeft
    }
    if (kioskZoom === 'right' || kioskZoom === 'wide') {
      return aspect < 0.85 ? POVS.kioskWideRightMobile : POVS.kioskWideRight
    }
    return isMobileViewport() ? POVS.kioskMobile : POVS.kiosk
  }
  if (isWallPov(key)) return pageShot(wallBoardZ(key), aspect)
  return POVS[key] ?? CAM
}

const COL = {
  end: '#0e1012',
  steel: '#2a2e32',
  wood: '#d8b07a',
  woodDark: '#c49a62',
  clear: '#1a1f24',
  tube: '#f3f6ff',
  fixture: '#1c1c1f',
}

const TILE = 0.11
const WALL_ROWS = Math.round(WALL_H / TILE)
const WALL_R = WALL_X + FLOOR_W
// Freestanding flight against the left wall, climbing away from the camera (−Z)
const STAIR_W = 2.4
const STAIR_X = WALL_X + STAIR_W * 0.5 + 0.28
const STAIR_Z0 = -8.6
const STAIR_N = 14
const STAIR_RISE = 0.16
const STAIR_RUN = 0.27
const PILLAR_X = EDGE_X - 0.22
const FONT = 'Helvetica, "Helvetica Neue", "Arial Black", Arial, sans-serif'
const EXIT_RED = '#C60C30'
const SIGN_REV = 13

function hash01(i) {
  let n = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b)
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function makeCanvasTexture(paint, size, colorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  paint(canvas.getContext('2d'), size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function makeColumnTexture(paint, tilePx, rows, colorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = tilePx
  canvas.height = tilePx * rows
  paint(canvas.getContext('2d'), tilePx, rows)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function paintSubwayColumn(ctx, tile, rows, kind) {
  const grout = Math.max(2, Math.round(tile * 0.1))
  const topWhite = 2
  const bandBlack = 1
  const bandGreen = 3
  const fillFor = (r) => {
    if (r < topWhite) return 'white'
    if (r < topWhite + bandBlack) return 'black'
    if (r < topWhite + bandBlack + bandGreen) return 'green'
    if (r < topWhite + bandBlack + bandGreen + bandBlack) return 'black'
    return 'white'
  }
  // Dirtier base than fresh MTA tile
  const color = {
    white: '#d8d2c6',
    black: '#121214',
    green: '#a8b8a0',
  }
  const groutC = {
    white: '#8a8478',
    black: '#08080a',
    green: '#6a7a62',
  }
  const bumpFace = { white: '#e0e0e0', black: '#c8c8c8', green: '#d8d8d8' }
  const bumpGrout = { white: '#1a1a1a', black: '#101010', green: '#222222' }
  const roughFace = { white: '#4a4a4a', black: '#3a3a3a', green: '#454545' }
  const roughGrout = { white: '#d0d0d0', black: '#b8b8b8', green: '#c4c4c4' }

  for (let r = 0; r < rows; r += 1) {
    const y = r * tile
    const type = fillFor(r)
    // Heavier grime toward floor + a bit near ceiling
    const floorGrime = Math.max(0, (r - rows * 0.55) / (rows * 0.45))
    const ceilingGrime = Math.max(0, 1 - r / (rows * 0.22))
    const zone = Math.min(1, floorGrime * 0.85 + ceilingGrime * 0.25)

    if (kind === 'color') {
      ctx.fillStyle = groutC[type]
      ctx.fillRect(0, y, tile, tile)
      ctx.fillStyle = color[type]
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)

      // Tile-to-tile brightness variation
      const shade = ((r * 17 + 9) % 11) / 11
      ctx.fillStyle = `rgba(40, 34, 26, ${0.04 + shade * 0.1 + zone * 0.14})`
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)

      // Speckle / water spots on light tiles
      if (type === 'white' || type === 'green') {
        for (let k = 0; k < 6; k += 1) {
          const px = grout + 2 + ((r * 13 + k * 19) % Math.max(1, tile - grout * 2 - 4))
          const py = y + grout + 2 + ((r * 29 + k * 11) % Math.max(1, tile - grout * 2 - 4))
          ctx.fillStyle = `rgba(55, 48, 38, ${0.12 + (k % 3) * 0.06})`
          ctx.fillRect(px, py, 1 + (k % 2), 1)
        }
        // Soft vertical drip / wash
        if ((r * 7) % 5 === 0) {
          const dx = grout + 4 + (r * 11) % Math.max(1, tile - grout * 2 - 8)
          const drip = ctx.createLinearGradient(dx, y + grout, dx, y + tile - grout)
          drip.addColorStop(0, 'rgba(30, 26, 20, 0)')
          drip.addColorStop(0.4, `rgba(30, 26, 20, ${0.08 + zone * 0.1})`)
          drip.addColorStop(1, `rgba(25, 22, 16, ${0.16 + zone * 0.12})`)
          ctx.fillStyle = drip
          ctx.fillRect(dx, y + grout, 2 + (r % 2), tile - grout * 2)
        }
      }

      // Hand-height / lower band scum line
      if (floorGrime > 0.15 && type === 'white') {
        ctx.fillStyle = `rgba(70, 58, 40, ${0.08 + floorGrime * 0.18})`
        ctx.fillRect(grout, y + tile * 0.55, tile - grout * 2, tile * 0.35)
      }

      // Grout packed with dirt
      ctx.fillStyle = `rgba(25, 20, 14, ${0.15 + zone * 0.2})`
      ctx.fillRect(0, y, tile, grout)
      ctx.fillRect(0, y + tile - grout, tile, grout)
      ctx.fillRect(0, y, grout, tile)
      ctx.fillRect(tile - grout, y, grout, tile)
    } else if (kind === 'bump') {
      ctx.fillStyle = bumpGrout[type]
      ctx.fillRect(0, y, tile, tile)
      ctx.fillStyle = bumpFace[type]
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)
      // Extra micro pitting
      ctx.fillStyle = '#909090'
      for (let k = 0; k < 4; k += 1) {
        ctx.fillRect(
          grout + ((r * 5 + k * 9) % (tile - grout * 2)),
          y + grout + ((r * 3 + k * 7) % (tile - grout * 2)),
          1,
          1,
        )
      }
    } else {
      // Roughness: grimier tiles = rougher
      const roughBoost = Math.floor(zone * 50)
      const rf = roughFace[type]
      ctx.fillStyle = roughGrout[type]
      ctx.fillRect(0, y, tile, tile)
      ctx.fillStyle = rf
      ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)
      if (roughBoost > 0) {
        ctx.fillStyle = `rgb(${80 + roughBoost},${80 + roughBoost},${80 + roughBoost})`
        ctx.fillRect(grout, y + grout, tile - grout * 2, tile - grout * 2)
      }
    }
  }
}

function paintConcrete(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    // Speckled transit rubber — darker base, uneven grit
    const speck = ((x * 13 + y * 37) >>> 3) % 9
    const noise = ((i * 16807) >>> 8) % 38
    const blotch = Math.sin(x * 0.07 + y * 0.05) * 8 + Math.sin(x * 0.021 - y * 0.03) * 10
    const v = Math.max(28, Math.min(78, 48 + noise - speck * 3 + blotch))
    // Slight brown/olive cast in the muck
    data[j] = v + 4
    data[j + 1] = v + 1
    data[j + 2] = Math.max(22, v - 6)
      data[j + 3] = 255
    }
  ctx.putImageData(img, 0, 0)

  // Long scuff / mop streaks
  for (let k = 0; k < 22; k += 1) {
    ctx.fillStyle = `rgba(12, 10, 8, ${0.08 + (k % 5) * 0.03})`
    ctx.fillRect((k * 73) % n, (k * 41) % n, 40 + (k % 7) * 14, 1 + (k % 3))
  }
  // Gum / oil spots
  for (let k = 0; k < 28; k += 1) {
    const gx = (k * 97 + 13) % n
    const gy = (k * 53 + 29) % n
    const gr = 3 + (k % 6)
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    g.addColorStop(0, k % 3 === 0 ? 'rgba(55, 42, 28, 0.55)' : 'rgba(20, 18, 14, 0.45)')
    g.addColorStop(1, 'rgba(20, 18, 14, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(gx, gy, gr, 0, Math.PI * 2)
    ctx.fill()
  }
  // Wet / damp patches
  for (let k = 0; k < 8; k += 1) {
    const wx = (k * 61 + 7) % n
    const wy = (k * 89 + 19) % n
    const g = ctx.createRadialGradient(wx, wy, 2, wx, wy, 18 + (k % 5) * 6)
    g.addColorStop(0, 'rgba(8, 10, 12, 0.35)')
    g.addColorStop(1, 'rgba(8, 10, 12, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(wx, wy, 22 + (k % 4) * 5, 0, Math.PI * 2)
    ctx.fill()
  }
  // Pale salt / grit flecks
  ctx.fillStyle = 'rgba(160, 155, 145, 0.12)'
  for (let k = 0; k < 90; k += 1) {
    ctx.fillRect((k * 47 + 3) % n, (k * 29 + 11) % n, 1, 1)
  }
}

function paintCeiling(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const a = hash01(i)
    const b = hash01(i * 3 + x * 17)
    const c = hash01(y * 91 + x * 13 + 7)
    const blotch = hash01((x >> 3) * 131 + (y >> 4) * 197) * 22 - 8
    const v = Math.max(8, Math.min(58, 16 + a * 28 + b * 10 + blotch + c * 6))
    data[j] = v + 8
    data[j + 1] = v + 1
    data[j + 2] = Math.max(6, v - 7)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  for (let k = 0; k < 22; k += 1) {
    const x = Math.floor(hash01(k * 19 + 3) * n)
    const len = Math.floor(n * (0.25 + hash01(k * 41) * 0.75))
    const y0 = Math.floor(hash01(k * 73 + 11) * (n - len))
    const w = 1 + (k % 4)
    const g = ctx.createLinearGradient(x, y0, x, y0 + len)
    g.addColorStop(0, `rgba(${70 + (k % 40)}, ${36 + (k % 18)}, 16, ${0.28 + hash01(k) * 0.3})`)
    g.addColorStop(1, 'rgba(18, 12, 8, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y0, w, len)
  }
  for (let k = 0; k < 28; k += 1) {
    const cx = Math.floor(hash01(k * 29 + 5) * n)
    const cy = Math.floor(hash01(k * 47 + 9) * n)
    const r = 10 + hash01(k * 11) * 36
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(4, 4, 5, ${0.35 + hash01(k * 3) * 0.35})`)
    g.addColorStop(1, 'rgba(8, 8, 8, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(160, 120, 82, 0.14)'
  for (let k = 0; k < 90; k += 1) {
    ctx.fillRect(Math.floor(hash01(k * 53) * n), Math.floor(hash01(k * 71 + 2) * n), 1 + (k % 2), 1)
  }
}

function paintSteel(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const a = hash01(i)
    const b = hash01(i * 5 + 11)
    const v = 28 + a * 22 + b * 10
    data[j] = v + 8
    data[j + 1] = v
    data[j + 2] = Math.max(16, v - 8)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  for (let k = 0; k < 16; k += 1) {
    const x = Math.floor(hash01(k * 23) * n)
    const h = Math.floor(n * (0.35 + hash01(k * 17) * 0.65))
    const y = Math.floor(hash01(k * 31 + 4) * (n - h * 0.2))
    ctx.fillStyle = `rgba(${100 + (k % 50)}, ${42 + (k % 20)}, 12, ${0.18 + hash01(k) * 0.28})`
    ctx.fillRect(x, y, 1 + (k % 3), h)
  }
  for (let k = 0; k < 18; k += 1) {
    const cx = Math.floor(hash01(k * 43) * n)
    const cy = Math.floor(hash01(k * 59) * n)
    const r = 4 + hash01(k * 7) * 14
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(128, 44, 14, 0.62)')
    g.addColorStop(1, 'rgba(60, 28, 12, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let k = 0; k < 10; k += 1) {
    ctx.fillStyle = `rgba(6, 6, 8, ${0.12 + hash01(k * 9) * 0.18})`
    ctx.fillRect(
      Math.floor(hash01(k * 37) * n),
      Math.floor(hash01(k * 41 + 1) * n),
      12 + (k % 14),
      3 + (k % 6),
    )
  }
}

function paintRiser(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const a = hash01(i)
    const b = hash01((y >> 2) * 67 + (x >> 3) * 19)
    const v = Math.max(18, Math.min(62, 30 + a * 22 + b * 12 - 6))
    data[j] = v + 6
    data[j + 1] = v
    data[j + 2] = Math.max(14, v - 8)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  for (let k = 0; k < 18; k += 1) {
    const x = Math.floor(hash01(k * 21 + 8) * n)
    const g = ctx.createLinearGradient(x, 0, x, n)
    g.addColorStop(0, `rgba(${80 + (k % 30)}, ${40 + (k % 12)}, 16, ${0.35 + hash01(k) * 0.25})`)
    g.addColorStop(0.55, 'rgba(30, 20, 12, 0.18)')
    g.addColorStop(1, 'rgba(12, 10, 8, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 2 + (k % 3), n)
  }
  for (let k = 0; k < 14; k += 1) {
    const cy = Math.floor(hash01(k * 33) * n * 0.55)
    const cx = Math.floor(hash01(k * 51 + 2) * n)
    const r = 12 + hash01(k * 13) * 28
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(8, 8, 8, 0.5)')
    g.addColorStop(1, 'rgba(8, 8, 8, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function paintTactile(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const grit = hash01(i) * 18 - 8
    const speck = hash01(i * 5 + 3) > 0.92 ? -14 : 0
    data[j] = Math.max(186, Math.min(228, 214 + grit + speck))
    data[j + 1] = Math.max(148, Math.min(190, 172 + grit * 0.7))
    data[j + 2] = Math.max(8, Math.min(32, 16 + grit * 0.15))
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  for (let k = 0; k < 10; k += 1) {
    ctx.fillStyle = `rgba(40, 32, 12, ${0.04 + hash01(k) * 0.05})`
    ctx.fillRect(0, Math.floor(hash01(k * 47) * n), n, 1)
  }
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad)
  else ctx.rect(x, y, w, h)
  ctx.fill()
}

function glassPane(ctx, x, y, w, h) {
  ctx.fillStyle = '#1c1c1e'
  rr(ctx, x - 5, y - 5, w + 10, h + 10, 6)
  // Warm cabin light through windshield
  const lit = ctx.createLinearGradient(x, y, x, y + h)
  lit.addColorStop(0, '#f5ecd8')
  lit.addColorStop(0.55, '#d4b888')
  lit.addColorStop(1, '#8a7050')
  ctx.fillStyle = lit
  rr(ctx, x, y, w, h, 4)
  const sheen = ctx.createLinearGradient(x, y, x, y + h)
  sheen.addColorStop(0, 'rgba(255, 250, 240, 0.28)')
  sheen.addColorStop(0.4, 'rgba(210, 220, 230, 0.04)')
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
  ctx.fillStyle = sheen
  rr(ctx, x, y, w, h, 4)
}

function paintLamp(ctx, x, y, r, inner, outer) {
  ctx.beginPath()
  ctx.arc(x, y, r + 4, 0, Math.PI * 2)
    ctx.fillStyle = '#111416'
    ctx.fill()
  const lens = ctx.createRadialGradient(x - r * 0.18, y - r * 0.18, r * 0.05, x, y, r)
  lens.addColorStop(0, inner)
  lens.addColorStop(0.45, outer)
  lens.addColorStop(1, '#2a1c10')
    ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = lens
    ctx.fill()
    ctx.beginPath()
  ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fill()
}

const TRAIN_LINES = [
  { id: 'R', color: '#FCCC0A', fg: '#000000' },
  { id: 'F', color: '#FF6319', fg: '#ffffff' },
]

const TRAIN_CAR_N = 3
const TRAIN_CAR_L = 15.6
const TRAIN_COUPLE = 0.08
const TRAIN_UNIT = TRAIN_CAR_L + TRAIN_COUPLE
const TRAIN_DEPART_Z = 52
const TRAIN_ARRIVE_Z = TRAIN_Z - 78

function paintCarFront(ctx, w, h, line = TRAIN_LINES[0]) {
  const img = ctx.createImageData(w, h)
  const { data } = img
  for (let py = 0; py < h; py += 1) {
    const dirt = py > h * 0.82 ? -26 : py > h * 0.58 ? -8 : 0
    for (let px = 0; px < w; px += 1) {
      const j = (py * w + px) * 4
      const brush = Math.sin(px * 0.28) * 5
      const grain = ((px * 13 + py) >>> 4) % 6
      const v = Math.max(70, 166 + brush + grain + dirt)
      data[j] = v + 8
      data[j + 1] = v + 6
      data[j + 2] = v + 2
      data[j + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  for (let i = 0; i < 18; i += 1) {
    const sx = w * (0.03 + i * 0.052)
    const streak = ctx.createLinearGradient(0, 0, 0, h)
    streak.addColorStop(0, 'rgba(22,18,12,0)')
    streak.addColorStop(0.4, 'rgba(22,18,12,0.04)')
    streak.addColorStop(1, 'rgba(16,12,8,0.2)')
    ctx.fillStyle = streak
    ctx.fillRect(sx, h * 0.06, 2 + (i % 3), h * 0.84)
  }

  const cabY = h * 0.13
  const cabH = h * 0.27
  const cabW = w * 0.27
  const cabL = w * 0.055
  const cabR = w * 0.675
  glassPane(ctx, cabL, cabY, cabW, cabH)
  glassPane(ctx, cabR, cabY, cabW, cabH)

  const doorX = w * 0.385
  const doorY = h * 0.11
  const doorW = w * 0.23
  const doorH = h * 0.74
  ctx.fillStyle = 'rgba(24,20,16,0.5)'
  ctx.fillRect(doorX - 4, doorY - 4, doorW + 8, doorH + 8)
  ctx.fillStyle = 'rgba(30,28,24,0.22)'
  ctx.fillRect(doorX, doorY, doorW, doorH)
  ctx.strokeStyle = 'rgba(210,200,180,0.14)'
  ctx.lineWidth = 2
  ctx.strokeRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4)
  ctx.fillStyle = 'rgba(12,10,8,0.55)'
  ctx.fillRect(doorX + doorW * 0.5 - 1, doorY + 6, 2, doorH - 12)
  glassPane(ctx, doorX + doorW * 0.16, doorY + doorH * 0.07, doorW * 0.68, doorH * 0.26)

  ctx.fillStyle = '#3a3e42'
  ctx.fillRect(doorX - 11, doorY, 7, doorH)
  ctx.fillRect(doorX + doorW + 4, doorY, 7, doorH)
  ctx.fillStyle = '#2a2e32'
  ctx.fillRect(doorX + doorW * 0.7, doorY + doorH * 0.44, doorW * 0.16, 7)
  ctx.fillRect(doorX + doorW * 0.7, doorY + doorH * 0.58, doorW * 0.16, 7)

  ctx.strokeStyle = 'rgba(110,114,118,0.8)'
  ctx.lineWidth = Math.max(2, w * 0.004)
  ctx.setLineDash([w * 0.012, w * 0.008])
    ctx.beginPath()
  ctx.moveTo(doorX + 4, doorY + 10)
  ctx.lineTo(doorX + doorW - 4, doorY + doorH * 0.52)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(doorX + doorW - 4, doorY + 10)
  ctx.lineTo(doorX + 4, doorY + doorH * 0.52)
  ctx.stroke()
  ctx.setLineDash([])

  const br = cabW * 0.3
  const bx = cabR + cabW * 0.5
  const by = cabY + cabH * 0.52
    ctx.beginPath()
  ctx.arc(bx, by, br, 0, Math.PI * 2)
  ctx.fillStyle = line.color
    ctx.fill()
  ctx.fillStyle = line.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(br * 1.28)}px ${FONT}`
  ctx.fillText(line.id, bx, by + br * 0.05)

  const redR = w * 0.028
  const hlR = w * 0.055
  const stackXs = [doorX - w * 0.075, doorX + doorW + w * 0.075]
  stackXs.forEach((sx) => {
    paintLamp(ctx, sx, h * 0.48, redR, '#ff6868', '#b01010')
    paintLamp(ctx, sx, h * 0.62, hlR, '#f0e8c8', '#b8a870')
  })

  ctx.fillStyle = 'rgba(18,18,20,0.72)'
  ctx.fillRect(0, h * 0.88, w, h * 0.12)
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 ? '#3a4044' : '#2a3034'
    ctx.fillRect(w * 0.06 + i * w * 0.11, h * 0.855, w * 0.09, h * 0.035)
  }
  ctx.fillStyle = '#141618'
  ctx.fillRect(w * 0.38, h * 0.91, w * 0.24, h * 0.055)
}

function paintCarSide(ctx, w, h, { reverse = false } = {}) {
  const skirtStart = 0.52
  const skirtY = Math.round(h * skirtStart)
  const img = ctx.createImageData(w, h)
  const { data } = img
  for (let py = 0; py < h; py += 1) {
    const frac = py / h
    const inSkirt = frac >= skirtStart
    const rib = inSkirt ? Math.sin(py * 1.35) * 22 : 0
    const base = inSkirt ? 128 : 178
    const dirt = frac > 0.9 ? -28 : frac > 0.78 ? -10 : 0
    const row = base + rib + dirt + ((py * 11) % 4)
    for (let px = 0; px < w; px += 1) {
      const j = (py * w + px) * 4
      const brush = inSkirt
        ? ((px * 3) >>> 4) % 3
        : Math.sin(px * 0.22) * 4 + (((px * 7) >>> 5) % 4)
      const v = Math.min(255, Math.max(55, row + brush))
      data[j] = v + (inSkirt ? 6 : 10)
      data[j + 1] = v + (inSkirt ? 5 : 8)
      data[j + 2] = v + (inSkirt ? 3 : 5)
      data[j + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Soft sheen on upper stainless
  const sheen = ctx.createLinearGradient(0, 0, 0, skirtY)
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)')
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.02)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.08)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, w, skirtY)

  // Seam between smooth upper and ribbed skirt
  ctx.fillStyle = 'rgba(30,28,26,0.35)'
  ctx.fillRect(0, skirtY - 1, w, 2)
  ctx.fillStyle = 'rgba(220,220,215,0.12)'
  ctx.fillRect(0, skirtY + 1, w, 1)

  const doorH = h * 0.72
  const doorY = h * 0.1
  const doorW = w * 0.058
  const winH = h * 0.34
  const winW = w * 0.084
  const winY = doorY + doorH * 0.12
  const panelW = w * 0.038
  // Default L→R = front→rear. `reverse` paints rear→front so the
  // platform-side mesh can stay unflipped (scale.x=-1 was mirroring the badge).
  const units = [
    { kind: 'badge' },
    { kind: 'win' },
    { kind: 'mta' },
    { kind: 'door' },
    { kind: 'win' },
    { kind: 'door' },
    { kind: 'mta' },
    { kind: 'win' },
    { kind: 'door' },
    { kind: 'mta' },
    { kind: 'door' },
  ]
  const ordered = reverse ? [...units].reverse() : units
  const contentW =
    doorW * units.filter((u) => u.kind === 'door').length +
    winW * units.filter((u) => u.kind === 'win').length +
    panelW * units.filter((u) => u.kind === 'badge' || u.kind === 'mta').length
  const gap = (w - contentW) / (units.length + 1)
  let x = gap

  const drawDoor = (dx) => {
    // Double door panels — same stainless family
    ctx.fillStyle = 'rgba(40,42,44,0.18)'
    ctx.fillRect(dx, doorY, doorW, doorH)
    ctx.strokeStyle = 'rgba(20,20,22,0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(dx + 1, doorY + 1, doorW - 2, doorH - 2)
    const seam = dx + doorW * 0.5
    ctx.fillStyle = 'rgba(10,10,12,0.75)'
    ctx.fillRect(seam - 1.5, doorY + 3, 3, doorH - 6)
    // Pill windows on each leaf — lit cabin showing through
    ;[0.22, 0.72].forEach((fx) => {
      const pw = doorW * 0.18
      const ph = doorH * 0.22
      const px = dx + doorW * fx - pw * 0.5
      const py = doorY + doorH * 0.18
      ctx.fillStyle = '#0e1012'
      rr(ctx, px - 2, py - 2, pw + 4, ph + 4, ph * 0.45)
      const lit = ctx.createLinearGradient(px, py, px, py + ph)
      lit.addColorStop(0, '#fff6e0')
      lit.addColorStop(0.45, '#f0d8a8')
      lit.addColorStop(0.72, '#e09040')
      lit.addColorStop(1, '#c86828')
      ctx.fillStyle = lit
      rr(ctx, px, py, pw, ph, ph * 0.4)
      ctx.fillStyle = 'rgba(255, 248, 230, 0.35)'
      rr(ctx, px + pw * 0.1, py + ph * 0.08, pw * 0.8, ph * 0.22, 2)
    })
    // Kick plate
    ctx.fillStyle = 'rgba(25,22,18,0.4)'
    ctx.fillRect(dx, doorY + doorH * 0.9, doorW, doorH * 0.1)
  }

  const drawWin = (dx) => {
    ctx.fillStyle = '#1a1c1e'
    rr(ctx, dx - 4, winY - 4, winW + 8, winH + 8, 8)
    // Lit interior: ceiling fluorescents → warm cabin → orange seat band
    const lit = ctx.createLinearGradient(dx, winY, dx, winY + winH)
    lit.addColorStop(0, '#fff8ea')
    lit.addColorStop(0.18, '#f5e6c8')
    lit.addColorStop(0.42, '#e8d0a0')
    lit.addColorStop(0.62, '#d89048')
    lit.addColorStop(0.82, '#e07030')
    lit.addColorStop(1, '#a84820')
    ctx.fillStyle = lit
    rr(ctx, dx, winY, winW, winH, 5)
    // Soft glass sheen
    const g = ctx.createLinearGradient(dx, winY, dx, winY + winH)
    g.addColorStop(0, 'rgba(255,255,255,0.28)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.04)')
    g.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = g
    rr(ctx, dx, winY, winW, winH, 5)
    // Destination strip still dark
    ctx.fillStyle = 'rgba(8,10,12,0.82)'
    ctx.fillRect(dx + winW * 0.08, winY + winH * 0.08, winW * 0.84, winH * 0.14)
  }

  const drawMta = (cx, cy, r) => {
      ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
    ctx.strokeStyle = '#0039A6'
    ctx.lineWidth = Math.max(2, r * 0.08)
      ctx.stroke()
    ctx.fillStyle = '#0039A6'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(r * 0.55)}px ${FONT}`
    ctx.fillText('MTA', cx, cy - r * 0.08)
    ctx.font = `600 ${Math.round(r * 0.16)}px ${FONT}`
    ctx.fillText('New York City Subway', cx, cy + r * 0.38)
  }

  const drawFlag = (fx, fy, fw, fh) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(fx, fy, fw, fh)
    const stripeH = fh / 13
    for (let i = 0; i < 13; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#B22234' : '#ffffff'
      ctx.fillRect(fx, fy + i * stripeH, fw, stripeH + 0.5)
    }
    ctx.fillStyle = '#3C3B6E'
    ctx.fillRect(fx, fy, fw * 0.4, stripeH * 7)
  }

  const drawBadge = (dx) => {
    // Number (white on black) above American flag
    const bx = dx + panelW * 0.08
    const bw = panelW * 0.84
    const nh = h * 0.08
    const ny = doorY + doorH * 0.16
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(bx, ny, bw, nh)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${Math.round(nh * 0.68)}px ${FONT}`
    ctx.fillText('4804', bx + bw * 0.5, ny + nh * 0.55)
    const fh = h * 0.07
    const fw = bw * 0.92
    drawFlag(bx + (bw - fw) * 0.5, ny + nh + h * 0.025, fw, fh)
  }

  const drawMtaPanel = (dx) => {
    drawMta(dx + panelW * 0.5, doorY + doorH * 0.28, panelW * 0.38)
  }

  ordered.forEach((u) => {
    if (u.kind === 'badge') {
      drawBadge(x)
      x += panelW + gap
    } else if (u.kind === 'mta') {
      drawMtaPanel(x)
      x += panelW + gap
    } else if (u.kind === 'door') {
      drawDoor(x)
      x += doorW + gap
    } else if (u.kind === 'win') {
      drawWin(x)
      x += winW + gap
    }
  })
}

function makeLabelTexture(draw, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function lumaAsAlpha(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = id.data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4
      const a = Math.max(d[i], d[i + 1], d[i + 2])
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = a
      if (a > 24) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  ctx.putImageData(id, 0, 0)
  if (maxX <= minX || maxY <= minY) return canvas
  const pad = 2
  const sx = Math.max(0, minX - pad)
  const sy = Math.max(0, minY - pad)
  const sw = Math.min(canvas.width - sx, maxX - minX + 1 + pad * 2)
  const sh = Math.min(canvas.height - sy, maxY - minY + 1 + pad * 2)
  const cropped = document.createElement('canvas')
  cropped.width = sw
  cropped.height = sh
  cropped.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return cropped
}

function paintExitSign(ctx, w, h, metalImg, arrowImg) {
  if (metalImg) {
    const scale = Math.max(w / metalImg.width, h / metalImg.height)
    const dw = metalImg.width * scale
    const dh = metalImg.height * scale
    ctx.drawImage(metalImg, (w - dw) / 2, (h - dh) / 2, dw, dh)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
    ctx.fillRect(0, 0, w, h)
    const sheen = ctx.createLinearGradient(0, 0, 0, h)
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
    sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0)')
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.28)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, w, h)
  }

  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  const lineH = Math.max(3, Math.round(h * 0.014))
  const lineY = Math.round(h * 0.026)
  const top = lineY + lineH
  const bot = h - lineY - lineH
  const inner = bot - top
  const gap = Math.round(w * 0.016)
  const left = Math.round(w * 0.022)
  const right = w - Math.round(w * 0.028)

  const glyph = (size, text) => {
    ctx.font = `700 ${Math.round(size)}px ${FONT}`
    const m = ctx.measureText(text)
    const a = m.actualBoundingBoxAscent
    const d = m.actualBoundingBoxDescent
    return {
      width: Math.max(m.width, 1),
      ascent: a > size * 0.45 && a < size * 1.1 ? a : size * 0.72,
      descent: d >= 0 && d < size * 0.3 ? d : size * 0.05,
    }
  }

  const arrowSize = inner
  if (arrowImg) {
    const aw = arrowImg.width
    const ah = arrowImg.height
    const scale = arrowSize / Math.max(aw, ah)
    const dw = aw * scale
    const dh = ah * scale
    const ax = left + (arrowSize - dw) / 2
    const ay = top + (arrowSize - dh) / 2
    ctx.save()
    ctx.translate(ax + dw / 2, ay + dh / 2)
    ctx.scale(1, -1)
    ctx.drawImage(arrowImg, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }

  const redX = left + arrowSize + gap
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.055em'
  const bottomPad = Math.max(2, Math.round(inner * 0.016))
  let exitSize = inner
  let exit = glyph(exitSize, 'Exit')
  exitSize *= (inner - bottomPad) / (exit.ascent + exit.descent)
  exit = glyph(exitSize, 'Exit')

  const exitPadX = Math.round(inner * 0.045)
  const exitPadRight = Math.round(inner * 0.1)
  const maxRedW = Math.round(w * 0.48) - redX
  let redW = exit.width + exitPadX + exitPadRight
  if (redW > maxRedW) {
    exitSize *= (maxRedW - exitPadX - exitPadRight) / exit.width
    exit = glyph(exitSize, 'Exit')
    redW = maxRedW
  }
  ctx.fillStyle = EXIT_RED
  ctx.fillRect(redX, top, redW, inner)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Exit', redX + exitPadX, top + exit.ascent)

  const tx = redX + redW + Math.round(gap * 1.8)
  const maxName = right - tx
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.05em'
  const namePadY = Math.max(8, Math.round(inner * 0.08))
  let nameSize = inner * 0.88
  let name = glyph(nameSize, 'metrotapes')
  const bulletR = (size) => size * 0.26
  const stackH = (nm, size) => nm.ascent + nm.descent + bulletR(size) * 2.55
  while (
    (name.width > maxName || stackH(name, nameSize) + namePadY > inner - 6) &&
    nameSize > 18
  ) {
    nameSize -= 2
    name = glyph(nameSize, 'metrotapes')
  }
  const br = bulletR(nameSize)
  ctx.fillText('metrotapes', tx, top + namePadY + name.ascent)

  const by = top + namePadY + name.ascent + name.descent + br * 1.15
  const bulletGap = Math.max(12, Math.round(br * 0.85))
  const bullets = [
    { x: tx + br, color: '#FCCC0A', letter: 'R', fg: '#000000' },
    { x: tx + br * 3 + bulletGap, color: '#FF6319', letter: 'F', fg: '#ffffff' },
  ]
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  bullets.forEach(({ x, color, letter, fg }) => {
    ctx.beginPath()
    ctx.arc(x, by, br, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.fillStyle = fg
    ctx.font = `700 ${Math.round(br * 1.28)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(letter, x, by + br * 0.04)
  })

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, lineY, w, lineH)
  ctx.fillRect(0, bot, w, lineH)
}

const STATION_MAP_REV = 6

function useStationMaps() {
  const maps = useMemo(() => {
    const wallMap = makeColumnTexture(
      (ctx, tile, rows) => paintSubwayColumn(ctx, tile, rows, 'color'),
      64,
      WALL_ROWS,
      THREE.SRGBColorSpace,
    )
    wallMap.repeat.set(LEN / TILE, 1)

    const wallBump = makeColumnTexture(
      (ctx, tile, rows) => paintSubwayColumn(ctx, tile, rows, 'bump'),
      64,
      WALL_ROWS,
      THREE.NoColorSpace,
    )
    wallBump.repeat.set(LEN / TILE, 1)

    const wallRough = makeColumnTexture(
      (ctx, tile, rows) => paintSubwayColumn(ctx, tile, rows, 'rough'),
      64,
      WALL_ROWS,
      THREE.NoColorSpace,
    )
    wallRough.repeat.set(LEN / TILE, 1)

    const floorMap = makeCanvasTexture(paintConcrete, 256, THREE.SRGBColorSpace)
    floorMap.repeat.set(FLOOR_W / 1.8, LEN / 1.8)

    const ceilingMap = makeCanvasTexture(paintCeiling, 512, THREE.SRGBColorSpace)
    ceilingMap.repeat.set(FLOOR_W / 7.2, LEN / 13)
    ceilingMap.offset.set(0.17, 0.31)

    const steelMap = makeCanvasTexture(paintSteel, 256, THREE.SRGBColorSpace)
    steelMap.repeat.set(1.15, 0.9)

    const riserMap = makeCanvasTexture(paintRiser, 256, THREE.SRGBColorSpace)
    riserMap.repeat.set(LEN / 4.8, 1.15)

    const ballastMap = makeCanvasTexture(paintBallast, 256, THREE.SRGBColorSpace)
    ballastMap.repeat.set(TRACK_W / 2.2, LEN / 3.4)

    const yellowMap = makeCanvasTexture(paintTactile, 256, THREE.SRGBColorSpace)
    yellowMap.repeat.set(1.1, LEN / 2.6)

    return {
      wallMap,
      wallBump,
      wallRough,
      floorMap,
      ceilingMap,
      steelMap,
      riserMap,
      ballastMap,
      yellowMap,
      dispose() {
        wallMap.dispose()
        wallBump.dispose()
        wallRough.dispose()
        floorMap.dispose()
        ceilingMap.dispose()
        steelMap.dispose()
        riserMap.dispose()
        ballastMap.dispose()
        yellowMap.dispose()
      },
    }
  }, [STATION_MAP_REV])

  useLayoutEffect(() => () => maps.dispose(), [maps])
  return maps
}

const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>`,
)

const GLASS_SMUDGE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="384">
    <filter id="s">
      <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="6" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#s)"/>
  </svg>`,
)

const Layer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: ${(p) => (p.$hit ? 'auto' : 'none')};
  overflow: hidden;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    opacity: ${(p) => (p.$page ? 0 : 1)};
    transition: opacity 0.35s ease;
  }
`

const SceneWrap = styled.div`
  position: absolute;
  inset: 0;
`

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  pointer-events: none;
  overflow: ${(p) => (p.$page || p.$clip ? 'hidden' : 'visible')};
  transform-style: ${(p) => (p.$page ? 'flat' : 'preserve-3d')};
  background: ${(p) => (p.$page ? '#0c0e10' : 'transparent')};
  /* Hidden until CSS-3D transforms land. Fullscreen pages skip that loop. */
  visibility: hidden;
  ${(p) => p.$hide && `
    display: none !important;
  `}
  ${(p) => p.$page && `
    visibility: visible !important;
    perspective: none !important;
    right: 0;
    bottom: 0;
    width: 100% !important;
    height: 100% !important;
  `}
`

const OverlayCam = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  transform-style: ${(p) => (p.$page ? 'flat' : 'preserve-3d')};
  pointer-events: none;
  ${(p) => p.$page && `
    transform: none !important;
  `}
`

const OverlayObj = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  /* Solid hit shield over the projected screen so the canvas can't steal clicks */
  pointer-events: ${(p) => (p.$live || p.$catch ? 'auto' : 'none')};
  cursor: ${(p) => (p.$catch && !p.$live ? 'pointer' : 'inherit')};
  transform-style: ${(p) => (p.$fill ? 'flat' : 'preserve-3d')};
  ${(p) => p.$off && `
    visibility: hidden !important;
  `}
  ${(p) => !p.$live && `
    * { pointer-events: none !important; }
  `}
  ${(p) => p.$fill && `
    visibility: visible !important;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: none !important;
  `}
`

const KioskFrame = styled.div`
  position: relative;
  width: ${KIOSK_PANEL_W}px;
  height: ${KIOSK_PANEL_H}px;
  overflow: hidden;
  border-radius: ${KIOSK_RADIUS_PX}px;
  /* Inherit from OverlayObj — don't re-enable hits while intro has live=false */
  pointer-events: inherit;
`

/** LCD glass: gasket + glare. No RGB subpixel mesh — that read as a screen door. */
const KioskGlass = styled.div`
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1.5px rgba(6, 8, 10, 0.72),
    inset 0 0 0 3px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    inset 0 8px 14px rgba(0, 0, 0, 0.16);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(ellipse 90% 70% at 50% 40%, transparent 62%, rgba(0, 0, 0, 0.1) 100%);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(ellipse 46% 15% at 90% 14%, rgba(255, 248, 232, 0.22) 0%, transparent 64%),
      radial-gradient(ellipse 68% 18% at 24% -6%, rgba(255, 255, 255, 0.1) 0%, transparent 70%),
      radial-gradient(ellipse 28% 10% at 78% 58%, rgba(255, 255, 255, 0.04), transparent 70%),
      radial-gradient(ellipse 22% 8% at 16% 88%, rgba(255, 255, 255, 0.05), transparent 72%);
  }
`

const KioskGlassDirt = styled.div`
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  border-radius: inherit;
  opacity: 0.08;
  background-image:
    url("data:image/svg+xml,${GLASS_SMUDGE_SVG}"),
    radial-gradient(ellipse 38% 16% at 70% 18%, rgba(255, 255, 255, 0.22), transparent 68%),
    radial-gradient(ellipse 26% 12% at 22% 74%, rgba(255, 255, 255, 0.14), transparent 70%);
  background-size: 180px 270px, 100% 100%, 100% 100%;
`

const WallFrame = styled.div`
  position: relative;
  width: ${(p) => (p.$fill ? '100%' : `${p.$w}px`)};
  height: ${(p) => (p.$fill ? '100%' : `${p.$h}px`)};
  overflow: hidden;
  border-radius: 0;
  pointer-events: inherit;
  background: #0c0e10;
  contain: ${(p) => (p.$fill ? 'none' : 'strict')};
  ${(p) => !p.$fill && `
    * { pointer-events: none !important; }
  `}
`

const Grain = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  opacity: 0.1;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,${GRAIN_SVG}");
  background-size: 128px 128px;
`

const NoWebGL = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-family: Helvetica, "Helvetica Neue", Arial, sans-serif;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
`

function GfxWatch() {
  const { drop, tier } = useGfx()
  const acc = useRef({ t: 0, n: 0, warm: 0 })
  useFrame((_, dt) => {
    if (tier !== 'high') return
    acc.current.warm += dt
    if (acc.current.warm < 4) return
    acc.current.t += dt
    acc.current.n += 1
    if (acc.current.t < 2) return
    const fps = acc.current.n / acc.current.t
    acc.current.t = 0
    acc.current.n = 0
    if (fps < 40) drop()
  })
  return null
}

function ToneMap() {
  const { gl } = useThree()
  const { settings } = useGfx()
  useLayoutEffect(() => {
    gl.toneMappingExposure = settings.exposure
  }, [gl, settings.exposure])
  return null
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function smootherstep(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

const WALL_FLY_SEC = 1.28

function CameraRig({ pov, kioskZoom = 'close', onArrive, locked = false }) {
  const { camera, size } = useThree()
  const look = useRef(new THREE.Vector3(...CAM.lookAt))
  const goalPos = useMemo(() => new THREE.Vector3(), [])
  const goalLook = useMemo(() => new THREE.Vector3(), [])
  const arrivedFor = useRef(null)
  const wasLocked = useRef(locked)
  const lastPov = useRef(pov)
  const flyFrom = useMemo(() => new THREE.Vector3(), [])
  const flyLookFrom = useMemo(() => new THREE.Vector3(), [])
  const flyFovFrom = useRef(CAM.fov)
  const flyT = useRef(1)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const aspect = size.width / Math.max(1, size.height)
  const shotId = pov === 'kiosk'
    ? `kiosk:${kioskZoom}:${aspect < 0.85 ? 'tall' : 'wide'}`
    : pov

  useLayoutEffect(() => {
    if (locked) return
    const shot = resolvePov(pov, aspect, kioskZoom)
    camera.position.set(...shot.position)
    look.current.set(...shot.lookAt)
    camera.fov = shot.fov
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])

  useLayoutEffect(() => {
    if (locked) {
      arrivedFor.current = null
      lastPov.current = pov
      return
    }
    arrivedFor.current = null
    if (isWallPov(pov)) {
      flyT.current = 0
      flyFrom.copy(camera.position)
      flyLookFrom.copy(look.current)
      flyFovFrom.current = camera.fov
    }
  }, [pov, kioskZoom, locked, camera, flyFrom, flyLookFrom])

  useLayoutEffect(() => {
    if (locked) return
    arrivedFor.current = null
  }, [size.width, size.height, locked])

  useFrame((_, dt) => {
    if (locked) {
      wasLocked.current = true
      return
    }

    const shot = resolvePov(pov, aspect, kioskZoom)
    const d = Math.min(dt, 0.05)
    const fromWall = pov === 'kiosk' && isWallPov(lastPov.current)

    // Already settled on this POV — freeze so the CSS kiosk overlay
    // isn't rewritten every frame (that breaks button hit-testing).
    if (arrivedFor.current === shotId) return

    // Intro handoff — seed look so nothing pops
    if (wasLocked.current) {
      look.current.set(...shot.lookAt)
      wasLocked.current = false
    }

    goalPos.set(...shot.position)
    goalLook.set(...shot.lookAt)

    const settle = () => {
      camera.position.copy(goalPos)
      look.current.copy(goalLook)
      camera.fov = shot.fov
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      arrivedFor.current = shotId
      lastPov.current = pov
      onArrive?.(pov)
    }

    if (reducedMotion) {
      settle()
      return
    }

    if (isWallPov(pov)) {
      flyT.current = Math.min(1, flyT.current + d / WALL_FLY_SEC)
      const u = smootherstep(flyT.current)
      camera.position.lerpVectors(flyFrom, goalPos, u)
      look.current.lerpVectors(flyLookFrom, goalLook, u)
      camera.fov = THREE.MathUtils.lerp(flyFovFrom.current, shot.fov, u)
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      if (flyT.current >= 1) settle()
      return
    }

    let k = 1 - Math.exp(-(shot.ease ?? 1.25) * d)
    if (fromWall) {
      const rem = camera.position.distanceTo(goalPos)
      const cruise = 0.017
      const finish = 0.055
      const t = 1 - THREE.MathUtils.smoothstep(rem, 0.55, 2.4)
      k = Math.max(k, THREE.MathUtils.lerp(cruise, finish, t))
    }
    camera.position.lerp(goalPos, k)
    look.current.lerp(goalLook, k)
    camera.fov = THREE.MathUtils.lerp(camera.fov, shot.fov, k)
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()

    const closeDist = fromWall ? 0.12 : 0.08
    const closeLook = fromWall ? 0.14 : 0.08
    const closeFov = fromWall ? 0.7 : 0.4
    const close = camera.position.distanceTo(goalPos) < closeDist
      && look.current.distanceTo(goalLook) < closeLook
      && Math.abs(camera.fov - shot.fov) < closeFov
    if (close) settle()
  })

  return null
}

const ChromeBar = styled.div`
  position: absolute;
  left: 50%;
  bottom: max(1.1rem, env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  pointer-events: auto;
`

const ChromeBtn = styled.button`
  margin: 0;
  padding: 0;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  animation: chromePulse 2.1s ease-in-out infinite;

  &:hover { color: rgba(255, 255, 255, 0.95); }
  &:active { color: rgba(255, 255, 255, 0.8); }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @keyframes chromePulse {
    0%, 100% {
      transform: scale(1);
      color: rgba(255, 255, 255, 0.45);
    }
    50% {
      transform: scale(1.1);
      color: rgba(255, 255, 255, 0.95);
    }
  }
`

function LivePhotoIcon() {
  const dashes = 26
  const r = 13.15
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
      <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.85" />
      <circle cx="16" cy="16" r="7.35" fill="none" stroke="currentColor" strokeWidth="1.85" />
      {Array.from({ length: dashes }, (_, i) => {
        const a = (i / dashes) * Math.PI * 2
        const x = 16 + Math.cos(a) * r
        const y = 16 + Math.sin(a) * r
        return (
          <rect
            key={i}
            x={x - 0.7}
            y={y - 1.55}
            width="1.4"
            height="3.1"
            rx="0.7"
            fill="currentColor"
            transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`}
          />
        )
      })}
    </svg>
  )
}

function PanArrow({ dir }) {
  const d = dir === 'left'
    ? 'M25 8 L13 20 L25 32'
    : 'M15 8 L27 20 L15 32'
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden>
      <path
        d="M8 19 L20 8 L32 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 18.5 V31 H27 V18.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TiledWall({ maps, x, rotY, z, len }) {
  const tiled = useMemo(() => {
    const wallMap = maps.wallMap.clone()
    const wallBump = maps.wallBump.clone()
    const wallRough = maps.wallRough.clone()
    const rx = len / TILE
    wallMap.repeat.set(rx, 1)
    wallBump.repeat.set(rx, 1)
    wallRough.repeat.set(rx, 1)
    return { wallMap, wallBump, wallRough }
  }, [len, maps.wallBump, maps.wallMap, maps.wallRough])

  useLayoutEffect(() => () => {
    tiled.wallMap.dispose()
    tiled.wallBump.dispose()
    tiled.wallRough.dispose()
  }, [tiled])

  return (
    <mesh rotation={[0, rotY, 0]} position={[x, WALL_H / 2, z]}>
      <planeGeometry args={[len, WALL_H]} />
      <meshPhysicalMaterial
        map={tiled.wallMap}
        bumpMap={tiled.wallBump}
        bumpScale={0.028}
        roughnessMap={tiled.wallRough}
        roughness={0.42}
        metalness={0.02}
        clearcoat={0.12}
        clearcoatRoughness={0.55}
      />
    </mesh>
  )
}

function Shell({ maps }) {
  const endH = HEIGHT - TRACK_Y

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WALL_X + PLAT_W / 2, 0, MID_Z]}>
        <planeGeometry args={[PLAT_W, LEN]} />
        <meshStandardMaterial
          map={maps.floorMap}
          color="#8a847a"
          roughness={0.98}
          metalness={0}
        />
      </mesh>
      <TiledWall maps={maps} x={WALL_R} rotY={-Math.PI / 2} z={MID_Z} len={LEN} />
      <TiledWall maps={maps} x={WALL_X} rotY={Math.PI / 2} z={MID_Z} len={LEN} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[WALL_X + FLOOR_W / 2, HEIGHT, MID_Z]}>
        <planeGeometry args={[FLOOR_W, LEN]} />
        <meshStandardMaterial map={maps.ceilingMap} roughness={0.97} metalness={0} />
      </mesh>
      <mesh position={[WALL_X + FLOOR_W / 2, TRACK_Y + endH / 2, MID_Z - LEN / 2]}>
        <planeGeometry args={[FLOOR_W, endH]} />
        <meshStandardMaterial color={COL.end} roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

function createIBeamGeometry(height) {
  const web = new THREE.BoxGeometry(0.055, height, 0.2)
  const near = new THREE.BoxGeometry(0.3, height, 0.042)
  const far = new THREE.BoxGeometry(0.3, height, 0.042)
  near.translate(0, 0, 0.1)
  far.translate(0, 0, -0.1)
  const merged = mergeGeometries([web, near, far])
  web.dispose()
  near.dispose()
  far.dispose()
  return merged
}

function createCeilingBeamGeometry(length) {
  const web = new THREE.BoxGeometry(length, 0.22, 0.05)
  const top = new THREE.BoxGeometry(length, 0.04, 0.28)
  const bot = new THREE.BoxGeometry(length, 0.04, 0.28)
  web.translate(0, -0.15, 0)
  top.translate(0, -0.02, 0)
  bot.translate(0, -0.28, 0)
  const merged = mergeGeometries([web, top, bot])
  web.dispose()
  top.dispose()
  bot.dispose()
  return merged
}

const CEIL_BEAM_N = 34
const CEIL_BEAM_GAP = 1.55
const CEIL_BEAM_Z0 = 6.2

function CeilingBeams({ maps }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(() => createCeilingBeamGeometry(FLOOR_W + 0.32), [])
  const steel = {
    map: maps.steelMap,
    color: '#c4b8a8',
    roughness: 0.78,
    metalness: 0.28,
  }

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const x = WALL_X + FLOOR_W / 2 - 0.08
    const tint = new THREE.Color()
    for (let i = 0; i < CEIL_BEAM_N; i += 1) {
      dummy.position.set(x, HEIGHT, CEIL_BEAM_Z0 - i * CEIL_BEAM_GAP)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      const n = hash01(i * 19 + 4)
      tint.setRGB(0.62 + n * 0.28, 0.52 + n * 0.18, 0.4 + n * 0.12)
      inst.setColorAt(i, tint)
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [dummy, geometry])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, null, CEIL_BEAM_N]}>
        <meshStandardMaterial
          map={maps.steelMap}
          color="#ffffff"
          roughness={0.78}
          metalness={0.28}
        />
      </instancedMesh>
      <mesh position={[WALL_X + 0.06, HEIGHT - 0.1, MID_Z]}>
        <boxGeometry args={[0.14, 0.22, LEN]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[PILLAR_X, HEIGHT - 0.12, MID_Z]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[LEN, 0.18, 0.22]} />
        <meshStandardMaterial {...steel} />
      </mesh>
    </group>
  )
}

function Pillars() {
  const mesh = useRef()
  const geometry = useMemo(() => createIBeamGeometry(HEIGHT), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  // Keep I-beams down the platform; skip the one in the kiosk / zoom-out sightline.
  const zs = useMemo(
    () => Array.from({ length: PILLAR_N }, (_, i) => PILLAR_Z0 - i * PILLAR_GAP).filter((z) => z < -4),
    [],
  )

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    zs.forEach((z, i) => {
      dummy.position.set(PILLAR_X, HEIGHT / 2, z)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    })
    inst.instanceMatrix.needsUpdate = true
    inst.count = zs.length
  }, [dummy, geometry, zs])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh ref={mesh} args={[geometry, null, zs.length]}>
      <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
    </instancedMesh>
  )
}

function YellowStrip({ maps }) {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const stripW = 0.42
  const cols = 3
  const step = 0.13
  const rows = Math.floor(LEN / step)
  const count = cols * rows
  const dome = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.042, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    geo.scale(1, 0.52, 1)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const top = 0.042 * 0.52
    for (let i = 0; i < pos.count; i += 1) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / top))
      const grit = hash01(i * 13 + 8) * 0.06
      // Dirt collects at the rim; crown stays yellow
      const k = 0.78 + t * 0.22 - grit
      colors[i * 3] = 0.89 * k
      colors[i * 3 + 1] = 0.70 * k
      colors[i * 3 + 2] = 0.06 * k
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const x0 = EDGE_X - (cols - 1) * step * 0.5
    const z0 = MID_Z + LEN / 2 - step * 0.5
    let i = 0
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        dummy.position.set(x0 + c * step, 0.024, z0 - r * step)
        dummy.updateMatrix()
        inst.setMatrixAt(i, dummy.matrix)
        i += 1
      }
    }
    inst.instanceMatrix.needsUpdate = true
  }, [dummy, count])

  useLayoutEffect(() => () => dome.dispose(), [dome])

  return (
    <group>
    <mesh position={[EDGE_X, 0.012, MID_Z]}>
        <boxGeometry args={[stripW, 0.024, LEN]} />
        <meshStandardMaterial
          map={maps.yellowMap}
          roughness={0.86}
          metalness={0}
        />
    </mesh>
      <instancedMesh key={STATION_MAP_REV} ref={mesh} args={[dome, null, count]}>
        <meshStandardMaterial vertexColors roughness={0.84} metalness={0} />
      </instancedMesh>
    </group>
  )
}

function paintBallast(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const a = hash01(i)
    const stone = hash01((x >> 2) * 89 + (y >> 2) * 47)
    const grit = hash01(i * 7 + 3)
    const v = 14 + a * 26 + stone * 12 + grit * 8
    data[j] = v + 10
    data[j + 1] = v + 2
    data[j + 2] = Math.max(8, v - 6)
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  for (let k = 0; k < 28; k += 1) {
    const x = Math.floor(hash01(k * 17) * n)
    const y = Math.floor(hash01(k * 29 + 4) * n)
    ctx.fillStyle = `rgba(8,6,4,${0.2 + hash01(k) * 0.22})`
    ctx.beginPath()
    ctx.ellipse(x, y, 6 + (k % 10), 3 + (k % 6), hash01(k * 3) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(92, 68, 42, 0.22)'
  for (let k = 0; k < 50; k += 1) {
    ctx.fillRect(Math.floor(hash01(k * 61) * n), Math.floor(hash01(k * 43 + 2) * n), 1 + (k % 2), 1)
  }
}

function Tracks({ maps }) {
  const tieMesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tieGap = 0.55
  const tieN = Math.floor(LEN / tieGap)
  const tieGeo = useMemo(() => new THREE.BoxGeometry(2.55, 0.12, 0.22), [])
  const riserH = -TRACK_Y

  useLayoutEffect(() => {
    const inst = tieMesh.current
    if (!inst) return
    const z0 = MID_Z + LEN / 2 - tieGap * 0.5
    const tint = new THREE.Color()
    for (let i = 0; i < tieN; i += 1) {
      dummy.position.set(TRACK_CX, TRACK_Y + 0.06, z0 - i * tieGap)
      dummy.rotation.y = ((i * 17) % 7 - 3) * 0.008
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
      const n = hash01(i * 11 + 2)
      tint.setRGB(0.62 + n * 0.22, 0.48 + n * 0.16, 0.32 + n * 0.1)
      inst.setColorAt(i, tint)
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [dummy, tieN])

  useLayoutEffect(() => () => tieGeo.dispose(), [tieGeo])

  const railY = TRACK_Y + 0.16

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[TRACK_X0 + TRACK_W / 2, TRACK_Y, MID_Z]}>
        <planeGeometry args={[TRACK_W, LEN]} />
        <meshStandardMaterial
          map={maps.ballastMap}
          color="#6a5340"
          roughness={0.98}
          metalness={0}
        />
      </mesh>
      <mesh position={[TRACK_X0 + 0.015, TRACK_Y + riserH / 2, MID_Z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[LEN, riserH]} />
        <meshStandardMaterial map={maps.riserMap} roughness={0.96} metalness={0} />
      </mesh>
      <mesh position={[TRACK_X0, -0.03, MID_Z]}>
        <boxGeometry args={[0.18, 0.08, LEN]} />
        <meshStandardMaterial map={maps.riserMap} color="#9a9080" roughness={0.9} metalness={0} />
      </mesh>
      {[0.22, 0.48].map((yOff, i) => (
        <mesh key={i} position={[TRACK_X0 + 0.05, TRACK_Y + yOff, MID_Z]}>
          <boxGeometry args={[0.055, 0.038, LEN]} />
          <meshStandardMaterial
            color={i ? '#4a3424' : '#2e281c'}
            roughness={0.72}
            metalness={0.32}
          />
        </mesh>
      ))}
      <instancedMesh ref={tieMesh} args={[tieGeo, null, tieN]}>
        <meshStandardMaterial color="#2c1a0e" roughness={0.94} metalness={0} />
      </instancedMesh>
      {[-RAIL_HALF, RAIL_HALF].map((x) => (
        <group key={x} position={[TRACK_CX + x, railY, MID_Z]}>
          <mesh>
            <boxGeometry args={[0.07, 0.1, LEN]} />
            <meshStandardMaterial color="#1a1816" roughness={0.55} metalness={0.55} />
        </mesh>
          <mesh position={[0, 0.055, 0]}>
            <boxGeometry args={[0.085, 0.018, LEN]} />
            <meshStandardMaterial color="#3a3834" roughness={0.35} metalness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[TRACK_CX + RAIL_HALF + 0.55, TRACK_Y + 0.2, MID_Z]}>
        <boxGeometry args={[0.12, 0.08, LEN]} />
        <meshStandardMaterial color="#141210" roughness={0.7} metalness={0.4} />
      </mesh>
    </group>
  )
}

function createCarProfile(w, h, arch) {
  const hw = w / 2
  const wallTop = h - arch
  const shape = new THREE.Shape()
  shape.moveTo(-hw, 0)
  shape.lineTo(-hw, wallTop)
  // Gentle R62A-style roof arch
  shape.quadraticCurveTo(0, wallTop + arch * 2.05, hw, wallTop)
  shape.lineTo(hw, 0)
  shape.closePath()
  return shape
}

function createCarBodyGeometry(w, h, l, arch) {
  const geo = new THREE.ExtrudeGeometry(createCarProfile(w, h, arch), {
    depth: l,
    bevelEnabled: false,
    curveSegments: 20,
    steps: 1,
  })
  geo.translate(0, 0, -l)
  geo.computeVertexNormals()
  return geo
}

function createCarFrontGeometry(w, h, arch) {
  const geo = new THREE.ShapeGeometry(createCarProfile(w, h, arch), 20)
  // UV: shape is in XY; remap so the front texture covers the silhouette
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  const hw = w / 2
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    uv.setXY(i, (x + hw) / w, y / h)
  }
  uv.needsUpdate = true
  return geo
}

function createCarRoofGeometry(w, h, l, arch) {
  const hw = w / 2
  const wallTop = h - arch
  const inset = 0.12
  const shape = new THREE.Shape()
  // Roof cap only — sits on top of the walls, follows the same arch
  shape.moveTo(-hw - 0.01, wallTop - 0.02)
  shape.lineTo(-hw - 0.01, wallTop)
  shape.quadraticCurveTo(0, wallTop + arch * 2.05, hw + 0.01, wallTop)
  shape.lineTo(hw + 0.01, wallTop - 0.02)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: l - inset,
    bevelEnabled: false,
    curveSegments: 24,
    steps: 1,
  })
  // Stop short of the nose so the roof cap doesn't share a plane with the front
  geo.translate(0, 0, -l)
  geo.computeVertexNormals()
  return geo
}

function paintRoofRibs(ctx, n) {
  for (let y = 0; y < n; y += 1) {
    const rib = Math.sin(y * 0.55) * 14
    // Lighter silver so the roof reads against the dark station ceiling
    const v = Math.max(120, 178 + rib + ((y * 7) % 5))
    ctx.fillStyle = `rgb(${v + 6},${v + 5},${v + 2})`
    ctx.fillRect(0, y, n, 1)
  }
  // Soft highlight band down the crown
  const sheen = ctx.createLinearGradient(0, 0, n, 0)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, n, n)
  // Seam / dirt lines along length (keep subtle)
  ctx.fillStyle = 'rgba(40,36,32,0.12)'
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect(0, (i * 41) % n, n, 2)
  }
}

function paintWood(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const y = (i / n) | 0
    const x = i % n
    const stripe = Math.sin(y * 0.07) * 32 + Math.sin(y * 0.22 + x * 0.012) * 14
    const pore = hash01(i) * 18 - 8
    const band = hash01((y >> 3) * 23) * 16 - 7
    const v = 112 + stripe + pore + band
    data[j] = Math.max(78, Math.min(210, v + 34))
    data[j + 1] = Math.max(58, Math.min(158, v - 2))
    data[j + 2] = Math.max(22, Math.min(72, v - 68))
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.lineCap = 'round'
  for (let k = 0; k < 14; k += 1) {
    const x = 8 + (k * 41) % (n - 16)
    ctx.strokeStyle = `rgba(62, 34, 12, ${0.18 + (k % 5) * 0.07})`
    ctx.lineWidth = 1.4 + (k % 4) * 0.9
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= n; y += 6) {
      ctx.lineTo(x + Math.sin(y * 0.022 + k * 1.1) * 5.5, y)
    }
    ctx.stroke()
  }
  for (let k = 0; k < 9; k += 1) {
    const cx = Math.floor(hash01(k * 41) * n)
    const cy = Math.floor(hash01(k * 17 + 3) * n)
    const r = 8 + hash01(k * 7) * 14
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, 'rgba(52, 30, 12, 0.55)')
    g.addColorStop(0.4, 'rgba(96, 58, 24, 0.28)')
    g.addColorStop(1, 'rgba(110, 72, 32, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, r * 0.5, r, hash01(k) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(228, 190, 118, 0.2)'
  for (let k = 0; k < 12; k += 1) {
    ctx.fillRect(Math.floor(hash01(k * 19) * n), Math.floor(hash01(k * 31) * n), 28 + (k % 18), 3 + (k % 4))
  }
}

/** Painted kiosk plastic — grain + scuffs, not a photo wrap. */
function paintKioskPlastic(ctx, n) {
  ctx.fillStyle = '#b7b8b2'
  ctx.fillRect(0, 0, n, n)
  const img = ctx.getImageData(0, 0, n, n)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const speckle = (Math.random() - 0.5) * 28
    d[i] = Math.max(0, Math.min(255, d[i] + speckle))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + speckle))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + speckle * 0.8))
  }
  ctx.putImageData(img, 0, 0)
  ctx.lineCap = 'round'
  for (let k = 0; k < 22; k += 1) {
    ctx.strokeStyle = `rgba(24,24,22,${0.07 + (k % 4) * 0.035})`
    ctx.lineWidth = 0.6 + (k % 3) * 0.45
    const x = (k * 37) % n
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= n; y += 8) {
      ctx.lineTo(x + Math.sin(y * 0.045 + k) * 3.2, y)
    }
    ctx.stroke()
  }
}

function paintKioskRough(ctx, n) {
  ctx.fillStyle = '#8c8c88'
  ctx.fillRect(0, 0, n, n)
  for (let i = 0; i < 1400; i += 1) {
    const light = Math.random() > 0.45
    ctx.fillStyle = light
      ? `rgba(230,230,224,${0.08 + Math.random() * 0.12})`
      : `rgba(22,22,20,${0.1 + Math.random() * 0.14})`
    ctx.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 3, 1)
  }
  for (let k = 0; k < 28; k += 1) {
    ctx.strokeStyle = `rgba(18,18,16,${0.16 + (k % 3) * 0.1})`
    ctx.lineWidth = 0.5
    const x = (k * 29) % n
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (k % 5 - 2) * 10, n)
    ctx.stroke()
  }
}

const HOSE = { color: '#2c1c12', roughness: 0.78, metalness: 0.22 }

function CarHardware({ carL, lead, tail }) {
  return (
    <group>
      {lead ? (
        <group>
          <mesh position={[0, 0.4, 0.42]}>
            <boxGeometry args={[0.3, 0.22, 0.4]} />
            <meshStandardMaterial color="#2a2e32" roughness={0.48} metalness={0.68} />
          </mesh>
          {[-0.22, 0.22].map((x) => (
            <mesh
              key={`hose-${x}`}
              position={[x, 0.28, 0.32]}
              rotation={[Math.PI / 2.2, 0, x > 0 ? 0.4 : -0.4]}
            >
              <torusGeometry args={[0.12, 0.024, 6, 10, Math.PI]} />
              <meshStandardMaterial {...HOSE} />
            </mesh>
          ))}
          {[-0.42, 0.42].map((x) => (
            <mesh key={`shackle-${x}`} position={[x, 0.38, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.07, 0.016, 6, 10]} />
              <meshStandardMaterial color="#3a3834" roughness={0.45} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ) : null}
      {!tail ? (
        <group position={[0, 0.5, -carL - TRAIN_COUPLE * 0.5]}>
          <mesh>
            <boxGeometry args={[0.28, 0.22, Math.max(0.12, TRAIN_COUPLE)]} />
            <meshStandardMaterial color="#2a2c2e" roughness={0.55} metalness={0.65} />
          </mesh>
          {[-0.15, 0.15].map((x) => (
            <mesh
              key={x}
              position={[x, -0.06, 0]}
              rotation={[Math.PI / 2, 0, x > 0 ? 0.45 : -0.45]}
            >
              <torusGeometry args={[0.1, 0.018, 6, 12, Math.PI]} />
              <meshStandardMaterial {...HOSE} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  )
}

function TrainCar({ maps, body, frontGeo, roofGeo, carL, carW, carH, arch, wallTop, zOffset, lead, tail, headLights }) {
  const { settings } = useGfx()
  return (
    <group position={[0, 0, zOffset]}>
      <mesh geometry={body} position={[0, 0, -0.03]}>
        <meshStandardMaterial color="#c8ced3" roughness={0.48} metalness={0.34} />
      </mesh>
      <mesh geometry={roofGeo} position={[0, 0.012, 0]}>
        <meshStandardMaterial
          map={maps.roof}
          color="#e4e8ec"
          roughness={0.48}
          metalness={0.28}
          emissive="#9aa4ae"
          emissiveIntensity={0.22}
        />
      </mesh>
      {lead ? (
        <mesh geometry={frontGeo} position={[0, 0, 0.035]}>
          <meshStandardMaterial
            map={maps.front}
            roughness={0.46}
            metalness={0.22}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : (
        <mesh position={[0, wallTop * 0.48, 0.02]}>
          <boxGeometry args={[carW * 0.96, wallTop * 0.92, 0.08]} />
          <meshStandardMaterial color="#aeb4ba" roughness={0.42} metalness={0.4} />
        </mesh>
      )}
      <mesh position={[0, wallTop * 0.48, -carL + 0.02]}>
        <boxGeometry args={[carW * 0.96, wallTop * 0.92, 0.08]} />
        <meshStandardMaterial color="#aeb4ba" roughness={0.42} metalness={0.4} />
      </mesh>
      {!tail ? (
        <mesh position={[0, wallTop * 0.5, -carL - TRAIN_COUPLE * 0.5]}>
          <boxGeometry args={[carW * 0.98, wallTop * 0.96, TRAIN_COUPLE + 0.22]} />
          <meshStandardMaterial color="#c4cad0" roughness={0.48} metalness={0.3} />
        </mesh>
      ) : null}
      {lead ? [-1, 1].map((side) => (
        <mesh key={`nose-${side}`} position={[side * (carW / 2), wallTop * 0.5, 0.04]}>
          <boxGeometry args={[0.08, wallTop, 0.14]} />
          <meshStandardMaterial color="#c8ced3" roughness={0.48} metalness={0.34} />
        </mesh>
      )) : null}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (carW / 2 + 0.01), wallTop * 0.5, -carL / 2 + 0.02]}
          rotation={[0, side * Math.PI / 2, 0]}
        >
          <planeGeometry args={[carL + 0.08, wallTop]} />
          <meshStandardMaterial
            map={side === -1 ? maps.sidePlatform : maps.side}
            roughness={0.46}
            metalness={0.22}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.13, -carL / 2]}>
        <boxGeometry args={[carW * 1.02, 0.26, carL * 0.98]} />
        <meshStandardMaterial color="#1a1c1e" roughness={0.88} metalness={0.12} />
      </mesh>
      <CarHardware carL={carL} lead={lead} tail={tail} />
      {lead && settings.extras
        ? [-0.62, 0.62].map((x, i) => (
          <pointLight
            key={x}
            ref={(node) => { if (headLights) headLights.current[i] = node }}
            position={[x, 1.05, 0.28]}
            color="#fff3c4"
            intensity={3.6}
            distance={8}
            decay={2}
          />
        ))
        : null}
    </group>
  )
}

function Train({ invite = false }) {
  const { startSettings, settings } = useGfx()
  const root = useRef()
  const glowLight = useRef()
  const headLights = useRef([])
  const hover = useRef(0)
  const hoverTarget = useRef(0)
  const [lineIndex, setLineIndex] = useState(0)
  const line = TRAIN_LINES[lineIndex]
  const motion = useRef({
    phase: 'parked',
    z: TRAIN_Z,
    speed: 0,
    nextLine: 1,
  })
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const maps = useMemo(() => {
    const front = makeLabelTexture(
      (ctx, w, h) => paintCarFront(ctx, w, h, line),
      startSettings.trainFront,
      startSettings.trainFront,
    )
    const side = makeLabelTexture(paintCarSide, startSettings.trainSide[0], startSettings.trainSide[1])
    const sidePlatform = makeLabelTexture(
      (ctx, w, h) => paintCarSide(ctx, w, h, { reverse: true }),
      startSettings.trainSide[0],
      startSettings.trainSide[1],
    )
    const roof = makeCanvasTexture(paintRoofRibs, 256, THREE.SRGBColorSpace)
    roof.wrapS = THREE.RepeatWrapping
    roof.wrapT = THREE.RepeatWrapping
    roof.repeat.set(8, 1)
    return { front, side, sidePlatform, roof }
  }, [line, TRAIN_REV, startSettings])

  const carL = TRAIN_CAR_L
  const carW = 2.9
  const carH = 3.2
  const arch = 0.32
  const wallTop = carH - arch
  const body = useMemo(
    () => createCarBodyGeometry(carW, carH, carL, arch),
    [carW, carH, carL, arch],
  )
  const frontGeo = useMemo(
    () => createCarFrontGeometry(carW, carH, arch),
    [carW, carH, arch],
  )
  const roofGeo = useMemo(
    () => createCarRoofGeometry(carW, carH, carL, arch),
    [carW, carH, carL, arch],
  )
  useLayoutEffect(() => () => {
    Object.values(maps).forEach((tex) => tex.dispose())
  }, [maps])
  useLayoutEffect(() => () => {
    body.dispose()
    frontGeo.dispose()
    roofGeo.dispose()
  }, [body, frontGeo, roofGeo])

  const y = TRAIN_Y
  const trainLen = TRAIN_CAR_N * TRAIN_UNIT

  useFrame((state, dt) => {
    if (!root.current) return
    const d = Math.min(dt, 0.05)
    const m = motion.current
    const t = state.clock.elapsedTime
    const parked = m.phase === 'parked' && !reducedMotion

    const wantHover = hoverTarget.current > 0 && parked
    hover.current = THREE.MathUtils.lerp(hover.current, wantHover ? 1 : 0, 1 - Math.exp(-10 * d))
    const h = hover.current
    const call = invite && parked
    const idle = parked ? 0.5 + 0.5 * Math.sin(t * (call ? 1.15 : 1.35)) : 0
    const s = 1 + h * 0.028 + idle * (call ? 0.018 : 0.008)
    root.current.scale.set(s, s, s)
    if (glowLight.current) {
      glowLight.current.intensity = (parked ? (call ? 1.25 : 0.55) + idle * (call ? 1.7 : 0.85) : 0) + h * 3.4
    }
    headLights.current.forEach((light) => {
      if (light) light.intensity = 3.6 + (parked ? idle * (call ? 1.85 : 1.0) : 0) + h * 2.2
    })

    if (m.phase === 'departing') {
      hoverTarget.current = 0
      m.speed = Math.min(22, m.speed + d * 9)
      m.z += m.speed * d
      root.current.position.z = m.z
      if (m.z >= TRAIN_DEPART_Z) {
        const next = m.nextLine
        m.phase = 'arriving'
        m.z = TRAIN_ARRIVE_Z
        m.speed = 10
        root.current.position.z = m.z
        setLineIndex(next)
      }
      return
    }

    if (m.phase === 'arriving') {
      const remain = TRAIN_Z - m.z
      m.speed = Math.max(2.2, Math.min(14, remain * 0.55))
      m.z = Math.min(TRAIN_Z, m.z + m.speed * d)
      root.current.position.z = m.z
      if (m.z >= TRAIN_Z - 0.04) {
        m.z = TRAIN_Z
        m.speed = 0
        m.phase = 'parked'
        root.current.position.z = TRAIN_Z
      }
    }
  })

  const onTrainClick = (event) => {
    event.stopPropagation()
    if (reducedMotion) return
    const m = motion.current
    if (m.phase !== 'parked') return
    hoverTarget.current = 0
    m.phase = 'departing'
    m.speed = 1.2
    m.nextLine = (lineIndex + 1) % TRAIN_LINES.length
  }

  return (
    <group
      ref={root}
      position={[TRACK_CX, y, TRAIN_Z]}
      onClick={onTrainClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (motion.current.phase === 'parked' && !reducedMotion) {
          hoverTarget.current = 1
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        hoverTarget.current = 0
        document.body.style.cursor = 'auto'
      }}
    >
      {settings.extras ? (
        <pointLight position={[-2.4, 2.1, 1.6]} color="#e4ebf2" intensity={5.5} distance={14} decay={2} />
      ) : null}
      <pointLight
        ref={glowLight}
        position={[0, 1.4, 1.1]}
        color="#fff6e0"
        intensity={0}
        distance={10}
        decay={2}
      />
      {Array.from({ length: TRAIN_CAR_N }, (_, i) => (
        <TrainCar
          key={i}
          maps={maps}
          body={body}
          frontGeo={frontGeo}
          roofGeo={roofGeo}
          carL={carL}
          carW={carW}
          carH={carH}
          arch={arch}
          wallTop={wallTop}
          zOffset={-i * TRAIN_UNIT}
          lead={i === 0}
          tail={i === TRAIN_CAR_N - 1}
          headLights={i === 0 ? headLights : null}
        />
      ))}
      <mesh position={[0, carH * 0.45, -trainLen * 0.45]}>
        <boxGeometry args={[carW * 1.2, carH, trainLen * 0.95]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}


// Cross-fixture: short tubes that span the ceiling width, receding into depth
const FIXTURE_COLOR = '#f5f0e8'   // warm off-white, slightly yellowish like real fluorescents
const FIXTURE_W     = FLOOR_W * 0.72   // fixture spans most of ceiling width
const FIXTURE_COUNT = 6           // what you can actually see from the kiosk
const FIXTURE_Z0    = 2.0
const FIXTURE_STEP  = 3.8

// One cross-ceiling fluorescent row
function CeilingFixture({ z, index, lit = true, flicker, gain = 5.4 }) {
  const tubeRef  = useRef()
  const diffuserRef = useRef()
  const lightRef = useRef()

  useFrame(() => {
    if (!lit && index > 3) return
    const pulse = flicker?.current
    const level = pulse && pulse.index === index ? pulse.mul : 1
    if (tubeRef.current) tubeRef.current.material.emissiveIntensity = level * 10
    if (diffuserRef.current) diffuserRef.current.material.emissiveIntensity = level * 2.2
    if (lightRef.current) lightRef.current.intensity = level * gain
  })

  const y = HEIGHT - 0.34
  const cx = WALL_X + FLOOR_W * 0.42   // centre of ceiling span

  return (
    <group position={[cx, y, z]}>
      <mesh>
        <boxGeometry args={[FIXTURE_W, 0.055, 0.28]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh ref={diffuserRef} position={[0, -0.026, 0]}>
        <boxGeometry args={[FIXTURE_W - 0.04, 0.008, 0.2]} />
        <meshStandardMaterial
          color={FIXTURE_COLOR}
          emissive={FIXTURE_COLOR}
          emissiveIntensity={2.2}
          roughness={0.18}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={tubeRef} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, FIXTURE_W - 0.08, 8]} />
        <meshStandardMaterial
          color={FIXTURE_COLOR}
          emissive={FIXTURE_COLOR}
          emissiveIntensity={10}
          roughness={0.1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* Real lights only on nearer rows — bloom still sells the glow farther back */}
      {lit ? (
        <pointLight
        ref={lightRef}
          color={FIXTURE_COLOR}
          intensity={gain}
          distance={6.5}
          decay={2}
          position={[0, -0.35, 0]}
        />
      ) : null}
    </group>
  )
}

function Fluorescents() {
  const { settings } = useGfx()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // One nearby tube, every ~5–6s: two tiny dips so it reads as a ballast stutter.
  const flicker = useRef({
    index: -1,
    mul: 1,
    wait: 5.2,
    hold: 0,
    stage: 0,
  })

  useFrame((_, dt) => {
    const f = flicker.current
    if (reducedMotion) {
      f.index = -1
      f.mul = 1
      return
    }
    const d = Math.min(dt, 0.05)
    if (f.hold > 0) {
      f.hold -= d
      if (f.stage === 1) f.mul = 0.78
      else if (f.stage === 2) f.mul = 1
      else if (f.stage === 3) f.mul = 0.84
      if (f.hold > 0) return
      if (f.stage === 1) {
        f.stage = 2
        f.hold = 0.04
        f.mul = 1
      } else if (f.stage === 2) {
        f.stage = 3
        f.hold = 0.055 + Math.random() * 0.035
        f.mul = 0.84
      } else {
        f.stage = 0
        f.index = -1
        f.mul = 1
        f.wait = 5.05 + Math.random() * 1.15
      }
      return
    }
    f.wait -= d
    if (f.wait > 0) return
    f.index = 1 + Math.floor(Math.random() * 3)
    f.stage = 1
    f.hold = 0.048 + Math.random() * 0.03
    f.mul = 0.78
  })

  return (
    <group>
      {Array.from({ length: FIXTURE_COUNT }, (_, i) => (
        <CeilingFixture
          key={i}
          index={i}
          z={FIXTURE_Z0 - i * FIXTURE_STEP}
          lit={i < settings.lights}
          gain={settings.tube}
          flicker={flicker}
        />
      ))}
    </group>
  )
}

function StationBloom() {
  const { gl, scene, camera, size } = useThree()
  const composer = useMemo(() => {
    const next = new EffectComposer(gl, {
      multisampling: 0,
      frameBufferType: THREE.HalfFloatType,
    })
    next.addPass(new RenderPass(scene, camera))
    next.addPass(new EffectPass(camera, new BloomEffect({
      intensity: 1.35,
      luminanceThreshold: 0.72,
      luminanceSmoothing: 0.42,
      mipmapBlur: true,
    })))
    next.addPass(new EffectPass(camera, new FXAAEffect()))
    return next
  }, [camera, gl, scene])

  useLayoutEffect(() => {
    composer.setSize(size.width, size.height)
  }, [composer, size.height, size.width])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame((_, delta) => {
    composer.render(delta)
  }, 1)

  return null
}

function Atmosphere() {
  const { settings } = useGfx()
  return (
    <>
      <color attach="background" args={[COL.clear]} />
      <fogExp2 attach="fog" args={[COL.clear, settings.fog]} />
      <hemisphereLight args={['#e8e4dc', '#3a3632', settings.hemi]} />
      <ambientLight intensity={settings.ambient} color="#f0ebe4" />
      <Fluorescents />
    </>
  )
}

/** Tiny NYC vibe rat — pear body, pink feet/tail, bob-scurry every so often */
const RAT_FUR = '#7a5a44'
const RAT_FUR_DARK = '#5a4030'
const RAT_PINK = '#f0b0be'
const RAT_PINK_DEEP = '#e08098'
const RAT_EYE = '#14110f'

// Track-only left↔right: duck under the platform lip (TRACK_X0) ↔ far side of the trench
const RAT_UNDER = TRACK_X0 - 0.42
const RAT_FAR = TRACK_X0 + TRACK_W - 0.35
const RAT_Y = TRACK_Y + 0.11

const RAT_PATHS = [
  { a: [RAT_FAR, RAT_Y, -3.6], b: [RAT_UNDER, RAT_Y, -3.65], speed: 2.6 },
  { a: [RAT_UNDER, RAT_Y, -4.5], b: [RAT_FAR, RAT_Y, -4.55], speed: 2.5 },
  { a: [RAT_FAR, RAT_Y, -5.4], b: [RAT_UNDER, RAT_Y, -5.35], speed: 2.7 },
  { a: [RAT_UNDER, RAT_Y, -6.3], b: [RAT_FAR, RAT_Y, -6.35], speed: 2.4 },
  { a: [RAT_FAR, RAT_Y, -7.1], b: [RAT_UNDER, RAT_Y, -7.15], speed: 2.8 },
]

function VibeRat() {
  const root = useRef()
  const body = useRef()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const state = useRef({
    mode: 'wait',
    t: 0.4 + Math.random() * 0.8,
    path: RAT_PATHS[0],
    progress: 0,
  })

  useFrame((_, dt) => {
    if (!root.current || reducedMotion) return
    const d = Math.min(dt, 0.05)
    const s = state.current
    const g = root.current

    if (s.mode === 'wait') {
      g.visible = false
      s.t -= d
      if (s.t > 0) return
      s.path = RAT_PATHS[Math.floor(Math.random() * RAT_PATHS.length)]
      s.progress = 0
      s.mode = 'run'
      const { a, b } = s.path
      g.position.set(a[0], a[1], a[2])
      g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2])
      g.rotation.z = 0
      g.visible = true
      return
    }

    // run
    const { a, b, speed } = s.path
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1
    s.progress = Math.min(1, s.progress + (d * speed) / span)
    const t = s.progress
    const x = a[0] + (b[0] - a[0]) * t
    const z = a[2] + (b[2] - a[2]) * t
    const baseY = a[1] + (b[1] - a[1]) * t
    const bob = Math.abs(Math.sin(t * Math.PI * 10)) * 0.04
    g.position.set(x, baseY + bob, z)
    g.rotation.y = Math.atan2(b[0] - a[0], b[2] - a[2])
    g.rotation.z = Math.sin(t * Math.PI * 12) * 0.14
    if (body.current) {
      body.current.rotation.x = Math.sin(t * Math.PI * 14) * 0.1
    }

    if (t >= 1) {
      s.mode = 'wait'
      s.t = 1.5 + Math.random() * 2.5
      g.visible = false
    }
  })

  if (reducedMotion) return null

  return (
    <group ref={root} visible={false} scale={0.52} frustumCulled={false}>
      <group ref={body}>
        {/* pear body — fat rear, taper toward nose */}
        <mesh position={[0, 0.22, -0.08]} scale={[0.95, 0.88, 1.15]}>
          <sphereGeometry args={[0.42, 14, 12]} />
          <meshStandardMaterial color={RAT_FUR} roughness={0.88} metalness={0} />
        </mesh>
        <mesh position={[0, 0.2, 0.28]} scale={[0.72, 0.68, 0.78]}>
          <sphereGeometry args={[0.32, 12, 10]} />
          <meshStandardMaterial color={RAT_FUR} roughness={0.86} metalness={0} />
        </mesh>
        {/* ears */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.22, 0.42, 0.32]} rotation={[0.35, side * -0.4, side * 0.35]}>
            <mesh>
              <circleGeometry args={[0.14, 10]} />
              <meshStandardMaterial color={RAT_FUR_DARK} roughness={0.95} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0.01]} scale={0.62}>
              <circleGeometry args={[0.14, 10]} />
              <meshStandardMaterial color={RAT_PINK} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {/* eyes */}
        {[-1, 1].map((side) => (
          <mesh key={`e-${side}`} position={[side * 0.11, 0.26, 0.48]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={RAT_EYE} roughness={0.4} metalness={0.1} />
          </mesh>
        ))}
        {/* snout + nose */}
        <mesh position={[0, 0.16, 0.52]} scale={[0.7, 0.55, 0.85]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color={RAT_FUR_DARK} roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0, 0.15, 0.62]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={RAT_PINK_DEEP} roughness={0.7} metalness={0} />
        </mesh>
        {/* pink feet */}
        {[
          [-0.18, 0.04, 0.18],
          [0.18, 0.04, 0.18],
          [-0.2, 0.04, -0.22],
          [0.2, 0.04, -0.22],
        ].map((p, i) => (
          <mesh key={`f-${i}`} position={p} scale={[1, 0.55, 1.25]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={RAT_PINK} roughness={0.8} metalness={0} />
          </mesh>
        ))}
        {/* tail — pink curve trailing behind */}
        <group position={[0, 0.18, -0.48]} rotation={[0.4, 0, 0.45]}>
          <mesh position={[0, 0, -0.22]} rotation={[0.5, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.018, 0.55, 6]} />
            <meshStandardMaterial color={RAT_PINK} roughness={0.75} metalness={0} />
          </mesh>
          <mesh position={[0.02, -0.08, -0.52]} rotation={[0.9, 0.2, 0]}>
            <cylinderGeometry args={[0.018, 0.01, 0.28, 6]} />
            <meshStandardMaterial color={RAT_PINK_DEEP} roughness={0.75} metalness={0} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Winter-exhaust style steam off the train undercarriage — not station-wide dust */
const STEAM_N = 48

function TrainSteam() {
  const points = useRef()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const { positions, vel, life } = useMemo(() => {
    const pos = new Float32Array(STEAM_N * 3)
    const v = new Float32Array(STEAM_N * 3)
    const lf = new Float32Array(STEAM_N)
    const trainY = TRACK_Y + 0.14
    for (let i = 0; i < STEAM_N; i += 1) {
      const i3 = i * 3
      pos[i3] = TRACK_CX - 1.15 + (Math.random() - 0.5) * 0.55
      pos[i3 + 1] = trainY + 0.15 + Math.random() * 0.35
      pos[i3 + 2] = TRAIN_Z - Math.random() * 12
      v[i3] = -0.04 + Math.random() * 0.08
      v[i3 + 1] = 0.35 + Math.random() * 0.55
      v[i3 + 2] = -0.12 + Math.random() * 0.2
      lf[i] = Math.random()
    }
    return { positions: pos, vel: v, life: lf }
  }, [])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, dt) => {
    if (reducedMotion || !points.current) return
    const d = Math.min(dt, 0.05)
    const arr = points.current.geometry.attributes.position.array
    const trainY = TRACK_Y + 0.14
    const mat = points.current.material
    let alive = 0
    for (let i = 0; i < STEAM_N; i += 1) {
      const i3 = i * 3
      life[i] += d * (0.35 + (i % 5) * 0.04)
      arr[i3] += vel[i3] * d
      arr[i3 + 1] += vel[i3 + 1] * d
      arr[i3 + 2] += vel[i3 + 2] * d
      vel[i3 + 1] *= 1 - 0.35 * d
      if (life[i] > 1 || arr[i3 + 1] > trainY + 2.4) {
        life[i] = 0
        arr[i3] = TRACK_CX - 1.15 + (Math.random() - 0.5) * 0.55
        arr[i3 + 1] = trainY + 0.12 + Math.random() * 0.25
        arr[i3 + 2] = TRAIN_Z - Math.random() * 12
        vel[i3] = -0.04 + Math.random() * 0.08
        vel[i3 + 1] = 0.4 + Math.random() * 0.5
        vel[i3 + 2] = -0.12 + Math.random() * 0.2
      } else {
        alive += 1 - life[i]
      }
    }
    points.current.geometry.attributes.position.needsUpdate = true
    if (mat) mat.opacity = 0.18 + (alive / STEAM_N) * 0.22
  })

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#dce4e8"
        size={0.22}
        sizeAttenuation
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function Signage({ locked = false }) {
  const [metal, arrowTex] = useLoader(THREE.TextureLoader, [
    '/subwaysign.jpg',
    '/subway-arrow-down.png',
  ])
  const [maps, setMaps] = useState(null)

  useLayoutEffect(() => {
    const arrowImg = arrowTex.image ? lumaAsAlpha(arrowTex.image) : null
    const exitMap = makeLabelTexture(
      (ctx, w, h) => paintExitSign(ctx, w, h, metal.image, arrowImg),
      2000,
      400,
    )
    const bodyMap = metal.clone()
    bodyMap.wrapS = THREE.RepeatWrapping
    bodyMap.wrapT = THREE.RepeatWrapping
    bodyMap.repeat.set(2.4, 0.55)
    bodyMap.colorSpace = THREE.SRGBColorSpace
    bodyMap.anisotropy = 8
    bodyMap.needsUpdate = true
    setMaps({ exitMap, bodyMap })
    return () => {
    exitMap.dispose()
    bodyMap.dispose()
    }
  }, [metal, arrowTex, SIGN_REV])

  const signW = 2.02
  const signH = 0.41
  const rodH = 0.64
  const unit = useRef()
  const hoverAmt = useRef(0)
  const hovering = useRef(false)
  const kickZ = useRef(0)
  const kickVZ = useRef(0)
  const kickX = useRef(0)
  const kickVX = useRef(0)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const kickDirZ = useRef(1)
  const kickDirX = useRef(-1)

  useFrame((state, dt) => {
    if (!unit.current) return
    const d = Math.min(dt, 0.05)
    const t = state.clock.elapsedTime
    const want = hovering.current && !locked && !reducedMotion
    hoverAmt.current = THREE.MathUtils.lerp(hoverAmt.current, want ? 1 : 0, 1 - Math.exp(-10 * d))
    const h = hoverAmt.current

    kickVZ.current += -kickZ.current * 52 * d
    kickVZ.current *= Math.exp(-8.5 * d)
    kickZ.current = THREE.MathUtils.clamp(kickZ.current + kickVZ.current * d, -0.045, 0.045)
    kickVX.current += -kickX.current * 48 * d
    kickVX.current *= Math.exp(-8.2 * d)
    kickX.current = THREE.MathUtils.clamp(kickX.current + kickVX.current * d, -0.04, 0.04)

    const live = !locked && !reducedMotion
    const sway = live ? 1 : 0
    const s = 1 + h * 0.035
    unit.current.scale.set(s, s, s)
    unit.current.rotation.z = Math.sin(t * 1.15) * 0.012 * sway + kickZ.current
    unit.current.rotation.x = Math.sin(t * 0.88) * 0.011 * sway + kickX.current
  })

  const onHit = (event) => {
    event.stopPropagation()
    if (locked || reducedMotion) return
    kickDirZ.current *= -1
    kickDirX.current *= Math.random() > 0.3 ? -1 : 1
    kickVZ.current += kickDirZ.current * (0.65 + Math.random() * 0.45)
    kickVX.current += kickDirX.current * (0.6 + Math.random() * 0.5)
  }

  return (
    <group position={[STAIR_X, 2.95, STAIR_Z0 - STAIR_N * STAIR_RUN * 0.28]} rotation={[0, 0.04, 0]}>
      {/* Ceiling pivot — rods and board are one rigid piece under this */}
      <group
        ref={unit}
        onClick={onHit}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (locked) return
          hovering.current = true
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hovering.current = false
          document.body.style.cursor = 'auto'
        }}
      >
        {[-signW * 0.3, signW * 0.3].map((x) => (
          <mesh key={x} position={[x, -rodH / 2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, rodH, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.55} metalness={0.35} />
          </mesh>
        ))}
        <group position={[0, -rodH - signH / 2, 0]}>
          {maps ? (
            <>
              <mesh position={[0, 0, -0.016]} frustumCulled={false}>
            <boxGeometry args={[signW, signH, 0.032]} />
            <meshStandardMaterial
                  map={maps.bodyMap}
              color="#9a9a9a"
              roughness={0.52}
              metalness={0.12}
            />
          </mesh>
              <mesh position={[0, 0, 0.011]} frustumCulled={false}>
            <planeGeometry args={[signW - 0.02, signH - 0.016]} />
                <meshBasicMaterial map={maps.exitMap} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
            </>
          ) : (
            <mesh frustumCulled={false}>
              <boxGeometry args={[signW, signH, 0.032]} />
              <meshStandardMaterial color="#888888" roughness={0.55} metalness={0.1} />
            </mesh>
          )}
          <mesh>
            <boxGeometry args={[signW * 1.05, signH * 1.15, 0.08]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function wallBoardList() {
  const { pitch } = getWallFace()
  return [
    { id: 'photo', z: WALL_BOARD_Z0, title: 'PHOTO', accent: '#0039A6' },
    { id: 'video', z: WALL_BOARD_Z0 - pitch, title: 'VIDEO', accent: '#00933C' },
    { id: 'about', z: WALL_BOARD_Z0 - pitch * 2, title: 'ABOUT', accent: '#996633' },
  ]
}

function makeBoardLabel(title, accent) {
  const w = 512
  const h = 96
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 10, h)
  ctx.fillStyle = '#fff'
  ctx.font = `bold 48px ${FONT}`
  ctx.letterSpacing = '-2px'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, 28, h * 0.54)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function WallBoards({ wall, wallHuds, immersed = false, immersedId = null, onSelect, invite = false, projectHtml = true }) {
  const face = wall || getWallFace()
  const boards = wallBoardList()
  const labels = useMemo(
    () => Object.fromEntries(wallBoardList().map((b) => [b.id, makeBoardLabel(b.title, b.accent)])),
    [],
  )
  const screens = useRef({})
  const glowMats = useRef({})
  const glowLights = useRef({})
  const inviteRef = useRef(invite)
  inviteRef.current = invite
  const { camera, size, scene } = useThree()
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toObj = useMemo(() => new THREE.Vector3(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const lastCam = useRef('')
  const lastObj = useRef({ photo: '', video: '', about: '' })
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useLayoutEffect(() => () => {
    Object.values(labels).forEach((t) => t.dispose())
  }, [labels])

  useFrame((state) => {
    const liveBoards = wallBoardList()
    const pulse = inviteRef.current && !reducedMotion && !immersed
      ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.2)
      : 0
    liveBoards.forEach((b) => {
      const mat = glowMats.current[b.id]
      if (mat) mat.opacity = pulse ? 0.05 + pulse * 0.14 : 0
      const light = glowLights.current[b.id]
      if (light) light.intensity = pulse ? 0.12 + pulse * 0.28 : 0
    })

    const { panelW, panelH, contentW } = getWallFace()
    const pxPerMeter = panelW / contentW
    const root = wallHuds?.current?.root || document.querySelector('[data-wall-hud="root"]')
    const camEl = wallHuds?.current?.cam || document.querySelector('[data-wall-hud="cam"]')
    if (!root || !camEl) return

    if (!projectHtml && !(immersed && isWallPov(immersedId))) {
      root.style.visibility = 'hidden'
      liveBoards.forEach((b) => {
        const objEl = wallHuds.current.obj?.[b.id] || document.querySelector(`[data-wall-hud="obj-${b.id}"]`)
        if (objEl) objEl.style.visibility = 'hidden'
      })
      return
    }

    if (immersed && isWallPov(immersedId)) {
      root.style.visibility = 'visible'
      root.style.perspective = 'none'
      root.style.width = `${size.width}px`
      root.style.height = `${size.height}px`
      camEl.style.transform = 'none'
      lastCam.current = ''
      liveBoards.forEach((b) => {
        const objEl = wallHuds.current.obj?.[b.id] || document.querySelector(`[data-wall-hud="obj-${b.id}"]`)
        if (!objEl) return
        if (b.id === immersedId) {
          objEl.style.transform = 'none'
          objEl.style.visibility = 'visible'
          lastObj.current[b.id] = ''
        } else {
          objEl.style.visibility = 'hidden'
        }
      })
      return
    }

    camera.updateMatrixWorld()
    camera.getWorldDirection(camDir)

    const camXform = css3dCameraTransform(root, camEl, camera, size)
    if (camXform !== lastCam.current || camEl.style.transform !== camXform) {
      lastCam.current = camXform
      camEl.style.transform = camXform
    }

    let closestId = null
    let closestDist = Infinity
    const facing = []
    liveBoards.forEach((b) => {
      const objEl = wallHuds.current.obj?.[b.id] || document.querySelector(`[data-wall-hud="obj-${b.id}"]`)
      const mesh = screens.current[b.id]
      if (!objEl || !mesh) return

      mesh.updateWorldMatrix(true, false)
      toObj.setFromMatrixPosition(mesh.matrixWorld).sub(camera.position)
      const dist = toObj.length()
      const seen = toObj.angleTo(camDir) <= Math.PI / 2
      facing.push({ b, objEl, mesh, dist, seen })
      if (seen && dist < closestDist) {
        closestDist = dist
        closestId = b.id
      }
    })

    const closeup = closestDist < 2.2
    const kiosk = scene.getObjectByName('kiosk-occlude')
    const pillars = scene.getObjectByName('pillar-occlude')
    let anyFacing = false
    facing.forEach(({ b, objEl, mesh, dist, seen }) => {
      let show = seen && (!closeup || b.id === closestId)
      if (show && dist > 0.2) {
        toObj.setFromMatrixPosition(mesh.matrixWorld).sub(camera.position)
        ray.set(camera.position, toObj.normalize())
        ray.far = dist - 0.1
        const hitKiosk = dist < 3.6 && kiosk && ray.intersectObject(kiosk, true).length
        const hitPillar = pillars && ray.intersectObject(pillars, true).length
        if (hitKiosk || hitPillar) show = false
      }
      if (!show) {
        objEl.style.visibility = 'hidden'
        return
      }

      const objXform = objectCssMatrix(mesh.matrixWorld, pxPerMeter, panelW, panelH)
      if (objXform !== lastObj.current[b.id] || objEl.style.transform !== objXform) {
        lastObj.current[b.id] = objXform
        objEl.style.transform = objXform
      }
      objEl.style.visibility = 'visible'
      anyFacing = true
    })
    root.style.visibility = anyFacing ? 'visible' : 'hidden'
  })

  const x = WALL_X + 0.04
  const faceX = 0.035
  const contentX = 0.038
  const lip = WALL_BEZEL
  const frameD = 0.032
  const chrome = { color: '#e8ebef', roughness: 0.2, metalness: 0.86 }
  const { boardW, boardH, boardY, contentW, contentH, contentY, titleY, titleH } = face
  const y = Number.isFinite(boardY) ? boardY : 1.72

  return (
    <group>
      {boards.map((b) => (
        <group key={`${b.id}-${boardW.toFixed(2)}-${boardH.toFixed(2)}-${y.toFixed(2)}`} position={[x, y, b.z]}>
          <mesh position={[0.018, (boardH + lip) / 2, 0]}>
            <boxGeometry args={[frameD, lip, boardW + lip * 2]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0.018, -(boardH + lip) / 2, 0]}>
            <boxGeometry args={[frameD, lip, boardW + lip * 2]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0.018, 0, (boardW + lip) / 2]}>
            <boxGeometry args={[frameD, boardH, lip]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[0.018, 0, -(boardW + lip) / 2]}>
            <boxGeometry args={[frameD, boardH, lip]} />
            <meshStandardMaterial {...chrome} />
          </mesh>
          <mesh position={[faceX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boardW + lip * 0.6, boardH + lip * 0.6]} />
            <meshBasicMaterial color="#0c0e10" toneMapped={false} />
          </mesh>
          <pointLight
            ref={(n) => { glowLights.current[b.id] = n }}
            position={[0.28, 0, 0]}
            color={b.accent}
            intensity={0}
            distance={2.6}
            decay={2}
          />
          <mesh position={[faceX + 0.012, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boardW + 0.12, boardH + 0.12]} />
            <meshBasicMaterial
              ref={(n) => { glowMats.current[b.id] = n }}
              color={b.accent}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[faceX + 0.002, titleY, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[boardW + lip * 0.4, titleH]} />
            <meshBasicMaterial map={labels[b.id]} toneMapped={false} />
          </mesh>
          <mesh
            position={[contentX, contentY, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[contentW, contentH]} />
            <meshBasicMaterial color="#0c0e10" toneMapped={false} />
          </mesh>
          {immersed ? null : (
            <mesh
              position={[contentX + 0.02, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(b.id)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto'
              }}
            >
              <planeGeometry args={[boardW, boardH]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
      {boards.map((b) => (
        <object3D
          key={`${b.id}-screen`}
          ref={(n) => { screens.current[b.id] = n }}
          position={[x + contentX + 0.004, y + contentY, b.z]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}
    </group>
  )
}

function Benches() {
  const maps = useMemo(() => {
    const wood = makeCanvasTexture(paintWood, 512, THREE.SRGBColorSpace)
    wood.anisotropy = 8
    wood.repeat.set(0.45, 2.2)
    return { wood }
  }, [])

  useLayoutEffect(() => () => {
    maps.wood.dispose()
  }, [maps])

  const len = 2.35
  const depth = 0.52
  const seatT = 0.09
  const seatTop = 0.42
  const seatY = seatTop - seatT / 2
  const gap = 0.13
  const backH = 0.19
  const backT = 0.07
  const nDiv = 6
  const divW = 0.07
  const x = WALL_X + depth * 0.5 + 0.06
  const zs = [-3.4, -5.8]
  const oak = { map: maps.wood, roughness: 0.72, metalness: 0.02 }

  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[x, 0, z]}>
          {[1, 4].map((i) => {
            const dz = -len / 2 + (i / (nDiv - 1)) * len
            return (
              <mesh key={dz} position={[-0.05, seatY - seatT / 2 - 0.155, dz]}>
                <boxGeometry args={[depth * 0.52, 0.31, 0.09]} />
                <meshStandardMaterial {...oak} />
              </mesh>
            )
          })}
          <mesh position={[0, seatY, 0]}>
            <boxGeometry args={[depth, seatT, len]} />
            <meshStandardMaterial {...oak} />
          </mesh>
          <mesh
            position={[-depth / 2 - backT / 2 - 0.022, seatTop + gap + backH / 2, 0]}
          >
            <boxGeometry args={[backT, backH, len]} />
            <meshStandardMaterial {...oak} />
          </mesh>
          {Array.from({ length: nDiv }, (_, i) => {
            const end = i === 0 || i === nDiv - 1
            const divD = end ? depth * 0.48 : depth * 0.34
            const divH = end ? 0.135 : 0.118
            const dz = -len / 2 + (i / (nDiv - 1)) * len
            const dx = -depth / 2 + divD / 2 + 0.08
            return (
              <mesh key={i} position={[dx, seatTop + divH / 2, dz]}>
                <boxGeometry args={[divD, divH, divW]} />
                <meshStandardMaterial {...oak} />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function Stairwell({ maps }) {
  // Chambers-style: freestanding on the platform, facing camera, climbing away (−Z)
  const stepsDepth = STAIR_N * STAIR_RUN
  const topZ = STAIR_Z0 - stepsDepth
  const topY = STAIR_N * STAIR_RISE
  const railLen = Math.hypot(stepsDepth, topY)
  // Tip cylinder toward −Z as it climbs (Three +X rot tips toward +Z)
  const railPitch = -Math.atan2(stepsDepth, topY)
  const colGeom = useMemo(() => createIBeamGeometry(HEIGHT), [])
  useLayoutEffect(() => () => colGeom.dispose(), [colGeom])

  return (
    <group position={[STAIR_X, 0, 0]}>
      {/* Flanking I-beams at the base — Chambers mouth */}
      {[-1, 1].map((s) => (
        <mesh
          key={`col-${s}`}
          geometry={colGeom}
          position={[s * (STAIR_W * 0.58), HEIGHT / 2, STAIR_Z0 + 0.2]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
        </mesh>
      ))}
      {/* Yellow strip at bottom landing */}
      <mesh position={[0, 0.02, STAIR_Z0 + 0.32]}>
        <boxGeometry args={[STAIR_W + 0.2, 0.04, 0.42]} />
        <meshStandardMaterial
          map={maps.yellowMap}
          roughness={0.86}
          metalness={0}
        />
      </mesh>
      {/* Steps — each further from camera and higher */}
      {Array.from({ length: STAIR_N }, (_, i) => {
        const z = STAIR_Z0 - STAIR_RUN * (i + 0.5)
        const y = STAIR_RISE * (i + 0.5)
        const isEdge = i === 0 || i === STAIR_N - 1
        return (
          <group key={i}>
            <mesh position={[0, y, z]}>
              <boxGeometry args={[STAIR_W, STAIR_RISE, STAIR_RUN * 0.96]} />
              <meshStandardMaterial color="#2e3032" roughness={0.88} metalness={0} />
            </mesh>
            {isEdge ? (
              <mesh position={[0, y + STAIR_RISE * 0.52, z + STAIR_RUN * 0.28]}>
                <boxGeometry args={[STAIR_W, 0.022, 0.055]} />
                <meshStandardMaterial
                  map={maps.yellowMap}
                  roughness={0.84}
                  metalness={0}
                />
              </mesh>
            ) : null}
          </group>
        )
      })}
      {/* Top landing + yellow nosing */}
      <mesh position={[0, topY + 0.04, topZ - 0.4]}>
        <boxGeometry args={[STAIR_W + 0.08, 0.08, 0.85]} />
        <meshStandardMaterial color="#2a2c2e" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, topY + 0.09, topZ - 0.05]}>
        <boxGeometry args={[STAIR_W + 0.08, 0.025, 0.08]} />
        <meshStandardMaterial
          map={maps.yellowMap}
          roughness={0.84}
          metalness={0}
        />
      </mesh>
      {/* Dark mouth above landing — exit up */}
      <mesh position={[0, topY + 1.05, topZ - 0.95]}>
        <boxGeometry args={[STAIR_W + 0.55, 1.9, 1.15]} />
        <meshStandardMaterial
          color="#060806"
          roughness={1}
          metalness={0}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Open sides: black rail frames + chrome handrails */}
      {[-1, 1].map((s) => {
        const rx = s * (STAIR_W * 0.48)
        const midZ = STAIR_Z0 - stepsDepth * 0.5
        return (
          <group key={`rail-${s}`}>
            <mesh position={[rx, topY * 0.5 + 0.72, midZ]} rotation={[railPitch, 0, 0]}>
              <cylinderGeometry args={[0.028, 0.028, railLen, 8]} />
              <meshStandardMaterial color="#1a1c1e" roughness={0.55} metalness={0.4} />
            </mesh>
            <mesh
              position={[rx - s * 0.05, topY * 0.5 + 0.92, midZ]}
              rotation={[railPitch, 0, 0]}
            >
              <cylinderGeometry args={[0.02, 0.02, railLen, 8]} />
              <meshStandardMaterial color="#c8cdd2" roughness={0.28} metalness={0.72} />
            </mesh>
            <mesh position={[rx, 0.55, STAIR_Z0 + 0.08]}>
              <cylinderGeometry args={[0.035, 0.035, 1.1, 8]} />
              <meshStandardMaterial color="#1a1c1e" roughness={0.5} metalness={0.45} />
            </mesh>
          </group>
        )
      })}
      <pointLight
        position={[0, topY + 1.35, topZ - 0.25]}
        color="#e8eef2"
        intensity={7}
        distance={7}
        decay={2}
      />
    </group>
  )
}

const KIOSK = {
  x: 0.38,
  z: -4.35,
  cabW: KIOSK_CAB_W,
  cabH: KIOSK_CAB_H,
  cabD: 0.36,
  postH: KIOSK_POST_H,
  postW: 0.09,
  bezel: KIOSK_BEZEL,
  panelW: KIOSK_PANEL_W,
  screenW: KIOSK_SCREEN_W,
  screenH: KIOSK_SCREEN_H,
  panelH: KIOSK_PANEL_H,
}

const cssEps = (v) => (Math.abs(v) < 1e-10 ? 0 : v)

function cssMatrix3d(matrix, multipliers, prepend = '') {
  let out = 'matrix3d('
  for (let i = 0; i < 16; i += 1) {
    out += cssEps(multipliers[i] * matrix.elements[i]) + (i !== 15 ? ',' : ')')
  }
  return prepend + out
}

const CAM_CSS_MUL = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1]

function objectCssMatrix(matrix, factor, panelW, panelH) {
  const f = factor
  // Pixel origin — iOS treats translate(-50%,-50%) as a % of the viewport in 3D,
  // which slides the kiosk HTML down the white cabinet.
  return cssMatrix3d(
    matrix,
    [1 / f, 1 / f, 1 / f, 1, -1 / f, -1 / f, -1 / f, -1, 1 / f, 1 / f, 1 / f, 1, 1, 1, 1, 1],
    `translate(${-panelW / 2}px,${-panelH / 2}px)`,
  )
}

/** Match drei Html: WebKit resolves % perspective-origin against the viewport. */
function css3dCameraTransform(root, camEl, camera, size) {
  const widthHalf = size.width / 2
  const heightHalf = size.height / 2
  const fov = camera.projectionMatrix.elements[5] * heightHalf
  root.style.width = `${size.width}px`
  root.style.height = `${size.height}px`
  root.style.perspective = `${fov}px`
  root.style.perspectiveOrigin = `${widthHalf}px ${heightHalf}px`
  if (camEl) camEl.style.transformOrigin = '0px 0px'
  return `translateZ(${fov}px)${cssMatrix3d(camera.matrixWorldInverse, CAM_CSS_MUL)}translate(${widthHalf}px,${heightHalf}px)`
}

function roundedRectShape(w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  const x = -w / 2
  const y = -h / 2
  const s = new THREE.Shape()
  s.moveTo(x + rad, y)
  s.lineTo(x + w - rad, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rad)
  s.lineTo(x + w, y + h - rad)
  s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
  s.lineTo(x + rad, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rad)
  s.lineTo(x, y + rad)
  s.quadraticCurveTo(x, y, x + rad, y)
  return s
}

/** Clockwise hole so the cabinet is a frame, not a solid slab. */
function roundedRectHole(w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  const x = -w / 2
  const y = -h / 2
  const p = new THREE.Path()
  p.moveTo(x + rad, y)
  p.quadraticCurveTo(x, y, x, y + rad)
  p.lineTo(x, y + h - rad)
  p.quadraticCurveTo(x, y + h, x + rad, y + h)
  p.lineTo(x + w - rad, y + h)
  p.quadraticCurveTo(x + w, y + h, x + w, y + h - rad)
  p.lineTo(x + w, y + rad)
  p.quadraticCurveTo(x + w, y, x + w - rad, y)
  p.lineTo(x + rad, y)
  return p
}

function makeRoundedBoxGeometry(w, h, d, r, holeW, holeH, holeR) {
  const outer = roundedRectShape(w, h, r)
  if (holeW && holeH) {
    outer.holes.push(roundedRectHole(holeW, holeH, holeR ?? r))
  }
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 12,
  })
  geo.translate(0, 0, -d / 2)
  geo.computeVertexNormals()
  return geo
}

function makeRoundedPlaneGeometry(w, h, r) {
  return new THREE.ShapeGeometry(roundedRectShape(w, h, r), 12)
}

function InfoKiosk({ hud, showBoot = true, pickable = false, onPick }) {
  const { settings } = useGfx()
  const { cabW, cabH, cabD, postH, postW, screenW, screenH, panelW, panelH } = KIOSK
  const yCab = postH + cabH / 2
  const screen = useRef()
  const { camera, size } = useThree()
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toObj = useMemo(() => new THREE.Vector3(), [])
  const pxPerMeter = panelW / screenW
  const lastCam = useRef('')
  const lastObj = useRef('')
  const logoTex = useLoader(THREE.TextureLoader, '/mta-logo.jpg')

  useLayoutEffect(() => {
    logoTex.colorSpace = THREE.SRGBColorSpace
    logoTex.anisotropy = 4
    logoTex.needsUpdate = true
  }, [logoTex])

  // CSS-3D projection only while the live overlay is mounted
  useFrame(() => {
    const root = hud?.current?.root
    const camEl = hud?.current?.cam
    const objEl = hud?.current?.obj
    if (!screen.current || !root || !camEl || !objEl) {
      // Overlay unmounted (cabin / boot) — drop cache so remount re-applies transforms
      lastCam.current = ''
      lastObj.current = ''
      return
    }
    camera.updateMatrixWorld()
    screen.current.updateWorldMatrix(true, false)
    camera.getWorldDirection(camDir)
    toObj.setFromMatrixPosition(screen.current.matrixWorld).sub(camera.position)
    if (toObj.angleTo(camDir) > Math.PI / 2) {
      root.style.visibility = 'hidden'
      return
    }
    const camXform = css3dCameraTransform(root, camEl, camera, size)
    const objXform = objectCssMatrix(screen.current.matrixWorld, pxPerMeter, panelW, panelH)
    objEl.style.transformOrigin = '0px 0px'
    // Remounted nodes have empty style — must write even if xform string matches last trip
    if (camXform !== lastCam.current || camEl.style.transform !== camXform) {
      lastCam.current = camXform
      camEl.style.transform = camXform
    }
    if (objXform !== lastObj.current || objEl.style.transform !== objXform) {
      lastObj.current = objXform
      objEl.style.transform = objXform
    }
    // Reveal only after transforms land (avoids top-left flash on remount)
    root.style.visibility = 'visible'
  })

  const faceZ = cabD / 2
  /** LCD sits behind the lip so the 3D bezel frames it (not a flush sticker). */
  const screenZ = faceZ - 0.018
  const well = 0.026
  const holeW = screenW + well * 2
  const holeH = screenH + well * 2
  const outerR = KIOSK_RADIUS_M + 0.022
  const holeR = KIOSK_RADIUS_M + 0.006
  const logoW = screenW * 0.52
  const logoH = logoW * (144 / 256)
  const cabGeo = useMemo(
    () => makeRoundedBoxGeometry(cabW, cabH, cabD, outerR, holeW, holeH, holeR),
    [cabW, cabH, cabD, outerR, holeW, holeH, holeR],
  )
  const linerGeo = useMemo(
    () => makeRoundedBoxGeometry(
      holeW - 0.003,
      holeH - 0.003,
      cabD - 0.05,
      Math.max(0.01, holeR - 0.004),
      screenW + 0.002,
      screenH + 0.002,
      KIOSK_RADIUS_M,
    ),
    [cabD, holeW, holeH, holeR, screenW, screenH],
  )
  const lipGeo = useMemo(
    () => makeRoundedBoxGeometry(
      holeW - 0.002,
      holeH - 0.002,
      0.024,
      holeR,
      screenW + 0.001,
      screenH + 0.001,
      KIOSK_RADIUS_M,
    ),
    [holeW, holeH, holeR, screenW, screenH],
  )
  const screenGeo = useMemo(
    () => makeRoundedPlaneGeometry(screenW + 0.004, screenH + 0.004, KIOSK_RADIUS_M),
    [screenW, screenH],
  )
  const plastic = useMemo(() => {
    const map = makeCanvasTexture(paintKioskPlastic, 256, THREE.SRGBColorSpace)
    const rough = makeCanvasTexture(paintKioskRough, 256, THREE.NoColorSpace)
    map.repeat.set(1.2, 2)
    rough.repeat.set(1.2, 2)
    return { map, rough }
  }, [])
  const blobTex = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,0.62)')
    g.addColorStop(0.35, 'rgba(0,0,0,0.28)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [])
  useLayoutEffect(() => () => {
    cabGeo.dispose()
    linerGeo.dispose()
    lipGeo.dispose()
    screenGeo.dispose()
    plastic.map.dispose()
    plastic.rough.dispose()
    blobTex.dispose()
  }, [blobTex, cabGeo, linerGeo, lipGeo, plastic, screenGeo])

  const shell = {
    map: plastic.map,
    roughnessMap: plastic.rough,
    bumpMap: plastic.rough,
    bumpScale: 0.04,
    color: '#c2c4be',
    roughness: 0.3,
    metalness: 0.38,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  }

  return (
    <group
      position={[KIOSK.x, 0, KIOSK.z]}
      onClick={pickable ? (e) => {
        e.stopPropagation()
        onPick?.()
      } : undefined}
      onPointerOver={pickable ? (e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      } : undefined}
      onPointerOut={pickable ? () => {
        document.body.style.cursor = 'auto'
      } : undefined}
    >
      {settings.kioskFill ? (
        <pointLight
          position={[0.15, yCab + 0.82, 0.72]}
          color="#fff1d4"
          intensity={settings.kioskFill}
          distance={5}
          decay={2}
        />
      ) : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.04]} raycast={() => null}>
        <planeGeometry args={[1.2, 0.78]} />
        <meshBasicMaterial map={blobTex} transparent opacity={1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.032, 0]}>
        <cylinderGeometry args={[0.34, 0.37, 0.064, 24]} />
        <meshPhysicalMaterial {...shell} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.22, postH / 2, 0]}>
          <cylinderGeometry args={[postW * 0.48, postW * 0.56, postH, 14]} />
          <meshPhysicalMaterial {...shell} />
        </mesh>
      ))}
      <group position={[0, yCab, 0]}>
        <mesh geometry={cabGeo}>
          <meshPhysicalMaterial {...shell} />
        </mesh>
        <mesh geometry={linerGeo}>
          <meshStandardMaterial color="#121214" roughness={0.92} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0, faceZ - 0.012]} geometry={lipGeo}>
          <meshStandardMaterial color="#0c0d10" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, -cabD / 2 + 0.014]} geometry={screenGeo}>
          <meshBasicMaterial color="#050505" toneMapped={false} />
        </mesh>
        {showBoot ? (
          <mesh position={[0, 0, -cabD / 2 + 0.016]}>
            <planeGeometry args={[logoW, logoH]} />
            <meshBasicMaterial map={logoTex} toneMapped={false} />
          </mesh>
        ) : (
          <pointLight
            position={[0.1, 0.14, faceZ + 0.2]}
            color="#c5d6ea"
            intensity={2.6}
            distance={1.7}
            decay={2}
          />
        )}
        <object3D ref={screen} position={[0, 0, screenZ]} />
      </group>
      {pickable ? (
        <mesh position={[0, (postH + cabH) * 0.5, 0]}>
          <boxGeometry args={[cabW + 0.2, postH + cabH + 0.16, cabD + 0.22]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}

function ReadyPing({ onReady }) {
  const { gl, scene, camera } = useThree()
  const sent = useRef(false)
  const frames = useRef(0)

  useLayoutEffect(() => {
    try {
      gl.compile(scene, camera)
    } catch {
      /* compile is best-effort */
    }
  }, [camera, gl, scene])

  useFrame(() => {
    if (sent.current) return
    frames.current += 1
    if (frames.current < 4) return
    sent.current = true
    onReady?.()
  })

  return null
}

/** Cheap NYC platform litter — scribbled notes, receipts, crumpled bags. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function paintLitterNote(ctx, n, seed) {
  const rand = mulberry32(seed)
  ctx.fillStyle = `rgb(${168 + rand() * 40},${158 + rand() * 30},${138 + rand() * 25})`
  ctx.fillRect(0, 0, n, n)
  const sx = rand() * n
  const sy = rand() * n
  const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 18 + rand() * 20)
  g.addColorStop(0, 'rgba(90, 60, 30, 0.35)')
  g.addColorStop(1, 'rgba(90, 60, 30, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(sx, sy, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = `rgba(${30 + rand() * 40},${30 + rand() * 30},${40 + rand() * 30},${0.45 + rand() * 0.35})`
  ctx.lineWidth = 1.2 + rand() * 1.4
  ctx.lineCap = 'round'
  for (let row = 0; row < 7; row += 1) {
    const y = 10 + row * (n / 8) + rand() * 4
    ctx.beginPath()
    ctx.moveTo(8 + rand() * 10, y)
    let x = 12
    while (x < n - 10) {
      x += 6 + rand() * 14
      ctx.lineTo(x, y + (rand() - 0.5) * 5)
    }
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(20, 16, 12, 0.25)'
  ctx.fillRect(0, n - 4, n, 4)
}

function paintLitterReceipt(ctx, n, seed) {
  const rand = mulberry32(seed)
  ctx.fillStyle = '#cfc6a8'
  ctx.fillRect(0, 0, n, n)
  ctx.fillStyle = 'rgba(40, 36, 28, 0.55)'
  for (let i = 0; i < 12; i += 1) {
    const y = 6 + i * (n / 13)
    const w = n * (0.35 + rand() * 0.5)
    ctx.fillRect(4, y, w, 1 + (i % 3 === 0 ? 1.5 : 0))
  }
  ctx.fillStyle = 'rgba(60, 50, 30, 0.2)'
  ctx.fillRect(0, 0, n, 3)
  ctx.fillRect(0, n - 3, n, 3)
}

function paintLitterBag(ctx, n, seed) {
  const rand = mulberry32(seed)
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const x = i % n
    const y = (i / n) | 0
    const wrinkle = Math.sin(x * 0.35) * 18 + Math.sin(y * 0.5 + seed) * 14
    const v = Math.max(90, Math.min(200, 150 + wrinkle + ((i * 13) % 17)))
    data[j] = v
    data[j + 1] = v - 2
    data[j + 2] = v - 8
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = 'rgba(160, 20, 30, 0.7)'
  ctx.fillRect(n * 0.28, n * 0.38, n * 0.44, n * 0.16)
}

function makeLitterMap(paint, seed) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  paint(canvas.getContext('2d'), 64, seed)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  tex.needsUpdate = true
  return tex
}

/** Discarded MetroCard resting in the litter (also the wind-intro landing spot). */
const TRASH_CARD = {
  pos: [-1.15, 0.018, -6.85],
  rot: [-Math.PI / 2 + 0.1, 0.15, 0.85],
  size: [0.28, 0.175],
}

/**
 * Intro: one continuous MetroCard flight onto the trash (no wait→fly snap).
 * Card outruns the camera so it stays in frame; intro ends only after both settle.
 * Flutter is cheap trig only (phone-safe), not a physics sim.
 */
function WindCard({ ready, onCameraHome, reducedMotion, driveCamera = true }) {
  const group = useRef()
  const { camera } = useThree()
  const texture = useLoader(THREE.TextureLoader, '/metrocard.png')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4

  const state = useRef({
    life: 0, // continuous clock — never resets (keeps flutter phase continuous)
    age: 0, // flight progress clock — only advances once ready
    camHome: false,
    cardLanded: false,
    finished: false,
  })

  const FLY_SCALE = 3.6
  const LAND_SCALE = 1
  /** Card flies faster than the camera pull so it stays in POV */
  const CAM_DUR = 3.35
  const CARD_DUR = 2.45

  // Near-vertical “swipe in air” pose at the open, then settles flat on litter
  const START_ROT = useMemo(() => new THREE.Euler(-0.55, 0.18, 0.12), [])

  const START = useMemo(() => new THREE.Vector3(0.15, 2.15, 1.35), [])
  const LAND = useMemo(() => new THREE.Vector3(...TRASH_CARD.pos), [])
  const LAND_ROT = useMemo(() => new THREE.Euler(...TRASH_CARD.rot), [])
  const CAM_START = useMemo(() => ({
    pos: new THREE.Vector3(0.2, 1.95, 3.6),
    look: new THREE.Vector3(0.15, 1.85, 1.0),
    fov: 42,
  }), [])
  const CAM_KIOSK = useMemo(() => {
    const shot = resolvePov('kiosk')
    return {
      pos: new THREE.Vector3(...shot.position),
      look: new THREE.Vector3(...shot.lookAt),
      fov: shot.fov,
    }
  }, [])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(), [])

  const finishIntro = (s) => {
    if (s.finished || !s.camHome || !s.cardLanded) return
    s.finished = true
    onCameraHome?.()
  }

  useLayoutEffect(() => {
    if (!driveCamera) return
    state.current = {
      life: 0,
      age: 0,
      camHome: false,
      cardLanded: false,
      finished: false,
    }
    camera.position.copy(CAM_START.pos)
    camera.fov = CAM_START.fov
    camera.lookAt(CAM_START.look)
    camera.updateProjectionMatrix()
  }, [camera, CAM_START, driveCamera])

  useFrame((_, dt) => {
    if (!group.current) return
    const d = Math.min(dt, 0.05)
    const s = state.current
    const g = group.current
    const easeOut = (t) => 1 - (1 - t) ** 3
    const easeIn = (t) => t * t
    const smooth = (t) => t * t * (3 - 2 * t)

    const setCam = (pos, look, fov) => {
      if (!driveCamera) return
      camera.position.copy(pos)
      camera.lookAt(look)
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    if (reducedMotion) {
      if (!ready || s.finished) {
        if (!s.cardLanded) {
          g.position.copy(LAND)
          g.rotation.copy(LAND_ROT)
          g.scale.setScalar(LAND_SCALE)
          s.cardLanded = true
        }
        return
      }
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
      setCam(CAM_KIOSK.pos, CAM_KIOSK.look, CAM_KIOSK.fov)
      s.camHome = true
      s.cardLanded = true
      finishIntro(s)
      return
    }

    // One clock for flutter phase; keep advancing until BOTH card + camera have settled
    // (stopping age when the card landed left the camera short of home → intro never finished)
    s.life += d
    if (ready && !s.finished) s.age += d

    const u = Math.min(1, s.age / CARD_DUR)
    // Brief close-up, then a quicker dive so the card stays ahead of the camera
    const e = u < 0.28
      ? easeOut(u / 0.28) * 0.28
      : 0.28 + easeIn((u - 0.28) / 0.72) * 0.72
    const wind = (1 - e) ** 1.15
    const t = s.life

    // Falling-paper path: arc + side-to-side / up-down flutter that dies out near the floor
    const lift = Math.sin(Math.min(e, 0.9) * Math.PI) * 0.95 * (1 - Math.max(0, (e - 0.7) / 0.3) ** 2)
    tmpPos.lerpVectors(START, LAND, e)
    tmpPos.y += lift * (1 - e * 0.4)
    tmpPos.x += (Math.sin(t * 2.15) * 0.48 + Math.sin(t * 4.6) * 0.14) * wind
    tmpPos.y += Math.sin(t * 3.05) * 0.16 * wind
    tmpPos.z += (Math.cos(t * 1.75) * 0.32 + Math.sin(t * 3.8) * 0.1) * wind
    g.position.copy(tmpPos)

    // Keep a vertical swipe bias early; wobble all axes like a sheet in air; settle flat late
    tmpEuler.set(
      THREE.MathUtils.lerp(START_ROT.x, LAND_ROT.x, e)
        + Math.sin(t * 2.9) * wind * 0.85
        + Math.sin(t * 5.4) * wind * 0.22,
      THREE.MathUtils.lerp(START_ROT.y, LAND_ROT.y, e)
        + Math.sin(t * 1.55) * wind * 0.7
        + Math.cos(t * 3.2) * wind * 0.35,
      THREE.MathUtils.lerp(START_ROT.z, LAND_ROT.z, e)
        + Math.cos(t * 2.4) * wind * 1.05
        + Math.sin(t * 4.8) * wind * 0.28,
    )
    if (u > 0.62) {
      const k = smooth((u - 0.62) / 0.38)
      tmpEuler.x = THREE.MathUtils.lerp(tmpEuler.x, LAND_ROT.x, k)
      tmpEuler.y = THREE.MathUtils.lerp(tmpEuler.y, LAND_ROT.y, k)
      tmpEuler.z = THREE.MathUtils.lerp(tmpEuler.z, LAND_ROT.z, k)
    }
    g.rotation.copy(tmpEuler)
    g.scale.setScalar(THREE.MathUtils.lerp(FLY_SCALE, LAND_SCALE, e))

    if (u >= 1 && !s.cardLanded) {
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
      s.cardLanded = true
      finishIntro(s)
    } else if (s.cardLanded) {
      // Stay planted — don't keep rewriting pose after land
      g.position.copy(LAND)
      g.rotation.copy(LAND_ROT)
      g.scale.setScalar(LAND_SCALE)
    }

    // Camera: slower pull so the faster card stays in frame
    if (driveCamera && !s.camHome) {
      if (!ready) {
        tmpLook.copy(g.position)
        setCam(CAM_START.pos, tmpLook, CAM_START.fov)
        return
      }
      const cu = Math.min(1, s.age / CAM_DUR)
      const ce = smooth(cu)
      camera.position.lerpVectors(CAM_START.pos, CAM_KIOSK.pos, ce)
      tmpLook.lerpVectors(CAM_START.look, CAM_KIOSK.look, ce)
      // Track the card longer so it doesn't slip out of POV mid-flight
      if (cu < 0.55) {
        tmpLook.lerp(g.position, (1 - cu / 0.55) * 0.65)
      }
      camera.lookAt(tmpLook)
      camera.fov = THREE.MathUtils.lerp(CAM_START.fov, CAM_KIOSK.fov, ce)
      camera.updateProjectionMatrix()
      if (cu >= 1) {
        setCam(CAM_KIOSK.pos, CAM_KIOSK.look, CAM_KIOSK.fov)
        s.camHome = true
        finishIntro(s)
      }
    }
  })

  return (
    <group ref={group} position={START.toArray()} scale={FLY_SCALE} rotation={START_ROT.toArray()}>
      <mesh>
        <planeGeometry args={TRASH_CARD.size} />
        {/* Opaque like FloorTrash — transparent + floor coplanar was eating the card on land */}
        <meshStandardMaterial
          map={texture}
          roughness={0.45}
          metalness={0.06}
          side={THREE.DoubleSide}
          emissive="#2a2418"
          emissiveIntensity={0.4}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[0, 0, -0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={TRASH_CARD.size} />
        <meshStandardMaterial color="#c49a28" roughness={0.65} metalness={0.12} />
      </mesh>
    </group>
  )
}

function FloorTrash({ showMetroCard = true }) {
  const metroTex = useLoader(THREE.TextureLoader, '/metrocard.png')
  metroTex.colorSpace = THREE.SRGBColorSpace

  const atlas = useMemo(() => {
    const notes = [0, 1, 2, 3].map((i) => makeLitterMap(paintLitterNote, 900 + i * 17))
    const receipts = [0, 1].map((i) => makeLitterMap(paintLitterReceipt, 500 + i * 23))
    const bag = makeLitterMap(paintLitterBag, 777)
    return { notes, receipts, bag }
  }, [])

  useLayoutEffect(() => () => {
    atlas.notes.forEach((t) => t.dispose())
    atlas.receipts.forEach((t) => t.dispose())
    atlas.bag.dispose()
  }, [atlas])

  const bits = useMemo(() => {
    const rand = mulberry32(4804)
    const items = []
    const scatter = (n, kind) => {
      for (let i = 0; i < n; i += 1) {
        items.push({
          kind,
          x: -1.55 + rand() * 2.35,
          z: -7.6 + rand() * 3.4,
          rot: rand() * Math.PI * 2,
          tilt: (rand() - 0.5) * 0.22,
          crumple: (rand() - 0.5) * 0.45,
          sx: 0.07 + rand() * 0.12,
          sz: 0.06 + rand() * 0.1,
          variant: (rand() * 4) | 0,
          y: kind === 'bag' ? 0.028 + rand() * 0.02 : 0.008 + rand() * 0.006,
        })
      }
    }
    scatter(9, 'paper')
    scatter(5, 'receipt')
    scatter(4, 'green')
    scatter(3, 'photo')
    scatter(3, 'bag')
    scatter(1, 'mask')
    scatter(2, 'pink')
    return items
  }, [])

  return (
    <group>
      {showMetroCard ? (
        <>
          <mesh
            position={TRASH_CARD.pos}
            rotation={TRASH_CARD.rot}
            castShadow={false}
          >
            <planeGeometry args={TRASH_CARD.size} />
            <meshStandardMaterial
              map={metroTex}
              roughness={0.88}
              metalness={0.04}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh
            position={[TRASH_CARD.pos[0], TRASH_CARD.pos[1] - 0.003, TRASH_CARD.pos[2]]}
            rotation={TRASH_CARD.rot}
            castShadow={false}
          >
            <planeGeometry args={TRASH_CARD.size} />
            <meshStandardMaterial color="#c49a28" roughness={0.7} metalness={0.1} side={THREE.BackSide} />
          </mesh>
        </>
      ) : null}
      {bits.map((b, i) => {
        if (b.kind === 'bag') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[0.55 + b.tilt, b.rot, 0.4 + b.crumple]}
              scale={[b.sx * 4.5, 0.7, b.sz * 4.2]}
              castShadow={false}
            >
              <sphereGeometry args={[0.08, 6, 5]} />
              <meshStandardMaterial
                map={atlas.bag}
                color="#c8c4bc"
                roughness={0.98}
                metalness={0}
              />
            </mesh>
          )
        }
        if (b.kind === 'mask') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[-Math.PI / 2 + b.tilt, b.crumple * 0.3, b.rot]}
              castShadow={false}
            >
              <planeGeometry args={[0.18, 0.1]} />
              <meshStandardMaterial color="#b8b4ac" roughness={0.98} metalness={0} side={THREE.DoubleSide} />
            </mesh>
          )
        }
        if (b.kind === 'green') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[-Math.PI / 2 + b.tilt, b.crumple * 0.2, b.rot]}
              castShadow={false}
            >
              <planeGeometry args={[0.065, 0.065]} />
              <meshStandardMaterial color="#6e8810" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
            </mesh>
          )
        }
        if (b.kind === 'pink') {
          return (
            <mesh
              key={i}
              position={[b.x, b.y, b.z]}
              rotation={[0.5, b.rot, 0.35]}
              scale={[1.2, 0.4, 0.9]}
              castShadow={false}
            >
              <sphereGeometry args={[0.07, 6, 5]} />
              <meshStandardMaterial color="#a84868" roughness={0.98} metalness={0} />
            </mesh>
          )
        }

        const map = b.kind === 'receipt'
          ? atlas.receipts[b.variant % atlas.receipts.length]
          : atlas.notes[b.variant % atlas.notes.length]
        const w = b.kind === 'receipt' ? 0.05 : b.kind === 'photo' ? 0.13 : b.sx * 1.55
        const d = b.kind === 'receipt' ? 0.15 : b.kind === 'photo' ? 0.1 : b.sz * 1.7
        return (
          <mesh
            key={i}
            position={[b.x, b.y, b.z]}
            rotation={[-Math.PI / 2 + b.tilt, b.crumple * 0.35, b.rot]}
            castShadow={false}
          >
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial
              map={map}
              color={b.kind === 'photo' ? '#9aa0a6' : '#d2c8b4'}
              roughness={0.96}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      <group position={[-0.35, 0.035, -6.15]} rotation={[0.65, 0.9, 0.35]}>
        <mesh scale={[1.15, 0.42, 0.9]}>
          <sphereGeometry args={[0.11, 7, 5]} />
          <meshStandardMaterial map={atlas.bag} color="#bdbab4" roughness={0.97} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

/** Bottles, cans, junk in the track bed — kept low-poly. */
function TrackTrash() {
  const bits = useMemo(() => {
    const rand = mulberry32(9173)
    const items = []
    // Visible stretch of trench from the kiosk
    for (let i = 0; i < 14; i += 1) {
      const kind = rand() < 0.55 ? 'bottle' : rand() < 0.75 ? 'can' : rand() < 0.9 ? 'bag' : 'paper'
      items.push({
        kind,
        x: TRACK_X0 + 0.35 + rand() * (TRACK_W - 0.7),
        z: -3.2 - rand() * 11.5,
        rotY: rand() * Math.PI * 2,
        rotX: kind === 'bottle' || kind === 'can' ? Math.PI / 2 + (rand() - 0.5) * 0.35 : 0.4 + rand() * 0.5,
        rotZ: (rand() - 0.5) * 0.5,
        color: kind === 'bottle'
          ? (['#2a5a32', '#5a3a1e', '#6a7a82', '#1a4a28'][Math.floor(rand() * 4)])
          : kind === 'can'
            ? (['#b0b4b8', '#c45a28', '#d8d0c0'][Math.floor(rand() * 3)])
            : kind === 'bag'
              ? (['#c8c4bc', '#2a2a2a', '#d4c8a8'][Math.floor(rand() * 3)])
              : '#b8b0a0',
        scale: 0.75 + rand() * 0.45,
      })
    }
    // Extra junk in the kiosk sightline (platform lip, mid-trench)
    for (let i = 0; i < 18; i += 1) {
      const kind = rand() < 0.4 ? 'bottle' : rand() < 0.7 ? 'can' : rand() < 0.88 ? 'bag' : 'paper'
      items.push({
        kind,
        x: TRACK_X0 + 0.12 + rand() * 1.15,
        z: -3.5 - rand() * 4.8,
        rotY: rand() * Math.PI * 2,
        rotX: kind === 'bottle' || kind === 'can' ? Math.PI / 2 + (rand() - 0.5) * 0.4 : 0.35 + rand() * 0.55,
        rotZ: (rand() - 0.5) * 0.55,
        color: kind === 'bottle'
          ? (['#2a5a32', '#5a3a1e', '#6a7a82', '#1a4a28'][Math.floor(rand() * 4)])
          : kind === 'can'
            ? (['#b0b4b8', '#c45a28', '#d8d0c0'][Math.floor(rand() * 3)])
            : kind === 'bag'
              ? (['#c8c4bc', '#2a2a2a', '#d4c8a8'][Math.floor(rand() * 3)])
              : '#b8b0a0',
        scale: 0.85 + rand() * 0.5,
      })
    }
    // A few upright bottles against the platform wall of the trench
    for (let i = 0; i < 4; i += 1) {
      items.push({
        kind: 'bottle',
        x: TRACK_X0 + 0.18 + rand() * 0.25,
        z: -4.5 - rand() * 8,
        rotY: rand() * Math.PI * 2,
        rotX: (rand() - 0.5) * 0.15,
        rotZ: (rand() - 0.5) * 0.12,
        color: ['#2a5a32', '#5a3a1e', '#8a9aa0'][Math.floor(rand() * 3)],
        scale: 0.9 + rand() * 0.25,
        upright: true,
      })
    }
    return items
  }, [])

  return (
    <group>
      {bits.map((b, i) => {
        const y = TRACK_Y + (b.upright ? 0.12 : 0.05)
        if (b.kind === 'bottle') {
          return (
            <group
              key={i}
              position={[b.x, y, b.z]}
              rotation={[b.rotX, b.rotY, b.rotZ]}
              scale={b.scale}
            >
              <mesh castShadow={false}>
                <cylinderGeometry args={[0.035, 0.04, 0.22, 8]} />
                <meshStandardMaterial
                  color={b.color}
                  roughness={0.35}
                  metalness={0.15}
                  transparent
                  opacity={0.88}
                />
              </mesh>
              <mesh position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.018, 0.03, 0.06, 6]} />
                <meshStandardMaterial color={b.color} roughness={0.4} metalness={0.1} transparent opacity={0.9} />
              </mesh>
              <mesh position={[0, 0.13, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.02, 6]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.05} />
              </mesh>
            </group>
          )
        }
        if (b.kind === 'can') {
          return (
            <mesh
              key={i}
              position={[b.x, y, b.z]}
              rotation={[b.rotX, b.rotY, b.rotZ]}
              scale={b.scale}
              castShadow={false}
            >
              <cylinderGeometry args={[0.038, 0.038, 0.12, 8]} />
              <meshStandardMaterial color={b.color} roughness={0.45} metalness={0.55} />
            </mesh>
          )
        }
        if (b.kind === 'bag') {
          return (
            <mesh
              key={i}
              position={[b.x, TRACK_Y + 0.04, b.z]}
              rotation={[0.5, b.rotY, 0.35]}
              scale={[b.scale * 1.4, b.scale * 0.45, b.scale]}
              castShadow={false}
            >
              <sphereGeometry args={[0.09, 6, 5]} />
              <meshStandardMaterial color={b.color} roughness={0.95} metalness={0} />
            </mesh>
          )
        }
        return (
          <mesh
            key={i}
            position={[b.x, TRACK_Y + 0.02, b.z]}
            rotation={[-Math.PI / 2 + 0.1, 0, b.rotY]}
            castShadow={false}
          >
            <planeGeometry args={[0.1 * b.scale, 0.08 * b.scale]} />
            <meshStandardMaterial color={b.color} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}

function StationWorld({
  pov,
  kioskZoom = 'close',
  hud,
  wallHud,
  wall,
  onReady,
  onBoardSelect,
  dimmed,
  onArrive,
  introReady,
  onIntroDone,
  showBoot = true,
  immersed = false,
  immersedId = null,
  kioskPickable = false,
  onKioskPick,
  onLookAside,
}) {
  const landscapeInvite = isLandscapeZoom(kioskZoom) && !dimmed
  const { settings } = useGfx()
  const maps = useStationMaps()
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  // Keep the same WindCard mesh after handoff so the floor card never "pops" in
  const [windMounted, setWindMounted] = useState(() => dimmed)
  useEffect(() => {
    if (dimmed) setWindMounted(true)
  }, [dimmed])

  return (
    <>
      <CameraRig pov={pov} kioskZoom={kioskZoom} onArrive={onArrive} locked={dimmed} />
      <Atmosphere />
      <group
        onClick={(e) => {
          e.stopPropagation()
          onLookAside?.(e)
        }}
      >
        <Shell maps={maps} />
        <CeilingBeams maps={maps} />
        <Stairwell maps={maps} />
        <Benches />
        <YellowStrip maps={maps} />
        <FloorTrash showMetroCard={!windMounted} />
        <Tracks maps={maps} />
        <TrackTrash />
        <group name="pillar-occlude">
          <Pillars />
        </group>
      </group>
      <Signage locked={dimmed} />
      <WallBoards
        wall={wall}
        wallHuds={wallHud}
        immersed={immersed}
        immersedId={immersedId}
        onSelect={onBoardSelect}
        invite={landscapeInvite}
        projectHtml={!dimmed}
      />
      <Train invite={landscapeInvite} />
      {settings.extras ? <TrainSteam /> : null}
      {settings.extras ? <VibeRat /> : null}
      <group name="kiosk-occlude">
        <InfoKiosk hud={hud} showBoot={showBoot} pickable={kioskPickable} onPick={onKioskPick} />
      </group>
      {windMounted ? (
        <WindCard
          ready={introReady}
          driveCamera={dimmed}
          onCameraHome={onIntroDone}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <ReadyPing onReady={onReady} />
      <GfxWatch />
      <ToneMap />
    </>
  )
}

export default function StationScene({
  shot = 'kiosk',
  kioskLive = true,
  dimmed = false,
  introReady = false,
  onIntroComplete,
  onReady,
  onArrive,
  leaveRef,
  wallPages = null,
  wallInteractive = false,
  headerH = 64,
}) {
  const { settings } = useGfx()
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  )
  const [wall, setWall] = useState(() => {
    if (typeof window === 'undefined') return setWallFace(layoutWallFace(1100, 700))
    return setWallFace(layoutWallFace(window.innerWidth, Math.max(1, window.innerHeight - headerH)))
  })
  const hud = useRef({ root: null, cam: null, obj: null })
  const wallHud = useRef({
    root: null,
    cam: null,
    obj: { photo: null, video: null, about: null },
  })
  const navigate = useNavigate()
  const pov = isWallPov(shot) || shot === 'kiosk' ? shot : (POVS[shot] ? shot : 'kiosk')
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [zap, setZap] = useState('closed')
  const [kioskArrived, setKioskArrived] = useState(false)
  const [immersed, setImmersed] = useState(false)
  const [kioskZoom, setKioskZoom] = useState('close')
  const [camSettled, setCamSettled] = useState(true)
  const pendingNav = useRef(null)
  const immerseTimer = useRef(null)
  const landscape = pov === 'kiosk' && isLandscapeZoom(kioskZoom)
  const screenLive = kioskLive && zap === 'open' && kioskZoom === 'close'
  // Keep the real kiosk HTML projected on left/right (clicks off until close)
  const overlayOn = zap !== 'closed'
  const pageView = immersed && isWallPov(pov)

  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const apply = () => {
      const next = layoutWallFace(
        window.innerWidth,
        Math.max(1, window.innerHeight - headerH),
      )
      setWallFace(next)
      setWall(next)
    }
    apply()
    const vv = window.visualViewport
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
    }
  }, [headerH])

  const goBoard = useCallback((id) => {
    const to = `/${id}`
    if (pov === id) return
    if (leaveRef?.current?.tryLeave?.(to)) return
    navigate(to)
  }, [navigate, leaveRef, pov])

  const lookAside = useCallback((e) => {
    if (dimmed || pov !== 'kiosk' || kioskZoom !== 'close' || zap !== 'open') return
    const x = ndcXFromEvent(e)
    if (x == null) return
    if (x < -0.28) {
      setCamSettled(false)
      setKioskZoom('left')
      return
    }
    if (x > 0.28) {
      setCamSettled(false)
      setKioskZoom('right')
    }
  }, [dimmed, pov, kioskZoom, zap])

  const handleArrive = useCallback((next) => {
    onArrive?.(next)
    setCamSettled(true)
    setKioskArrived(next === 'kiosk')
    if (immerseTimer.current) {
      window.clearTimeout(immerseTimer.current)
      immerseTimer.current = null
    }
    if (isWallPov(next)) {
      immerseTimer.current = window.setTimeout(() => {
        setImmersed(true)
        immerseTimer.current = null
      }, reducedMotion ? 0 : 40)
      return
    }
    setImmersed(false)
  }, [onArrive, reducedMotion])

  const handleIntroDone = useCallback(() => {
    // WindCard already parked the camera at kiosk — don't wait on CameraRig arrive
    setKioskArrived(true)
    onIntroComplete?.()
  }, [onIntroComplete])

  useEffect(() => {
    if (pov !== 'kiosk') {
      setKioskArrived(false)
      setZap('closed')
      pendingNav.current = null
      setKioskZoom('close')
      setCamSettled(true)
    }
    setImmersed(false)
    if (immerseTimer.current) {
      window.clearTimeout(immerseTimer.current)
      immerseTimer.current = null
    }
  }, [pov])

  // Arrive at kiosk + interactive → zap open (black MTA until then)
  useEffect(() => {
    if (pov !== 'kiosk' || !kioskLive || !kioskArrived) return
    if (kioskZoom !== 'close') return
    if (zap !== 'closed') return
    setZap(reducedMotion ? 'open' : 'opening')
  }, [pov, kioskLive, kioskArrived, zap, reducedMotion, kioskZoom])

  const onZapPhaseEnd = useCallback((phase) => {
    if (phase === 'opening') {
      setZap('open')
      return
    }
    if (phase === 'closing') {
      setZap('closed')
      const to = pendingNav.current
      pendingNav.current = null
      if (to) navigate(to)
    }
  }, [navigate])

  // prefers-reduced-motion: no animationend — snap phases
  useEffect(() => {
    if (!reducedMotion) return
    if (zap === 'opening') onZapPhaseEnd('opening')
    if (zap === 'closing') onZapPhaseEnd('closing')
  }, [zap, reducedMotion, onZapPhaseEnd])

  useEffect(() => {
    if (!leaveRef) return undefined
    leaveRef.current.tryLeave = (to) => {
      if (pov !== 'kiosk' || zap !== 'open' || kioskZoom !== 'close') return false
      pendingNav.current = to
      setZap('closing')
      return true
    }
    return () => {
      leaveRef.current.tryLeave = () => false
    }
  }, [leaveRef, pov, zap, kioskZoom])

  const loop = tabHidden || pageView ? 'never' : 'always'

  if (!use3d) {
    return (
      <Layer $hit={false} $page={false}>
        <NoWebGL>This station needs WebGL.</NoWebGL>
      </Layer>
    )
  }

  return (
    <Layer $hit={!dimmed} $page={pageView}>
      <SceneWrap $dim={dimmed}>
      <Suspense fallback={null}>
        <Canvas
          frameloop={loop}
            dpr={settings.dpr}
            gl={{
              alpha: false,
              antialias: settings.antialias,
              powerPreference: settings.powerPreference,
            }}
            camera={{
              position: dimmed ? [0.2, 1.95, 3.6] : resolvePov(pov, undefined, kioskZoom).position,
              fov: dimmed ? 42 : resolvePov(pov, undefined, kioskZoom).fov,
              near: 0.1,
              far: 90,
            }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor(COL.clear, 1)
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = settings.exposure
              if (dimmed) camera.lookAt(0.15, 1.85, 1.0)
              else camera.lookAt(...resolvePov(pov, undefined, kioskZoom).lookAt)
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault()
              setUse3d(false)
            })
          }}
          onPointerMissed={lookAside}
        >
            <StationWorld
              pov={pov}
              kioskZoom={kioskZoom}
              hud={hud}
              wallHud={wallHud}
              wall={wall}
              onReady={onReady}
              onBoardSelect={goBoard}
              dimmed={dimmed}
              onArrive={handleArrive}
              introReady={introReady}
              onIntroDone={handleIntroDone}
              showBoot={!overlayOn}
              immersed={pageView}
              immersedId={pov}
              kioskPickable={landscape && !dimmed}
              onKioskPick={() => {
                setCamSettled(false)
                setKioskZoom('close')
              }}
              onLookAside={lookAside}
            />
            {settings.bloom ? <StationBloom /> : null}
        </Canvas>
      </Suspense>
        {overlayOn ? (
          <Overlay ref={(n) => { hud.current.root = n }} $clip>
            <OverlayCam ref={(n) => { hud.current.cam = n }}>
              <OverlayObj ref={(n) => { hud.current.obj = n }} $live={screenLive}>
                <KioskFrame>
                  <KioskZapScreen
                    phase={zap}
                    live={screenLive}
                    reducedMotion={reducedMotion}
                    onPhaseEnd={onZapPhaseEnd}
                  />
                  <KioskGlass aria-hidden />
                  <KioskGlassDirt aria-hidden />
                </KioskFrame>
              </OverlayObj>
            </OverlayCam>
          </Overlay>
        ) : null}
        {wallPages ? (
          <Overlay data-wall-hud="root" ref={(n) => { wallHud.current.root = n }} $page={pageView} $clip>
            <OverlayCam data-wall-hud="cam" ref={(n) => { wallHud.current.cam = n }} $page={pageView}>
              {wallBoardList().map((b) => (
                <OverlayObj
                  key={b.id}
                  data-wall-hud={`obj-${b.id}`}
                  ref={(n) => { wallHud.current.obj[b.id] = n }}
                  $live={wallInteractive && pov === b.id}
                  $catch={!landscape && !pageView && !(wallInteractive && pov === b.id)}
                  $fill={pageView && pov === b.id}
                  $off={pageView && pov !== b.id}
                  onClick={(e) => {
                    if (pageView || (wallInteractive && pov === b.id)) return
                    e.stopPropagation()
                    goBoard(b.id)
                  }}
                >
                  <WallFrame $fill={pageView && pov === b.id} $w={wall.panelW} $h={wall.panelH}>
                    {wallPages[b.id]}
                    {pageView && pov === b.id ? null : (
                      <>
                        <KioskGlass aria-hidden />
                        <KioskGlassDirt aria-hidden />
                      </>
                    )}
                  </WallFrame>
                </OverlayObj>
              ))}
            </OverlayCam>
          </Overlay>
        ) : null}
      </SceneWrap>
      {pageView || !settings.grain ? null : <Grain />}
      {!dimmed && (isWallPov(pov) || (kioskLive && pov === 'kiosk' && (landscape || (kioskZoom === 'close' && kioskArrived && zap === 'open')))) ? (
        <ChromeBar>
          {landscape ? (
            <ChromeBtn
              type="button"
              aria-label="Home"
              onClick={() => {
                setCamSettled(false)
                setKioskZoom('close')
                if (pov !== 'kiosk') navigate('/')
              }}
            >
              <HomeIcon />
            </ChromeBtn>
          ) : null}
          <ChromeBtn
            type="button"
            aria-label={isWallPov(pov) || kioskZoom === 'close' ? 'Zoom out' : (kioskZoom === 'right' ? 'Look left' : 'Look right')}
            onClick={() => {
              if (isWallPov(pov)) {
                setCamSettled(false)
                setKioskZoom('left')
                navigate('/')
                return
              }
              if (kioskZoom === 'close') {
                setCamSettled(false)
                setKioskZoom('right')
                return
              }
              setCamSettled(false)
              setKioskZoom((z) => (z === 'right' ? 'left' : 'right'))
            }}
          >
            {isWallPov(pov) || kioskZoom === 'close' ? (
              <LivePhotoIcon />
            ) : (
              <PanArrow dir={kioskZoom === 'right' ? 'left' : 'right'} />
            )}
          </ChromeBtn>
        </ChromeBar>
      ) : null}
    </Layer>
  )
}
