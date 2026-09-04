export const STATION_ASSETS = [
  '/metal.jpg',
  '/metrocard.png',
  '/subwaysign.jpg',
  '/subway-arrow-down.png',
  '/mta-logo.jpg',
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
