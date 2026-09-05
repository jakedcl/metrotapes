export const STATION_ASSETS = [
  '/metrocard.png',
  '/subwaysign.jpg',
  '/subway-arrow-down.png',
  '/mta-logo.jpg',
  '/contactless-tap.png',
]

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(src)
    img.onerror = () => resolve(src)
    img.src = src
  })
}

export function preloadStationAssets() {
  return Promise.all(STATION_ASSETS.map(loadImage))
}
