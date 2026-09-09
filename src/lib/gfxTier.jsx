import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/**
 * Practical 3D: one scene, three GPU budgets.
 *
 * Fill rate (pixels × lights × materials) is the usual killer on phones.
 * We never promote mid-session — dropping is cheap, rebuilding textures is not.
 *
 * Look (lo-fi station):
 * - Mobile stays 1× DPR (chunky on purpose).
 * - Shared CSS grain sits over canvas AND HTML screens so LCDs aren't 4K stickers.
 * - Light CA fringe on the same film layer (not WebGL barrel / fisheye).
 */
export const GFX = {
  low: {
    // Phones: try 2× — modern iPhones handle it; boot preload hides the cost.
    dpr: [1, 2],
    bloom: false,
    antialias: false,
    grain: false,
    grainOpacity: 0.18,
    ca: false,
    softScreens: true,
    extras: false,
    lights: 1,
    physicalWalls: false,
    trainFront: 512,
    trainSide: [1280, 320],
    powerPreference: 'low-power',
    exposure: 1.55,
    hemi: 0.98,
    ambient: 0.52,
    tube: 9.4,
    kioskFill: 8.4,
    fog: 0.022,
  },
  mid: {
    dpr: [1, 1.25],
    bloom: false,
    antialias: true,
    grain: true,
    grainOpacity: 0.12,
    ca: true,
    softScreens: false,
    extras: true,
    lights: 2,
    physicalWalls: false,
    trainFront: 768,
    trainSide: [1536, 384],
    powerPreference: 'low-power',
    exposure: 1.52,
    hemi: 0.92,
    ambient: 0.46,
    tube: 9.2,
    kioskFill: 8.2,
    fog: 0.02,
  },
  high: {
    dpr: [1, 1.5],
    bloom: true,
    antialias: false,
    grain: true,
    grainOpacity: 0.1,
    ca: false,
    softScreens: false,
    extras: true,
    lights: 3,
    physicalWalls: true,
    trainFront: 1024,
    trainSide: [2048, 512],
    powerPreference: 'high-performance',
    exposure: 1.32,
    hemi: 0.52,
    ambient: 0.22,
    tube: 5.4,
    kioskFill: 8.2,
    fog: 0.024,
  },
}

export function detectGfxTier() {
  if (typeof window === 'undefined') return 'mid'

  const forced = new URLSearchParams(window.location.search).get('gfx')
  if (forced === 'low' || forced === 'mid' || forced === 'high') return forced

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const saveData = Boolean(navigator.connection?.saveData)
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 768
  const cores = navigator.hardwareConcurrency || 8
  const mem = navigator.deviceMemory

  if (reduced || saveData) return 'low'
  if (narrow) return 'low'
  // Chrome caps deviceMemory at 8 (= "8GB or more"). Phones often report 4.
  if (typeof mem === 'number' && mem <= 4) return 'low'
  if (cores <= 4 && coarse) return 'low'
  // Desktop default is mid: 2 tubes, no bloom. High is ?gfx=high only.
  return 'mid'
}

const GfxContext = createContext(null)

export function GfxProvider({ children }) {
  const [tier, setTier] = useState(detectGfxTier)
  const startRef = useRef(tier)

  const drop = useCallback(() => {
    setTier((current) => (current === 'high' ? 'mid' : current))
  }, [])

  const value = useMemo(() => ({
    tier,
    settings: GFX[tier],
    startSettings: GFX[startRef.current],
    drop,
  }), [drop, tier])

  return <GfxContext.Provider value={value}>{children}</GfxContext.Provider>
}

export function useGfx() {
  const value = useContext(GfxContext)
  if (!value) {
    return {
      tier: 'mid',
      settings: GFX.mid,
      startSettings: GFX.mid,
      drop: () => {},
    }
  }
  return value
}
