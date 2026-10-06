import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

// Public read-only client: projectId + dataset are not secret (they appear in browser requests).
// Use env for staging/prod split; fallbacks keep local/stock config working without .env.
// Do not put a write-capable Sanity token in VITE_* — it would ship in the JS bundle.
const env = import.meta.env ?? {}
const projectId = env.VITE_SANITY_PROJECT_ID || 'l3itmzli'
const dataset = env.VITE_SANITY_DATASET || 'production'

const config = {
  projectId,
  dataset,
  apiVersion: '2024-01-30',
  useCdn: true, // Enable CDN caching for better performance
  perspective: 'published'
}

// Create a client for fetching data (read-only)
export const client = createClient(config)

// Create an image URL builder
const builder = imageUrlBuilder(client)

// Helper function to build image URLs
export const urlFor = (source) => {
  if (!source?.asset) return ''
  return builder.image(source)
}

/** Keep asset._ref so urlFor still works, and read alt when the studio has one. */
export const PHOTOS_QUERY = `*[_type == "photos"][0].images[]{
  ...,
  "alt": coalesce(alt, asset->altText),
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height
}`

export const ABOUT_QUERY = `*[_type == "about"][0]{
  title,
  description,
  instagramUrl,
  photo1{..., "alt": coalesce(alt, asset->altText), "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height},
  photo2{..., "alt": coalesce(alt, asset->altText), "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height}
}`

export function imageAlt(image, fallback) {
  const alt = image?.alt || image?.altText || image?.asset?.altText
  if (typeof alt === 'string' && alt.trim()) return alt.trim()
  return fallback
} 