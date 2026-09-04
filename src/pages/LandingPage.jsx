import PropTypes from 'prop-types'
import { useEffect } from 'react'

/** Legacy landing unlock — swipe intro removed; unlock immediately. */
export default function LandingPage({ onUnlock }) {
  useEffect(() => {
    onUnlock?.()
  }, [onUnlock])

  return null
}

LandingPage.propTypes = {
  onUnlock: PropTypes.func.isRequired,
}
