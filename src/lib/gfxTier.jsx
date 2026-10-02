import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/**
 * Practical 3D: one scene, three GPU budgets.
 *
 * Fill rate (pixels × lights × materials) is the usual killer on phones.
 * We never promote mid-session — dropping is cheap, rebuilding textures is not.
 *
 * Runtime adapt:
 * - Soften DPR first (cheap fill-rate cut).
 * - Then step high → mid → low (bloom / extras / lights / grain).
 * - Bad connection (saveData / 2g) forces low.
 *
 * Look (lo-fi station):
 * - Shared CSS grain sits over canvas AND HTML screens so LCDs aren't 4K stickers.
 * - Light CA fringe on the same film layer (not WebGL barrel / fisheye).
 */
export const GFX = {
  low: {
    // Phones: 1.5× — sharper than 1×, ~half the fill of 2× (which felt slow).
    dpr: [1, 1.5],
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
    // No idle pulse / ballast flicker. The still frame stays the same.
    idleMotion: false,
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

function tierDprMax(tier) {
  const dpr = GFX[tier].dpr
  return Array.isArray(dpr) ? dpr[1] : dpr
}

let softwareGpu = false

function isSoftwareRenderer() {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return false
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return /swiftshader|llvmpipe|softpipe|software|microsoft basic render|mesa offscreen/i.test(renderer)
  } catch {
    return false
  }
}

function isSlowConnection(conn) {
  if (!conn) return false
  if (conn.saveData) return true
  const et = conn.effectiveType
  return et === '2g' || et === 'slow-2g'
}

/** True when we should shrink preload / prefer low bandwidth. */
export function shouldConserveBandwidth() {
  if (typeof navigator === 'undefined') return false
  return isSlowConnection(navigator.connection)
}

export function detectGfxTier() {
  if (typeof window === 'undefined') return 'mid'

  const forced = new URLSearchParams(window.location.search).get('gfx')
  if (forced === 'low' || forced === 'mid' || forced === 'high') return forced

  // Software GL (SwiftShader, llvmpipe) reports a normal desktop CPU, so the
  // phone heuristics miss it and it stays on the mid tier. Force low.
  // ?gfx=high still wins — that check is above.
  softwareGpu = isSoftwareRenderer()
  if (softwareGpu) return 'low'

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 768
  const cores = navigator.hardwareConcurrency || 8
  const mem = navigator.deviceMemory
  const conn = navigator.connection

  if (reduced || isSlowConnection(conn)) return 'low'
  if (narrow) return 'low'
  // Chrome caps deviceMemory at 8 (= "8GB or more"). Phones often report 4.
  if (typeof mem === 'number' && mem <= 4) return 'low'
  if (cores <= 4 && coarse) return 'low'
  // Desktop default is mid: 2 tubes, no bloom. High is ?gfx=high only.
  return 'mid'
}

function stepDown(tier) {
  if (tier === 'high') return 'mid'
  if (tier === 'mid') return 'low'
  return 'low'
}

const GfxContext = createContext(null)

export function GfxProvider({ children }) {
  const [tier, setTier] = useState(detectGfxTier)
  const [dprMax, setDprMax] = useState(null)
  const startRef = useRef(tier)
  const forcedRef = useRef(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('gfx')
      : null,
  )

  const soften = useCallback(() => {
    setDprMax((prev) => {
      const ceiling = prev ?? tierDprMax(tier)
      if (ceiling <= 1) return 1
      // Step down in 0.25 chunks; floor at 1.
      return Math.max(1, Math.round((ceiling - 0.25) * 100) / 100)
    })
  }, [tier])

  const drop = useCallback(() => {
    if (forcedRef.current === 'low') return
    setTier((current) => {
      const next = stepDown(current)
      if (next === current) return current
      // New tier brings its own DPR budget; clear soft cap.
      setDprMax(null)
      return next
    })
  }, [])

  // Bad network mid-session → collapse to low (bandwidth + thermal crush).
  useEffect(() => {
    const conn = typeof navigator !== 'undefined' ? navigator.connection : null
    if (!conn || forcedRef.current) return undefined

    const apply = () => {
      if (!isSlowConnection(conn)) return
      setTier((t) => (t === 'low' ? t : 'low'))
      setDprMax(null)
    }

    apply()
    conn.addEventListener('change', apply)
    return () => conn.removeEventListener('change', apply)
  }, [])

  const settings = useMemo(() => {
    const base = GFX[tier]
    const min = Array.isArray(base.dpr) ? base.dpr[0] : 1
    let max = dprMax ?? (Array.isArray(base.dpr) ? base.dpr[1] : base.dpr)
    // Phones stay at the low-tier cap (1.5). Software renderers draw at 1×.
    if (softwareGpu) max = Math.min(max, 1)
    return {
      ...base,
      dpr: [min, Math.max(min, max)],
    }
  }, [tier, dprMax])

  const effectiveMax = settings.dpr[1]
  const canSoften = effectiveMax > 1.01
  const canDrop = tier !== 'low' && forcedRef.current !== 'low'

  const value = useMemo(() => ({
    tier,
    settings,
    startSettings: GFX[startRef.current],
    soften,
    drop,
    canSoften,
    canDrop,
  }), [tier, settings, soften, drop, canSoften, canDrop])

  return <GfxContext.Provider value={value}>{children}</GfxContext.Provider>
}

export function useGfx() {
  const value = useContext(GfxContext)
  if (!value) {
    return {
      tier: 'mid',
      settings: GFX.mid,
      startSettings: GFX.mid,
      soften: () => {},
      drop: () => {},
      canSoften: false,
      canDrop: false,
    }
  }
  return value
}
