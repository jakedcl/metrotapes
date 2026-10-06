import { BOOT_LIMIT_MS, withTimeout } from './bootGate'

export const STATION_ASSETS = [
  '/metrocard.png',
  '/subwaysign.jpg',
  '/subway-arrow-down.png',
  '/mta-logo.jpg',
  '/contactless-tap.png',
]

let preloadPromise = null

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src || typeof Image === 'undefined') {
      resolve(src)
      return
    }
    const img = new Image()
    img.onload = () => resolve(src)
    img.onerror = () => resolve(src)
    img.src = src
  })
}

/** Resolves when preloadStationAssets has finished (or immediately if already done). */
export function whenStationPreloaded() {
  return preloadPromise || Promise.resolve()
}

/**
 * Station textures only. Wall photos, about images, and the video list
 * load with the page that shows them. The boot screen does not wait forever.
 */
export function preloadStationAssets() {
  if (!preloadPromise) {
    preloadPromise = withTimeout(
      Promise.all(STATION_ASSETS.map(loadImage)),
      BOOT_LIMIT_MS,
    )
  }
  return preloadPromise
}
