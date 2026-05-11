import { css } from 'styled-components'

/** Matte glass: blurs SubwayBubbles lightly so line colors/shapes stay readable */
export const frostedPanel = css`
  -webkit-backdrop-filter: blur(12px) saturate(1.15);
  backdrop-filter: blur(12px) saturate(1.15);
  background: rgba(26, 26, 26, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.06);
`

export const frostedPanelShadow = css`
  box-shadow:
    0 8px 28px rgba(0, 0, 0, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 2px 6px rgba(0, 0, 0, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
`
