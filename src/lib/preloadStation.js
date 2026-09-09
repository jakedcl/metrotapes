import { client, urlFor } from './sanity'

export const STATION_ASSETS = [
  '/metrocard.png',
  '/subwaysign.jpg',
  '/subway-arrow-down.png',
  '/mta-logo.jpg',
  '/contactless-tap.png',
]

/** Shared wall-page payloads so Photo/Video/About can paint without a second wait. */
const wallCache = {
  photo: { status: 'idle', data: null, detail: '' },
  video: { status: 'idle', data: null, detail: '' },
  about: { status: 'idle', data: null, detail: '' },
}

let preloadPromise = null

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(src)
      return
    }
    const img = new Image()
    img.onload = () => resolve(src)
    img.onerror = () => resolve(src)
    img.src = src
  })
}

async function preloadPhotos() {
  try {
    const data = await client.fetch(`*[_type == "photos"][0].images`)
    if (data?.length) {
      wallCache.photo = { status: 'ready', data, detail: '' }
      const urls = data
        .slice(0, 8)
        .map((photo, i) => urlFor(photo).width(i === 0 ? 1200 : 560).url())
        .filter(Boolean)
      await Promise.all(urls.map(loadImage))
      return
    }
    wallCache.photo = { status: 'empty', data: [], detail: '' }
  } catch {
    wallCache.photo = { status: 'error', data: [], detail: '' }
  }
}

async function preloadVideos() {
  try {
    const response = await fetch('/api/videos')
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      wallCache.video = {
        status: 'error',
        data: [],
        detail: data.detail || `Could not load videos (${response.status}).`,
      }
      return
    }
    if (!data.videos?.length) {
      wallCache.video = {
        status: 'empty',
        data: [],
        detail: data.detail || 'No videos to show.',
      }
      return
    }
    wallCache.video = { status: 'ready', data: data.videos, detail: '' }
    const thumbs = data.videos
      .slice(0, 6)
      .map((v) => v.thumbnail || v.thumb || v.poster)
      .filter(Boolean)
    await Promise.all(thumbs.map(loadImage))
  } catch (error) {
    wallCache.video = {
      status: 'error',
      data: [],
      detail: error?.message || 'Could not load videos.',
    }
  }
}

async function preloadAbout() {
  try {
    const data = await client.fetch(`*[_type == "about"][0]{
      title,
      description,
      photo1,
      photo2,
      instagramUrl
    }`)
    if (data) {
      wallCache.about = { status: 'ready', data, detail: '' }
      const urls = [
        data.photo1 ? urlFor(data.photo1).width(1400).url() : '',
        data.photo2 ? urlFor(data.photo2).width(800).url() : '',
      ].filter(Boolean)
      await Promise.all(urls.map(loadImage))
      return
    }
    wallCache.about = { status: 'empty', data: null, detail: '' }
  } catch {
    wallCache.about = { status: 'error', data: null, detail: '' }
  }
}

export function getWallPageCache(id) {
  return wallCache[id] || { status: 'idle', data: null, detail: '' }
}

/** Resolves when preloadStationAssets has finished (or immediately if already done). */
export function whenStationPreloaded() {
  return preloadPromise || Promise.resolve()
}

/** Station textures + wall screen content/images. Boot waits on this. */
export function preloadStationAssets() {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      ...STATION_ASSETS.map(loadImage),
      preloadPhotos(),
      preloadVideos(),
      preloadAbout(),
    ])
  }
  return preloadPromise
}
