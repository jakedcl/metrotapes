import * as THREE from 'three'

const SRC = '/mta-logo.jpg'
let pending = null

function bytesToUrl(buf) {
  const blob = new Blob([buf], { type: 'image/jpeg' })
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      return URL.createObjectURL(blob)
    } catch {
      /* data URL below */
    }
  }
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return `data:image/jpeg;base64,${btoa(binary)}`
}

/**
 * One network read of the MTA plate. The bytes land in THREE.Cache so
 * TextureLoader does not fetch again, and the zap screen uses the blob URL.
 */
export function primeMtaPlate() {
  if (!pending) {
    pending = fetch(SRC)
      .then((res) => {
        if (!res.ok) throw new Error(`mta plate ${res.status}`)
        return res.arrayBuffer()
      })
      .then((buf) => {
        THREE.Cache.enabled = true
        THREE.Cache.add(SRC, buf)
        return { href: SRC, blobUrl: bytesToUrl(buf) }
      })
      .catch((err) => {
        pending = null
        throw err
      })
  }
  return pending
}

export function resetMtaPlateForTests() {
  pending = null
  THREE.Cache.remove(SRC)
}
