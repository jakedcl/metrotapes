import { css } from 'styled-components'

/** Matte glass: blurs the station so line colors stay readable behind content. */
export const frostedPanel = css`
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  backdrop-filter: blur(16px) saturate(1.2);
  background: rgba(12, 12, 12, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.08);
`

export const frostedPanelShadow = css`
  box-shadow:
    0 18px 40px rgba(0, 0, 0, 0.38),
    0 6px 16px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
`
