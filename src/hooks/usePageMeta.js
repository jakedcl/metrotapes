import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export const SITE_URL = 'https://metrotapes.com'

const DEFAULT_DESCRIPTION =
  'Photography and video by Ronnie Foreman in the New York metropolitan area.'

const pages = {
  '/': {
    title: 'metrotapes',
    description: DEFAULT_DESCRIPTION,
  },
  '/photo': {
    title: 'photo · metrotapes',
    description: 'Photographs by Ronnie Foreman / metrotapes.',
  },
  '/video': {
    title: 'video · metrotapes',
    description: 'Films and video by Ronnie Foreman / metrotapes.',
  },
  '/about': {
    title: 'about · metrotapes',
    description:
      'Ronnie Foreman is a videographer in the New York metropolitan area. Skate, snow, and other visual work.',
  },
  '/blog': {
    title: 'metrotapes',
    description: DEFAULT_DESCRIPTION,
    robots: 'noindex, nofollow',
  },
}

function setMeta(selector, attribute, value) {
  const el = document.querySelector(selector)
  if (el) el.setAttribute(attribute, value)
}

export default function usePageMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = pages[pathname] || pages['/']
    const url = `${SITE_URL}${pathname === '/' ? '/' : pathname}`

    document.title = page.title
    setMeta('meta[name="description"]', 'content', page.description)
    setMeta('meta[name="robots"]', 'content', page.robots || 'index, follow')
    setMeta('meta[property="og:title"]', 'content', page.title)
    setMeta('meta[property="og:description"]', 'content', page.description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[name="twitter:title"]', 'content', page.title)
    setMeta('meta[name="twitter:description"]', 'content', page.description)
    setMeta('link[rel="canonical"]', 'href', url)
  }, [pathname])
}
