/* eslint-disable react/no-unknown-property */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass } from 'postprocessing'
import styled from 'styled-components'
import KioskZapScreen from './KioskZapScreen'
import { KIOSK_CAB_H, KIOSK_CAB_W, KIOSK_POST_H, KIOSK_BEZEL, KIOSK_PANEL_W, KIOSK_PANEL_H, KIOSK_SCREEN_W, KIOSK_SCREEN_H } from '../lib/kioskSize'
import { client, urlFor } from '../lib/sanity'
import { openCabinPhoto } from '../lib/cabinGallery'

RectAreaLightUniformsLib.init()

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
const TRAIN_REV = 22
const TRAIN_Y = TRACK_Y + 0.14
/** Standing in the aisle looking toward the rear of the car. */
const CABIN = {
  position: [TRACK_CX, TRAIN_Y + 1.58, TRAIN_Z - 2.15],
  lookAt: [TRACK_CX, TRAIN_Y + 1.38, TRAIN_Z - 11.2],
  fov: 58,
  ease: 0.62,
}

/** Seated on the left bank, looking across at the photo bulletin on the right wall. */
const PHOTO_SEAT = {
  position: [TRACK_CX - 0.58, TRAIN_Y + 1.28, TRAIN_Z - 5.05],
  lookAt: [TRACK_CX + 1.22, TRAIN_Y + 1.42, TRAIN_Z - 5.55],
  fov: 46,
  ease: 0.72,
}

const POVS = {
  approach: {
    position: [-1.35, 1.68, 5.8],
    lookAt: [0.45, 1.12, -8],
    fov: 52,
    ease: 0.82,
  },
  kiosk: {
    // Readable screen, still some platform breathing room
    position: [0.38, 1.38, -2.11],
    lookAt: [0.38, 1.18, -4.25],
    fov: 42,
    ease: 1.35,
  },
  /** Phone: pull back so the cabinet isn’t a full-bleed white slab */
  kioskMobile: {
    position: [0.38, 1.42, -0.72],
    lookAt: [0.38, 1.12, -4.25],
    fov: 50,
    ease: 1.35,
  },
  cabin: { ...CABIN },
  photo: { ...PHOTO_SEAT },
  video: {
    ...CABIN,
    lookAt: [TRACK_CX, TRAIN_Y + 1.35, TRAIN_Z - 11.6],
  },
  about: {
    ...CABIN,
    lookAt: [TRACK_CX + 0.35, TRAIN_Y + 1.4, TRAIN_Z - 10.1],
  },
}

const CAM = POVS.kiosk

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

/** Active camera shot — phones use a pulled-back kiosk framing. */
function resolvePov(key) {
  if (key === 'kiosk' && isMobileViewport()) return POVS.kioskMobile
  return POVS[key] ?? CAM
}

/** Page POVs that live inside the lead car. */
const CABIN_SHOTS = new Set(['cabin', 'photo', 'video', 'about'])
const isCabinShot = (p) => CABIN_SHOTS.has(p)

/**
 * Doorway path into / out of the lead car.
 * Entering: platform → door → aisle beat (see the car) → settle into dest seat/look.
 */
const TRAIN_CAR_W = 2.9
const DOOR_LOCAL_Z = -3.15
function doorwayWaypoints(entering) {
  const doorZ = TRAIN_Z + DOOR_LOCAL_Z
  const standY = TRAIN_Y + 1.55
  const sitY = PHOTO_SEAT.position[1]
  const outerX = TRACK_CX - TRAIN_CAR_W * 0.5 - 0.42
  const threshX = TRACK_CX - TRAIN_CAR_W * 0.5 + 0.2
  // Past kiosk → door → pause down the aisle → peel toward seat
  const pos = [
    new THREE.Vector3(0.55, 1.48, -4.6),
    new THREE.Vector3(1.05, 1.5, -7.8),
    new THREE.Vector3(outerX, standY, doorZ + 0.15),
    new THREE.Vector3(threshX, standY, doorZ),
    new THREE.Vector3(TRACK_CX, standY, doorZ + 0.2),
    new THREE.Vector3(TRACK_CX, standY - 0.02, TRAIN_Z - 5.8),
    new THREE.Vector3(TRACK_CX - 0.15, sitY + 0.12, TRAIN_Z - 4.4),
  ]
  const look = [
    new THREE.Vector3(1.2, 1.25, -9.5),
    new THREE.Vector3(outerX + 0.4, 1.2, doorZ),
    new THREE.Vector3(TRACK_CX, 1.3, doorZ - 1.2),
    new THREE.Vector3(TRACK_CX, 1.35, TRAIN_Z - 10),
    new THREE.Vector3(TRACK_CX, 1.4, TRAIN_Z - 14),
    new THREE.Vector3(TRACK_CX + 0.35, 1.38, TRAIN_Z - 11),
    new THREE.Vector3(TRACK_CX, 1.35, TRAIN_Z - 8),
  ]
  if (!entering) {
    pos.reverse()
    look.reverse()
  }
  return { pos, look }
}

const COL = {
  ceiling: '#121416',
  end: '#0e1012',
  steel: '#2a2e32',
  wood: '#6b4a2c',
  woodDark: '#4a301c',
  clear: '#101214',
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
const FONT = 'Helvetica, "Helvetica Neue", Arial, sans-serif'
const EXIT_RED = '#C60C30'
const SIGN_REV = 13

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
const TRAIN_COUPLE = 0.42
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

    return {
      wallMap,
      wallBump,
      wallRough,
      floorMap,
      dispose() {
        wallMap.dispose()
        wallBump.dispose()
        wallRough.dispose()
        floorMap.dispose()
      },
    }
  }, [])

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
  }
`

const SceneWrap = styled.div`
  position: absolute;
  inset: 0;
`

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
  transform-style: preserve-3d;
  /* Hidden until InfoKiosk writes CSS-3D transforms (remount after cabin) */
  visibility: hidden;
`

const OverlayCam = styled.div`
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform-origin: 0 0;
  pointer-events: none;
`

const OverlayObj = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  /* Solid hit shield over the projected screen so the canvas can't steal clicks */
  pointer-events: ${(p) => (p.$live ? 'auto' : 'none')};
  transform-style: preserve-3d;
  transform-origin: 0 0;
`

const KioskFrame = styled.div`
  position: relative;
  width: ${KIOSK_PANEL_W}px;
  height: ${KIOSK_PANEL_H}px;
  overflow: hidden;
  border-radius: 22px;
  /* Inherit from OverlayObj — don't re-enable hits while intro has live=false */
  pointer-events: inherit;
`

const Grain = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  opacity: 0.1;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,${GRAIN_SVG}");
  background-size: 128px 128px;
`

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function CameraRig({ pov, onArrive, locked = false }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(...CAM.lookAt))
  const goalPos = useMemo(() => new THREE.Vector3(), [])
  const goalLook = useMemo(() => new THREE.Vector3(), [])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])
  const arrivedFor = useRef(null)
  const wasLocked = useRef(locked)
  const prevPov = useRef(pov)
  const path = useRef(null) // { posCurve, lookCurve, age, dur, dest, fov0, fov1 }
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useLayoutEffect(() => {
    if (locked) return
    const shot = resolvePov(pov)
    // Fresh canvas mount only — don't snap over an in-flight doorway path
    if (path.current) return
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
      path.current = null
      prevPov.current = pov
      return
    }

    const from = prevPov.current
    const to = pov
    prevPov.current = to
    arrivedFor.current = null

    const entering = !isCabinShot(from) && isCabinShot(to)
    const leaving = isCabinShot(from) && !isCabinShot(to)
    const dest = resolvePov(to)

    if ((entering || leaving) && !reducedMotion) {
      const mid = doorwayWaypoints(entering)
      const posPts = [
        camera.position.clone(),
        ...mid.pos,
        new THREE.Vector3(...dest.position),
      ]
      const lookPts = [
        look.current.clone(),
        ...mid.look,
        new THREE.Vector3(...dest.lookAt),
      ]
      path.current = {
        posCurve: new THREE.CatmullRomCurve3(posPts, false, 'catmullrom', 0.28),
        lookCurve: new THREE.CatmullRomCurve3(lookPts, false, 'catmullrom', 0.28),
        age: 0,
        dur: entering ? (to === 'photo' ? 5.4 : 4.4) : 2.9,
        dest: to,
        fov0: camera.fov,
        fov1: dest.fov,
      }
      return
    }

    path.current = null
  }, [pov, locked, reducedMotion, camera, look])

  useFrame((_, dt) => {
    if (locked) {
      wasLocked.current = true
      return
    }

    const shot = resolvePov(pov)
    const d = Math.min(dt, 0.05)
    const smooth = (t) => t * t * (3 - 2 * t)

    // Doorway ride: one curve into / out of the car
    const ride = path.current
    if (ride) {
      wasLocked.current = false
      ride.age += d
      const u = Math.min(1, ride.age / ride.dur)
      // Ease in-out so the “sit down” softens at the end
      const e = smooth(u)
      ride.posCurve.getPoint(e, tmpPos)
      ride.lookCurve.getPoint(e, tmpLook)
      camera.position.copy(tmpPos)
      look.current.copy(tmpLook)
      camera.fov = THREE.MathUtils.lerp(ride.fov0, ride.fov1, e)
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      if (u >= 1) {
        const end = resolvePov(ride.dest)
        camera.position.set(...end.position)
        look.current.set(...end.lookAt)
        camera.fov = end.fov
        camera.lookAt(look.current)
        camera.updateProjectionMatrix()
        arrivedFor.current = ride.dest
        path.current = null
        onArrive?.(ride.dest)
      }
      return
    }

    // Already settled on this POV — freeze so the CSS kiosk overlay
    // isn't rewritten every frame (that breaks button hit-testing).
    if (arrivedFor.current === pov) return

    goalPos.set(...shot.position)
    goalLook.set(...shot.lookAt)

    // Intro just handed off — seed look so nothing pops
    if (wasLocked.current) {
      look.current.copy(goalLook)
      wasLocked.current = false
    }

    if (reducedMotion) {
      camera.position.copy(goalPos)
      look.current.copy(goalLook)
      camera.fov = shot.fov
    } else {
      const k = 1 - Math.exp(-(shot.ease ?? 1.25) * d)
      camera.position.lerp(goalPos, k)
      look.current.lerp(goalLook, k)
      camera.fov = THREE.MathUtils.lerp(camera.fov, shot.fov, k)
    }
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()

    const close = camera.position.distanceTo(goalPos) < 0.12
      && look.current.distanceTo(goalLook) < 0.2
    if (close || reducedMotion) {
      camera.position.copy(goalPos)
      look.current.copy(goalLook)
      camera.fov = shot.fov
      camera.lookAt(look.current)
      camera.updateProjectionMatrix()
      arrivedFor.current = pov
      onArrive?.(pov)
    }
  })

  return null
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
        <meshStandardMaterial color={COL.ceiling} roughness={0.96} metalness={0} />
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

function CeilingBeams() {
  const mesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(() => createCeilingBeamGeometry(FLOOR_W + 0.32), [])

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    const x = WALL_X + FLOOR_W / 2 - 0.08
    for (let i = 0; i < CEIL_BEAM_N; i += 1) {
      dummy.position.set(x, HEIGHT, CEIL_BEAM_Z0 - i * CEIL_BEAM_GAP)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  }, [dummy, geometry])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, null, CEIL_BEAM_N]}>
        <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
      </instancedMesh>
      <mesh position={[WALL_X + 0.06, HEIGHT - 0.1, MID_Z]}>
        <boxGeometry args={[0.14, 0.22, LEN]} />
        <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
      </mesh>
      <mesh position={[PILLAR_X, HEIGHT - 0.12, MID_Z]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[LEN, 0.18, 0.22]} />
        <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
      </mesh>
    </group>
  )
}

function Pillars() {
  const mesh = useRef()
  const geometry = useMemo(() => createIBeamGeometry(HEIGHT), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const inst = mesh.current
    if (!inst) return
    for (let i = 0; i < PILLAR_N; i += 1) {
      dummy.position.set(PILLAR_X, HEIGHT / 2, PILLAR_Z0 - i * PILLAR_GAP)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  }, [dummy, geometry, PILLAR_Z0])

  useLayoutEffect(() => () => geometry.dispose(), [geometry])

  return (
    <instancedMesh ref={mesh} args={[geometry, null, PILLAR_N]}>
      <meshStandardMaterial color={COL.steel} roughness={0.42} metalness={0.62} />
    </instancedMesh>
  )
}

function YellowStrip() {
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
        <meshStandardMaterial color="#e2b40f" roughness={0.62} metalness={0.04} />
    </mesh>
      <instancedMesh ref={mesh} args={[dome, null, count]}>
        <meshStandardMaterial color="#d4a50e" roughness={0.5} metalness={0.06} />
      </instancedMesh>
    </group>
  )
}

function paintBallast(ctx, n) {
  const img = ctx.createImageData(n, n)
  const { data } = img
  for (let i = 0; i < n * n; i += 1) {
    const j = i * 4
    const noise = ((i * 16807) >>> 8) % 48
    const grit = ((i * 48271) >>> 11) % 22
    const v = 28 + noise + grit
    data[j] = v + 10
    data[j + 1] = v + 4
    data[j + 2] = v
    data[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  // Oil / wet patches
  for (let k = 0; k < 22; k += 1) {
    const x = (k * 97) % n
    const y = (k * 53) % n
    ctx.fillStyle = `rgba(8,6,4,${0.18 + (k % 5) * 0.06})`
    ctx.beginPath()
    ctx.ellipse(x, y, 8 + (k % 7), 4 + (k % 4), (k % 5) * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  // Light trash flecks
  ctx.fillStyle = 'rgba(210,205,190,0.35)'
  for (let k = 0; k < 40; k += 1) {
    ctx.fillRect((k * 131) % n, (k * 89) % n, 1 + (k % 2), 1)
  }
}

function Tracks() {
  const ballast = useMemo(() => {
    const map = makeCanvasTexture(paintBallast, 256, THREE.SRGBColorSpace)
    map.repeat.set(TRACK_W / 1.4, LEN / 1.4)
    return map
  }, [])
  useLayoutEffect(() => () => ballast.dispose(), [ballast])

  const tieMesh = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tieGap = 0.55
  const tieN = Math.floor(LEN / tieGap)
  const tieGeo = useMemo(() => new THREE.BoxGeometry(2.55, 0.12, 0.22), [])

  useLayoutEffect(() => {
    const inst = tieMesh.current
    if (!inst) return
    const z0 = MID_Z + LEN / 2 - tieGap * 0.5
    for (let i = 0; i < tieN; i += 1) {
      dummy.position.set(TRACK_CX, TRACK_Y + 0.06, z0 - i * tieGap)
      dummy.rotation.y = ((i * 17) % 7 - 3) * 0.008
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
  }, [dummy, tieN])

  useLayoutEffect(() => () => tieGeo.dispose(), [tieGeo])

  const railY = TRACK_Y + 0.16

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[TRACK_X0 + TRACK_W / 2, TRACK_Y, MID_Z]}>
        <planeGeometry args={[TRACK_W, LEN]} />
        <meshStandardMaterial
          map={ballast}
          color="#3a2e24"
          roughness={0.98}
          metalness={0}
        />
      </mesh>
      <mesh position={[TRACK_X0, TRACK_Y / 2, MID_Z]}>
        <boxGeometry args={[0.12, -TRACK_Y, LEN]} />
        <meshStandardMaterial color="#1a1612" roughness={0.95} metalness={0} />
      </mesh>
      <instancedMesh ref={tieMesh} args={[tieGeo, null, tieN]}>
        <meshStandardMaterial color="#2a1c12" roughness={0.92} metalness={0} />
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
      {/* Third rail — dark cover + contact strip toward wall side of tracks */}
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
  ctx.fillStyle = '#5c3c24'
  ctx.fillRect(0, 0, n, n)
  for (let y = 0; y < n; y += 1) {
    const band = Math.sin(y * 0.045) * 10 + Math.sin(y * 0.19) * 5
    const v = 78 + band + ((y * 11) % 7)
    ctx.fillStyle = `rgb(${v + 18},${Math.round(v * 0.62)},${Math.round(v * 0.34)})`
    ctx.fillRect(0, y, n, 1)
  }
  ctx.lineCap = 'round'
  for (let k = 0; k < 22; k += 1) {
    const x = 8 + (k * 41) % (n - 16)
    ctx.strokeStyle = `rgba(38, 20, 10, ${0.14 + (k % 4) * 0.05})`
    ctx.lineWidth = 1.2 + (k % 3)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= n; y += 6) {
      ctx.lineTo(x + Math.sin(y * 0.035 + k * 0.7) * 5.5, y)
    }
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(20, 10, 6, 0.16)'
  for (let i = 0; i < 9; i += 1) {
    ctx.fillRect((i * 53) % n, (i * 29) % n, 18 + (i % 4) * 10, 2)
  }
}

function paintWoodRough(ctx, n) {
  ctx.fillStyle = '#9a9a9a'
  ctx.fillRect(0, 0, n, n)
  for (let k = 0; k < 18; k += 1) {
    const x = (k * 43) % n
    ctx.strokeStyle = k % 2 ? '#7a7a7a' : '#b8b8b8'
    ctx.lineWidth = 1 + (k % 2)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    for (let y = 0; y <= n; y += 8) {
      ctx.lineTo(x + Math.sin(y * 0.04 + k) * 4, y)
    }
    ctx.stroke()
  }
}

const SEAT_ORANGE = ['#e87828', '#f0a030', '#d45818', '#e89028', '#c84810', '#e87020']

function makeCabinFloorMap() {
  const n = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = n
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1c1e22'
  ctx.fillRect(0, 0, n, n)
  for (let i = 0; i < 900; i += 1) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1
    const y = (Math.sin(i * 78.233) * 93758.1234) % 1
    const v = 28 + ((i * 17) % 40)
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`
    ctx.fillRect((x * n) | 0, (y * n) | 0, 1, 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(14, 28)
  tex.anisotropy = 2
  return tex
}

function makeCabinMapTex() {
  const w = 512
  const h = 360
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0e1a2e'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1a3a5c'
  ctx.fillRect(18, 18, w - 36, h - 36)
  // Fake route spaghetti
  const lines = [
    ['#EE352E', 40, 80, 460, 90],
    ['#00933C', 50, 140, 440, 200],
    ['#0039A6', 60, 220, 420, 120],
    ['#FF6319', 80, 280, 400, 250],
    ['#FCCC0A', 100, 100, 380, 300],
    ['#B933AD', 120, 260, 360, 80],
  ]
  ctx.lineWidth = 4
  lines.forEach(([c, x0, y0, x1, y1], i) => {
    ctx.strokeStyle = c
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.bezierCurveTo(x0 + 80, y0 + (i % 2 ? 40 : -30), x1 - 60, y1, x1, y1)
    ctx.stroke()
  })
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = 'bold 22px Helvetica, Arial, sans-serif'
  ctx.fillText('New York City Subway', 28, 48)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  return tex
}

/**
 * Small metal frames on the right wall — each holds a Sanity photo.
 * Click opens the PhotoPage modal via cabinGallery event.
 */
function PhotoFrames({ innerW, floorY, active }) {
  const [frames, setFrames] = useState([])
  const photosRef = useRef([])

  useEffect(() => {
    if (!active) return undefined
    let alive = true
    client.fetch(`*[_type == "photos"][0].images`).then(async (data) => {
      if (!alive || !data?.length) return
      photosRef.current = data
      const loader = new THREE.TextureLoader()
      const built = await Promise.all(data.slice(0, 18).map((photo, i) => (
        new Promise((resolve) => {
          const url = urlFor(photo).width(640).height(480).fit('crop').url()
          if (!url) {
            resolve(null)
            return
          }
          loader.load(
            url,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace
              tex.anisotropy = 2
              // Mix of landscape / portrait-ish frame sizes
              const landscape = i % 3 !== 1
              resolve({
                photo,
                tex,
                w: landscape ? 0.52 : 0.38,
                h: landscape ? 0.36 : 0.48,
              })
            },
            undefined,
            () => resolve(null),
          )
        })
      )))
      if (!alive) {
        built.forEach((f) => f?.tex?.dispose())
        return
      }
      setFrames(built.filter(Boolean))
    }).catch(() => {})
    return () => {
      alive = false
      document.body.style.cursor = ''
      setFrames((prev) => {
        prev.forEach((f) => f.tex?.dispose())
        return []
      })
    }
  }, [active])

  if (!active || frames.length === 0) return null

  // Two rows along the right wall, facing the aisle (−X)
  const wallX = innerW * 0.468
  const z0 = -3.55
  const gap = 0.62
  const rowY = [floorY + 1.62, floorY + 1.12]

  return (
    <group>
      {frames.map((f, i) => {
        const row = i % 2
        const col = (i / 2) | 0
        const z = z0 - col * gap - (row === 1 ? 0.12 : 0)
        const y = rowY[row] + ((col % 2) * 0.04 - 0.02)
        const frameW = f.w + 0.04
        const frameH = f.h + 0.04
        return (
          <group
            key={f.photo.asset?._ref || i}
            position={[wallX, y, z]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            {/* Frame back */}
            <mesh position={[0, 0, -0.012]}>
              <boxGeometry args={[frameW, frameH, 0.028]} />
              <meshStandardMaterial color="#9aa0a6" roughness={0.35} metalness={0.7} />
            </mesh>
            {/* Mat */}
            <mesh position={[0, 0, 0.004]}>
              <planeGeometry args={[f.w + 0.02, f.h + 0.02]} />
              <meshStandardMaterial color="#efe8dc" roughness={0.85} metalness={0.02} />
            </mesh>
            {/* Photo — clickable */}
            <mesh
              position={[0, 0, 0.01]}
              onClick={(e) => {
                e.stopPropagation()
                openCabinPhoto(f.photo, photosRef.current)
              }}
            >
              <planeGeometry args={[f.w, f.h]} />
              <meshStandardMaterial
                map={f.tex}
                roughness={0.55}
                metalness={0.05}
                toneMapped={false}
              />
            </mesh>
          </group>
        )
      })}
      <pointLight position={[wallX - 0.35, floorY + 1.4, -5.2]} color="#fff2dc" intensity={1.4} distance={4} decay={2} />
    </group>
  )
}

/** After seated, wheel pans gaze along the photo wall. */
function PhotoSeatPan({ enabled }) {
  const { camera } = useThree()
  const offset = useRef(0)
  const look = useRef(new THREE.Vector3(...PHOTO_SEAT.lookAt))
  const target = useMemo(() => new THREE.Vector3(), [])
  const targetLook = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!enabled) {
      offset.current = 0
      return undefined
    }
    const onWheel = (e) => {
      offset.current = THREE.MathUtils.clamp(offset.current + e.deltaY * 0.0032, -3.2, 2.4)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [enabled])

  useFrame((_, dt) => {
    if (!enabled) return
    const k = 1 - Math.exp(-5.5 * Math.min(dt, 0.05))
    target.set(
      PHOTO_SEAT.position[0],
      PHOTO_SEAT.position[1],
      PHOTO_SEAT.position[2] + offset.current,
    )
    targetLook.set(
      PHOTO_SEAT.lookAt[0],
      PHOTO_SEAT.lookAt[1],
      PHOTO_SEAT.lookAt[2] + offset.current,
    )
    camera.position.lerp(target, k)
    look.current.lerp(targetLook, k)
    camera.lookAt(look.current)
  })

  return null
}

/**
 * Lead-car cabin — R62A aisle view (fresh rebuild from reference).
 * Local space: origin at car front, −Z toward the rear.
 */
function CarInterior({ carL, carW, carH, arch, openEntry = false, showPhotos = false }) {
  const floorY = 0.28
  const wallTop = carH - arch
  const ceilY = wallTop - 0.06
  const innerW = carW - 0.2
  const aisleW = 0.98
  const seatD = (innerW - aisleW) * 0.5
  const seatH = 0.44
  const seatPitch = 0.48
  const baseH = 0.2
  const railY = floorY + 1.68
  const adY = railY + 0.38
  const winY = floorY + 1.42
  const doorZs = useMemo(() => [-3.15, -6.75, -10.35, -13.55], [])
  const doorSpan = 1.32

  const floorMap = useMemo(() => makeCabinFloorMap(), [])
  const mapTex = useMemo(() => makeCabinMapTex(), [])
  const seatGeo = useMemo(() => new THREE.BoxGeometry(0.42, seatH, 0.44), [seatH])
  const poleGeo = useMemo(
    () => new THREE.CylinderGeometry(0.026, 0.026, ceilY - floorY - 0.06, 10),
    [ceilY, floorY],
  )
  const railGeo = useMemo(() => new THREE.CylinderGeometry(0.016, 0.016, 1, 8), [])

  useLayoutEffect(() => () => {
    floorMap.dispose()
    mapTex.dispose()
    seatGeo.dispose()
    poleGeo.dispose()
    railGeo.dispose()
  }, [floorMap, mapTex, seatGeo, poleGeo, railGeo])

  const banks = useMemo(() => {
    const edges = [-0.5, ...doorZs.flatMap((z) => [z + doorSpan * 0.5, z - doorSpan * 0.5]), -carL + 0.5]
    const out = []
    for (let i = 0; i < edges.length - 1; i += 2) {
      const zFront = edges[i]
      const zRear = edges[i + 1]
      const len = zFront - zRear
      if (len < 0.75) continue
      out.push({ z: (zFront + zRear) * 0.5, len, zFront, zRear })
    }
    return out
  }, [carL, doorZs, doorSpan])

  const steel = { color: '#c4c8cc', roughness: 0.28, metalness: 0.82 }
  const steelDark = { color: '#9aa0a6', roughness: 0.34, metalness: 0.72 }
  const cream = { color: '#e4dcc8', roughness: 0.78, metalness: 0.04 }
  const seatPlastic = (color) => ({ color, roughness: 0.42, metalness: 0.06 })

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, floorY, -carL * 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerW, carL * 0.97]} />
        <meshStandardMaterial map={floorMap} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Ceiling + center recess */}
      <mesh position={[0, ceilY, -carL * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerW * 0.98, carL * 0.95]} />
        <meshStandardMaterial color="#ddd6c8" roughness={0.7} metalness={0.12} />
      </mesh>
      <mesh position={[0, ceilY - 0.04, -carL * 0.5]}>
        <boxGeometry args={[0.55, 0.06, carL * 0.9]} />
        <meshStandardMaterial color="#cfc8ba" roughness={0.65} metalness={0.15} />
      </mesh>
      {[-3.5, -6.2, -9.0, -11.8, -14.2].map((z) => (
        <mesh key={`vent-${z}`} position={[0, ceilY - 0.075, z]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 14]} />
          <meshStandardMaterial color="#8a8680" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Side fluorescent strips */}
      {[-1, 1].map((side) => (
        <mesh key={`tube-${side}`} position={[side * (innerW * 0.4), ceilY - 0.05, -carL * 0.5]}>
          <boxGeometry args={[0.11, 0.04, carL * 0.9]} />
          <meshStandardMaterial
            color="#fff8e8"
            emissive="#ffe9b8"
            emissiveIntensity={1.7}
            roughness={0.35}
            metalness={0.05}
          />
        </mesh>
      ))}
      <pointLight position={[0, ceilY - 0.4, -carL * 0.22]} color="#fff3dc" intensity={4.6} distance={11} decay={2} />
      <pointLight position={[0, ceilY - 0.4, -carL * 0.5]} color="#fff3dc" intensity={4.4} distance={11} decay={2} />
      <pointLight position={[0, ceilY - 0.4, -carL * 0.78]} color="#fff3dc" intensity={4.2} distance={11} decay={2} />

      {/* Front bulkhead (behind seated camera) */}
      <mesh position={[0, (floorY + wallTop) * 0.5, -0.32]}>
        <boxGeometry args={[innerW * 0.98, wallTop - floorY - 0.08, 0.07]} />
        <meshStandardMaterial {...steelDark} />
      </mesh>
      {/* Rear bulkhead */}
      <mesh position={[0, (floorY + wallTop) * 0.5, -carL + 0.28]}>
        <boxGeometry args={[innerW * 0.98, wallTop - floorY - 0.08, 0.07]} />
        <meshStandardMaterial {...steelDark} />
      </mesh>

      {/* Wall segments between doors: cream upper + window + stainless kick */}
      {banks.map((bank, bi) => (
        [-1, 1].map((side) => {
          const x = side * (innerW * 0.5 - 0.015)
          const rotY = side * Math.PI / 2
          const winH = 0.72
          const creamH = wallTop - (winY + winH * 0.5) - 0.08
          return (
            <group key={`wall-${bi}-${side}`}>
              {/* Kick / lower stainless */}
              <mesh position={[x, floorY + 0.38, bank.z]} rotation={[0, rotY, 0]}>
                <planeGeometry args={[bank.len * 0.96, 0.76]} />
                <meshStandardMaterial {...steel} side={THREE.DoubleSide} />
              </mesh>
              {/* Window (tunnel dark) */}
              <mesh position={[x, winY, bank.z]} rotation={[0, rotY, 0]}>
                <planeGeometry args={[bank.len * 0.88, winH]} />
                <meshStandardMaterial
                  color="#0a0c10"
                  roughness={0.15}
                  metalness={0.55}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Window frame */}
              <mesh position={[side * (innerW * 0.5 - 0.04), winY, bank.z]}>
                <boxGeometry args={[0.03, winH + 0.1, bank.len * 0.92]} />
                <meshStandardMaterial {...steelDark} />
              </mesh>
              {/* Cream upper panel */}
              <mesh
                position={[x, winY + winH * 0.5 + creamH * 0.5 + 0.02, bank.z]}
                rotation={[0, rotY, 0]}
              >
                <planeGeometry args={[bank.len * 0.96, Math.max(0.2, creamH)]} />
                <meshStandardMaterial {...cream} side={THREE.DoubleSide} />
              </mesh>
              {/* Ad card (angled under lights) */}
              <mesh
                position={[side * (innerW * 0.46), adY, bank.z]}
                rotation={[0.42, rotY, 0]}
              >
                <planeGeometry args={[bank.len * 0.82, 0.3]} />
                <meshStandardMaterial
                  color={['#2a4060', '#5a2828', '#1a4a3a', '#4a2a50', '#3a3a28'][bi % 5]}
                  roughness={0.62}
                  metalness={0.05}
                />
              </mesh>
            </group>
          )
        })
      ))}

      {/* Seat banks */}
      {banks.map((bank, bi) => (
        [-1, 1].map((side) => {
          const n = Math.max(2, Math.floor(bank.len / seatPitch))
          const pitch = bank.len / n
          const bankX = side * (aisleW * 0.5 + seatD * 0.5)
          return (
            <group key={`seats-${bi}-${side}`} position={[bankX, 0, bank.z]}>
              {/* Continuous seat base */}
              <mesh position={[0, floorY + baseH * 0.5, 0]}>
                <boxGeometry args={[seatD * 0.94, baseH, bank.len * 0.92]} />
                <meshStandardMaterial color="#ebe6dc" roughness={0.55} metalness={0.08} />
              </mesh>
              {/* Stainless kick under seats toward aisle */}
              <mesh position={[side * -seatD * 0.42, floorY + baseH * 0.55, 0]}>
                <boxGeometry args={[0.04, baseH * 0.9, bank.len * 0.9]} />
                <meshStandardMaterial {...steel} />
              </mesh>
              {Array.from({ length: n }, (_, si) => {
                const z = bank.len * 0.5 - pitch * (si + 0.5)
                const color = SEAT_ORANGE[(bi * 2 + si + (side > 0 ? 1 : 0)) % SEAT_ORANGE.length]
                return (
                  <mesh
                    key={si}
                    geometry={seatGeo}
                    position={[side * 0.015, floorY + baseH + seatH * 0.5, z]}
                  >
                    <meshStandardMaterial {...seatPlastic(color)} />
                  </mesh>
                )
              })}
              {/* Seat-back handrail */}
              <mesh
                geometry={railGeo}
                position={[side * -0.06, railY - 0.55, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[1, bank.len * 0.86, 1]}
              >
                <meshStandardMaterial {...steel} />
              </mesh>
              {/* Overhead longitudinal rail */}
              <mesh
                geometry={railGeo}
                position={[side * -0.1, railY, 0]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[1, bank.len * 0.88, 1]}
              >
                <meshStandardMaterial {...steel} />
              </mesh>
            </group>
          )
        })
      ))}

      {/* Door bays + stanchions */}
      {doorZs.map((z, i) => (
        <group key={`door-${i}`} position={[0, 0, z]}>
          {[-1, 1].map((side) => {
            const entryOpen = openEntry && i === 0 && side === -1
            return (
              <group key={side}>
                {entryOpen ? null : (
                  <>
                    {/* Double-leaf door slab */}
                    <mesh position={[side * (innerW * 0.5 - 0.035), floorY + 1.12, 0]}>
                      <boxGeometry args={[0.06, 2.16, doorSpan * 0.94]} />
                      <meshStandardMaterial {...steelDark} />
                    </mesh>
                    {/* Seam */}
                    <mesh position={[side * (innerW * 0.5 - 0.005), floorY + 1.12, 0]}>
                      <boxGeometry args={[0.02, 2.05, 0.04]} />
                      <meshStandardMaterial color="#7a8086" roughness={0.4} metalness={0.65} />
                    </mesh>
                    {/* Door windows */}
                    {[-0.28, 0.28].map((dz) => (
                      <mesh key={dz} position={[side * (innerW * 0.5 - 0.01), floorY + 1.55, dz]}>
                        <boxGeometry args={[0.02, 0.5, 0.2]} />
                        <meshStandardMaterial
                          color="#f5ecd0"
                          emissive="#ffe2a8"
                          emissiveIntensity={0.7}
                          roughness={0.25}
                          metalness={0.1}
                        />
                      </mesh>
                    ))}
                  </>
                )}
                {/* Door-end poles */}
                <mesh
                  geometry={poleGeo}
                  position={[side * (aisleW * 0.44), floorY + (ceilY - floorY) * 0.5 - 0.03, doorSpan * 0.46]}
                >
                  <meshStandardMaterial {...steel} />
                </mesh>
                <mesh
                  geometry={poleGeo}
                  position={[side * (aisleW * 0.44), floorY + (ceilY - floorY) * 0.5 - 0.03, -doorSpan * 0.46]}
                >
                  <meshStandardMaterial {...steel} />
                </mesh>
              </group>
            )
          })}
          {/* Center aisle stanchion */}
          <mesh geometry={poleGeo} position={[0, floorY + (ceilY - floorY) * 0.5 - 0.03, 0]}>
            <meshStandardMaterial {...steel} />
          </mesh>
        </group>
      ))}

      {/* Extra mid-bank aisle poles (reference rhythm) */}
      {banks.map((bank, bi) => (
        bi % 2 === 0 ? (
          <mesh
            key={`aisle-pole-${bi}`}
            geometry={poleGeo}
            position={[0, floorY + (ceilY - floorY) * 0.5 - 0.03, bank.z]}
          >
            <meshStandardMaterial {...steel} />
          </mesh>
        ) : null
      ))}

      {/* Subway map — left wall, first long bank */}
      <mesh position={[-innerW * 0.485, floorY + 1.55, -5.15]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 0.88]} />
        <meshStandardMaterial {...steelDark} />
      </mesh>
      <mesh position={[-innerW * 0.478, floorY + 1.55, -5.15]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.08, 0.76]} />
        <meshStandardMaterial map={mapTex} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Framed photos on the right wall (photo route) */}
      <PhotoFrames innerW={innerW} floorY={floorY} active={showPhotos} />

      {/* LED destination strip */}
      <mesh position={[-innerW * 0.47, floorY + 2.05, -4.35]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.85, 0.14]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[-innerW * 0.465, floorY + 2.05, -4.35]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.78, 0.09]} />
        <meshStandardMaterial
          color="#1a0808"
          emissive="#c01818"
          emissiveIntensity={0.55}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  )
}

function TrainCar({
  maps,
  body,
  frontGeo,
  roofGeo,
  carL,
  carW,
  carH,
  arch,
  wallTop,
  zOffset,
  lead,
  tail,
  headLights,
  showInterior = false,
  showPhotos = false,
}) {
  return (
    <group position={[0, 0, zOffset]}>
      {lead && showInterior ? (
        <CarInterior
          carL={carL}
          carW={carW}
          carH={carH}
          arch={arch}
          openEntry
          showPhotos={showPhotos}
        />
      ) : null}
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
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (carW / 2 + 0.015), wallTop * 0.5, -carL / 2]}
          rotation={[0, side * Math.PI / 2, 0]}
        >
          <planeGeometry args={[carL * 0.985, wallTop * 0.98]} />
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
      {!tail ? (
        <mesh position={[0, 0.55, -carL - TRAIN_COUPLE * 0.5]}>
          <boxGeometry args={[0.28, 0.22, TRAIN_COUPLE * 0.85]} />
          <meshStandardMaterial color="#2a2c2e" roughness={0.55} metalness={0.65} />
        </mesh>
      ) : null}
      {lead
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

function Train({ showInterior = false, showPhotos = false }) {
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
      1024,
      1024,
    )
    const side = makeLabelTexture(paintCarSide, 3072, 768)
    const sidePlatform = makeLabelTexture(
      (ctx, w, h) => paintCarSide(ctx, w, h, { reverse: true }),
      3072,
      768,
    )
    const roof = makeCanvasTexture(paintRoofRibs, 256, THREE.SRGBColorSpace)
    roof.wrapS = THREE.RepeatWrapping
    roof.wrapT = THREE.RepeatWrapping
    roof.repeat.set(8, 1)
    return { front, side, sidePlatform, roof }
  }, [line, TRAIN_REV])

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
    const idle = parked ? 0.5 + 0.5 * Math.sin(t * 1.35) : 0
    const s = 1 + h * 0.028 + idle * 0.008
    root.current.scale.set(s, s, s)
    if (glowLight.current) {
      glowLight.current.intensity = (parked ? 0.55 + idle * 0.85 : 0) + h * 3.4
    }
    headLights.current.forEach((light) => {
      if (light) light.intensity = 3.6 + (parked ? idle * 1.0 : 0) + h * 2.2
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
      <pointLight position={[-2.4, 2.1, 1.6]} color="#e4ebf2" intensity={5.5} distance={14} decay={2} />
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
          showInterior={showInterior && i === 0}
          showPhotos={showPhotos && i === 0}
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
function CeilingFixture({ z, index, lit = true }) {
  const tubeRef  = useRef()
  const diffuserRef = useRef()
  const lightRef = useRef()

  const wait = useRef(2 + index * 0.7 + Math.random() * 4)
  const dip = useRef(0)

  useFrame((_, dt) => {
    // Distant unlit rows: skip flicker work — emissive meshes stay static
    if (!lit && index > 3) return
    wait.current -= dt
    let level = 1
    if (dip.current > 0) {
      dip.current -= dt
      level = 0.92
      if (dip.current <= 0) wait.current = 2.5 + Math.random() * 5
    } else if (wait.current <= 0) {
      dip.current = 0.07 + Math.random() * 0.08
      level = 0.92
    }

    if (tubeRef.current) tubeRef.current.material.emissiveIntensity = level * 10
    if (diffuserRef.current) diffuserRef.current.material.emissiveIntensity = level * 2.2
    if (lightRef.current) lightRef.current.intensity = level * 5.4
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
          intensity={5.4}
          distance={6.5}
          decay={2}
          position={[0, -0.35, 0]}
        />
      ) : null}
    </group>
  )
}

function Fluorescents() {
  return (
    <group>
      {Array.from({ length: FIXTURE_COUNT }, (_, i) => (
        <CeilingFixture
          key={i}
          index={i}
          z={FIXTURE_Z0 - i * FIXTURE_STEP}
          lit={i < 5}
        />
      ))}
    </group>
  )
}

function StationBloom({ enabled = true }) {
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
  return (
    <>
      <color attach="background" args={[COL.clear]} />
      <fogExp2 attach="fog" args={[COL.clear, 0.032]} />
      <hemisphereLight args={['#e8e4dc', '#3a3632', 0.52]} />
      <ambientLight intensity={0.22} color="#f0ebe4" />
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

function Signage({ onExit, locked = false }) {
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
  const leaving = useRef(false)
  const exitAt = useRef(0)
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    if (!locked) {
      leaving.current = false
      exitAt.current = 0
    }
  }, [locked])

  useFrame((state, dt) => {
    if (!unit.current) return
    const d = Math.min(dt, 0.05)
    const t = state.clock.elapsedTime
    const want = hovering.current && !locked && !leaving.current && !reducedMotion
    hoverAmt.current = THREE.MathUtils.lerp(hoverAmt.current, want ? 1 : 0, 1 - Math.exp(-10 * d))
    const h = hoverAmt.current

    // Always a soft sway to invite clicks; hover grows it a bit
    const live = !locked && !leaving.current && !reducedMotion
    const sway = live ? 1 : 0
    const s = 1 + h * 0.07
    unit.current.scale.set(s, s, s)
    unit.current.rotation.z = Math.sin(t * 1.55) * 0.028 * sway * (1 + h * 0.35)
    unit.current.rotation.x = Math.sin(t * 1.15) * 0.01 * sway

    if (leaving.current && exitAt.current && performance.now() >= exitAt.current) {
      exitAt.current = 0
      onExit?.()
    }
  })

  const onHit = (event) => {
    event.stopPropagation()
    if (locked || leaving.current || reducedMotion) return
    leaving.current = true
    hovering.current = false
    exitAt.current = performance.now() + 220
  }

  return (
    <group position={[STAIR_X, 2.95, STAIR_Z0 - STAIR_N * STAIR_RUN * 0.28]} rotation={[0, 0.04, 0]}>
      {/* Ceiling pivot — rods and board are one rigid piece under this */}
      <group
        ref={unit}
        onClick={onHit}
        onPointerOver={(e) => {
          e.stopPropagation()
          if (locked || leaving.current) return
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

// Green lamp color for the cap and light tint
const LAMP_GREEN = '#2d6e4e'
const LAMP_LIGHT_COLOR = '#2d6e4e'  // exact same dark green as the pole
const LAMP_GLOBE_EMISSIVE = '#e8f4ec' // very slightly greenish white glow

// Single lamp post: pole + arm + green cap + white globe + lights
function LampPost({ position }) {
  const poleH = 2.5
  const armLen = 0.55
  const globeY = poleH + 0.18

  return (
    <group position={position}>
      {/* Vertical pole */}
      <mesh position={[0, poleH / 2, 0]}>
        <cylinderGeometry args={[0.028, 0.036, poleH, 10]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.55} metalness={0.7} />
      </mesh>

      {/* Horizontal arm extending toward platform center */}
      <mesh
        position={[-armLen / 2, poleH, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <cylinderGeometry args={[0.018, 0.022, armLen, 8]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.55} metalness={0.7} />
      </mesh>

      {/* Green lamp cap / hood */}
      <mesh position={[-armLen, poleH + 0.06, 0]}>
        <cylinderGeometry args={[0.14, 0.06, 0.18, 12, 1, true]} />
        <meshStandardMaterial
          color={LAMP_GREEN}
          roughness={0.45}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Cap top disc */}
      <mesh position={[-armLen, poleH + 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14, 12]} />
        <meshStandardMaterial color={LAMP_GREEN} roughness={0.45} metalness={0.3} />
      </mesh>

      {/* White globe — high emissive to fake bloom glow */}
      <mesh position={[-armLen, globeY, 0]}>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshPhysicalMaterial
          color="#ffffff"
          emissive={LAMP_GLOBE_EMISSIVE}
          emissiveIntensity={8}
          roughness={0.05}
          metalness={0}
          transmission={0.6}
          thickness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Halo sphere — slightly larger, transparent, fakes a bloom corona */}
      <mesh position={[-armLen, globeY, 0]}>
        <sphereGeometry args={[0.085 * 1.15, 16, 16]} />
        <meshBasicMaterial
          color={LAMP_GLOBE_EMISSIVE}
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Downward spill — keep local, less green soup */}
      <group position={[-armLen, globeY - 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <spotLight
          color="#4a7a5c"
          intensity={9}
          distance={5.5}
          angle={Math.PI / 5}
          penumbra={0.55}
          decay={2}
          castShadow={false}
        />
      </group>
      <pointLight
        position={[-armLen, globeY - 0.1, 0]}
        color="#d8e0d4"
        intensity={1.4}
        distance={3.2}
        decay={2.5}
      />
    </group>
  )
}

// Place lamps every other pillar along the platform edge
const LAMP_POSITIONS = Array.from({ length: 6 }, (_, i) => [
  PILLAR_X + 0.12,            // just beside the pillar toward platform
  0,                          // on the floor
  PILLAR_Z0 - i * PILLAR_GAP * 2,  // every 2nd pillar gap
])

function LampPosts() {
  return (
    <group>
      {LAMP_POSITIONS.map((pos, i) => (
        <LampPost key={i} position={pos} />
      ))}
    </group>
  )
}

function Benches() {
  const maps = useMemo(() => {
    const wood = makeCanvasTexture(paintWood, 256, THREE.SRGBColorSpace)
    wood.wrapS = THREE.RepeatWrapping
    wood.wrapT = THREE.RepeatWrapping
    wood.anisotropy = 8
    wood.repeat.set(1.4, 3.4)
    const rough = makeCanvasTexture(paintWoodRough, 256, THREE.NoColorSpace)
    rough.wrapS = THREE.RepeatWrapping
    rough.wrapT = THREE.RepeatWrapping
    rough.repeat.set(1.4, 3.4)
    return { wood, rough }
  }, [])

  useLayoutEffect(() => () => {
    maps.wood.dispose()
    maps.rough.dispose()
  }, [maps])

  const len = 2.15
  const depth = 0.5
  const seatY = 0.44
  const x = WALL_X + depth * 0.5 + 0.05
  const zs = [-3.4, -5.8]
  const wood = {
    map: maps.wood,
    roughnessMap: maps.rough,
    roughness: 0.78,
    metalness: 0.02,
  }

  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[x, 0, z]}>
          {[-len * 0.32, len * 0.32].map((dz) => (
            <mesh key={dz} position={[0, 0.2, dz]}>
              <boxGeometry args={[depth * 0.7, 0.4, 0.26]} />
              <meshStandardMaterial {...wood} color="#9a6d3f" />
            </mesh>
          ))}
          <mesh position={[0, seatY, 0]}>
            <boxGeometry args={[depth, 0.09, len]} />
            <meshStandardMaterial {...wood} color="#c2945d" />
          </mesh>
          <mesh position={[-depth * 0.42, seatY + 0.28, 0]}>
            <boxGeometry args={[0.07, 0.52, len]} />
            <meshStandardMaterial {...wood} color="#c2945d" />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => {
            const dz = -len * 0.46 + (i / 4) * len * 0.92
            return (
              <mesh key={i} position={[0.02, seatY + 0.16, dz]}>
                <boxGeometry args={[depth * 0.82, 0.3, 0.09]} />
                <meshStandardMaterial {...wood} color="#9a6d3f" />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function Stairwell() {
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
        <meshStandardMaterial color="#e2b40f" roughness={0.55} metalness={0.04} />
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
                <meshStandardMaterial color="#e2b40f" roughness={0.5} metalness={0.04} />
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
        <meshStandardMaterial color="#e2b40f" roughness={0.5} metalness={0.04} />
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
  cabD: 0.28,
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

function objectCssMatrix(matrix, factor) {
  const f = factor
  return cssMatrix3d(
    matrix,
    [1 / f, 1 / f, 1 / f, 1, -1 / f, -1 / f, -1 / f, -1, 1 / f, 1 / f, 1 / f, 1, 1, 1, 1, 1],
    'translate(-50%,-50%)',
  )
}

function InfoKiosk({ hud, showBoot = true }) {
  const { cabW, cabH, cabD, postH, postW, bezel, screenW, screenH, panelW } = KIOSK
  const yCab = postH + cabH / 2
  const screen = useRef()
  const { camera, gl } = useThree()
  const camDir = useMemo(() => new THREE.Vector3(), [])
  const toObj = useMemo(() => new THREE.Vector3(), [])
  const pxPerMeter = panelW / screenW
  const lastCam = useRef('')
  const lastObj = useRef('')
  const logoTex = useLoader(THREE.TextureLoader, '/mta-logo.jpg')
  const metalTex = useLoader(THREE.TextureLoader, '/metal.jpg')

  useLayoutEffect(() => {
    logoTex.colorSpace = THREE.SRGBColorSpace
    logoTex.anisotropy = 4
    logoTex.needsUpdate = true
  }, [logoTex])

  useLayoutEffect(() => {
    metalTex.wrapS = THREE.RepeatWrapping
    metalTex.wrapT = THREE.RepeatWrapping
    metalTex.repeat.set(1.5, 2.1)
    metalTex.colorSpace = THREE.SRGBColorSpace
    metalTex.anisotropy = 4
    metalTex.needsUpdate = true
  }, [metalTex])

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
    // Match the *rendered* canvas CSS box (iOS Safari / DPR quirks break R3F `size`)
    const rect = gl.domElement.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    const widthHalf = w / 2
    const heightHalf = h / 2
    const perspective = heightHalf / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    root.style.width = `${w}px`
    root.style.height = `${h}px`
    root.style.perspective = `${perspective}px`
    const camXform = `translateZ(${perspective}px)${cssMatrix3d(camera.matrixWorldInverse, CAM_CSS_MUL)}translate(${widthHalf}px,${heightHalf}px)`
    const objXform = objectCssMatrix(screen.current.matrixWorld, pxPerMeter)
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
  const inset = 0.032
  const screenZ = faceZ - inset
  const rimZ = faceZ + 0.004
  const steel = {
    map: metalTex,
    color: '#d4d8dc',
    roughness: 0.36,
    metalness: 0.78,
  }
  const steelBright = {
    map: metalTex,
    color: '#e6e9ec',
    roughness: 0.3,
    metalness: 0.82,
  }
  const lip = bezel + 0.01
  const logoW = screenW * 0.52
  const logoH = logoW * (144 / 256)

  return (
    <group position={[KIOSK.x, 0, KIOSK.z]}>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[0.58, 0.05, 0.24]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.2, postH / 2, 0]}>
          <boxGeometry args={[postW, postH, postW]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      <mesh position={[0, yCab, 0]}>
        <boxGeometry args={[cabW, cabH, cabD]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* Dark recessed well so the LCD sits in the cabinet */}
      <mesh position={[0, yCab, faceZ - inset / 2]}>
        <boxGeometry args={[screenW + 0.02, screenH + 0.02, inset]} />
        <meshStandardMaterial color="#16181a" roughness={0.82} metalness={0.35} />
      </mesh>
      {/* Raised metal bezel around the opening */}
      {[
        [0, yCab + (screenH + lip) / 2, rimZ, cabW * 0.98, lip],
        [0, yCab - (screenH + lip) / 2, rimZ, cabW * 0.98, lip],
        [-(screenW + lip) / 2, yCab, rimZ, lip, screenH + lip * 2],
        [(screenW + lip) / 2, yCab, rimZ, lip, screenH + lip * 2],
      ].map(([x, y, z, w, h], i) => (
        <mesh key={i} position={[x, y, z]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial {...steelBright} />
        </mesh>
      ))}
      {/* Idle screensaver: real mesh in the scene (depth-sorts with MetroCard). No CSS overlay. */}
      {showBoot ? (
        <group position={[0, yCab, screenZ + 0.001]}>
          <mesh>
            <planeGeometry args={[screenW, screenH]} />
            <meshBasicMaterial color="#000000" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[logoW, logoH]} />
            <meshBasicMaterial map={logoTex} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      <object3D ref={screen} position={[0, yCab, screenZ]} />
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
    // Visible stretch of trench from the kiosk / video shot
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
  hud,
  onReady,
  onExit,
  dimmed,
  onArrive,
  introReady,
  onIntroDone,
  showBoot = true,
  photoLive = false,
}) {
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

  const inCabin = pov === 'cabin' || pov === 'photo' || pov === 'video' || pov === 'about'

  return (
    <>
      <CameraRig pov={pov} onArrive={onArrive} locked={dimmed} />
      <PhotoSeatPan enabled={photoLive && !dimmed} />
      <Atmosphere />
      <Shell maps={maps} />
      <CeilingBeams />
      <Stairwell />
      <Benches />
      <YellowStrip />
      <FloorTrash showMetroCard={!windMounted} />
      <Tracks />
      <TrackTrash />
      <Train showInterior={inCabin} showPhotos={pov === 'photo'} />
      <TrainSteam />
      <VibeRat />
      <Pillars />
      <Signage onExit={onExit} locked={dimmed} />
      <InfoKiosk hud={hud} showBoot={showBoot} />
      {windMounted ? (
        <WindCard
          ready={introReady}
          driveCamera={dimmed}
          onCameraHome={onIntroDone}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <ReadyPing onReady={onReady} />
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
  onExit,
  onArrive,
  leaveRef,
}) {
  const [use3d, setUse3d] = useState(() => hasWebGL())
  const hud = useRef({ root: null, cam: null, obj: null })
  const navigate = useNavigate()
  const pov = POVS[shot] ? shot : 'kiosk'
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [zap, setZap] = useState('closed')
  const [kioskArrived, setKioskArrived] = useState(false)
  const [photoLive, setPhotoLive] = useState(false)
  const pendingNav = useRef(null)
  const screenLive = kioskLive && zap === 'open'
  // CSS-3D overlay only while zapping / live — idle uses a cheap WebGL boot plane
  const overlayOn = zap !== 'closed'

  const handleArrive = useCallback((next) => {
    onArrive?.(next)
    setKioskArrived(next === 'kiosk')
    setPhotoLive(next === 'photo')
  }, [onArrive])

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
    }
    if (pov !== 'photo') setPhotoLive(false)
  }, [pov])

  // Arrive at kiosk + interactive → zap open (black MTA until then)
  useEffect(() => {
    if (pov !== 'kiosk' || !kioskLive || !kioskArrived) return
    if (zap !== 'closed') return
    setZap(reducedMotion ? 'open' : 'opening')
  }, [pov, kioskLive, kioskArrived, zap, reducedMotion])

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
      if (pov !== 'kiosk' || zap !== 'open') return false
      pendingNav.current = to
      setZap('closing')
      return true
    }
    return () => {
      leaveRef.current.tryLeave = () => false
    }
  }, [leaveRef, pov, zap])

  if (!use3d) return null

  return (
    <Layer $hit={!dimmed}>
      <SceneWrap $dim={dimmed}>
      <Suspense fallback={null}>
        <Canvas
          frameloop="always"
            dpr={mobile ? [1, 1.25] : [1, 1.5]}
            gl={{
              alpha: false,
              antialias: true,
              powerPreference: 'high-performance',
            }}
            camera={{
              position: dimmed ? [0.2, 1.95, 3.6] : resolvePov(pov).position,
              fov: dimmed ? 42 : resolvePov(pov).fov,
              near: 0.1,
              far: 90,
            }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor(COL.clear, 1)
            gl.toneMapping = THREE.ACESFilmicToneMapping
              gl.toneMappingExposure = 1.32
              if (dimmed) camera.lookAt(0.15, 1.85, 1.0)
              else camera.lookAt(...resolvePov(pov).lookAt)
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              event.preventDefault()
              setUse3d(false)
            })
          }}
        >
            <StationWorld
              pov={pov}
              hud={hud}
              onReady={onReady}
              onExit={onExit}
              dimmed={dimmed}
              onArrive={handleArrive}
              introReady={introReady}
              onIntroDone={handleIntroDone}
              showBoot={!overlayOn}
              photoLive={photoLive}
            />
            <StationBloom enabled />
        </Canvas>
      </Suspense>
        {overlayOn ? (
          <Overlay ref={(n) => { hud.current.root = n }}>
            <OverlayCam ref={(n) => { hud.current.cam = n }}>
              <OverlayObj ref={(n) => { hud.current.obj = n }} $live={screenLive}>
                <KioskFrame>
                  <KioskZapScreen
                    phase={zap}
                    live={screenLive}
                    reducedMotion={reducedMotion}
                    onPhaseEnd={onZapPhaseEnd}
                  />
                </KioskFrame>
              </OverlayObj>
            </OverlayCam>
          </Overlay>
        ) : null}
      </SceneWrap>
      <Grain />
    </Layer>
  )
}
