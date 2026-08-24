import { css } from 'styled-components'

/**
 * What already exists — not a new look.
 *
 * Layers, back → front:
 *   SubwayBubbles (z 0) → page content → header (z 100) → landing swipe (z 200)
 *
 * Route colors are the ones already on the machine buttons and header pills.
 * Line bullets in SubwayBubbles are the full MTA map; they stay in that file.
 */
export const station = '#1A1A1A'

export const route = {
  photo: '#0039A6',
  video: '#00933C',
  about: '#996633',
}

export const font = '"Helvetica Neue", Helvetica, Arial, sans-serif'

/**
 * Same press as the metrotapes home title:
 * a little bigger on hover, back to normal on click.
 */
export const cushy = css`
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(1);
  }
`
