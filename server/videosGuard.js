/**
 * Best-effort guard for GET /api/videos.
 * The playlist id comes from Sanity, not the query string, so the request
 * has nothing to validate except method, size, and how often it is called.
 * The counter lives in module memory: one warm serverless instance shares
 * it, a cold start does not. That is enough to blunt a hot loop without
 * a store, and a normal page load (one or two fetches) stays under it.
 */

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 40
const buckets = new Map()

export function resetVideosGuard() {
  buckets.clear()
}

function clientIp(req) {
  const headers = req?.headers || {}
  const fwd = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim().slice(0, 80)
  if (typeof headers['x-real-ip'] === 'string' && headers['x-real-ip'].trim()) {
    return headers['x-real-ip'].trim().slice(0, 80)
  }
  return req?.socket?.remoteAddress || 'local'
}

function prune(now) {
  if (buckets.size < 200) return
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > WINDOW_MS) buckets.delete(key)
  }
}

/**
 * @param {{ method?: string, url?: string, headers?: object, socket?: object }} req
 * @returns {{ ok: true } | { ok: false, status: number, body: { detail: string } }}
 */
export function allowVideosRequest(req) {
  const method = req?.method || 'GET'
  if (method !== 'GET') {
    return { ok: false, status: 405, body: { detail: 'Method not allowed' } }
  }

  const url = typeof req?.url === 'string' ? req.url : ''
  if (url.length > 512) {
    return { ok: false, status: 400, body: { detail: 'Bad request' } }
  }

  const now = Date.now()
  const ip = clientIp(req)
  let bucket = buckets.get(ip)
  if (!bucket || now - bucket.start > WINDOW_MS) {
    bucket = { start: now, count: 0 }
    buckets.set(ip, bucket)
  }
  bucket.count += 1
  prune(now)

  if (bucket.count > MAX_PER_WINDOW) {
    return { ok: false, status: 429, body: { detail: 'Too many requests' } }
  }
  return { ok: true }
}
