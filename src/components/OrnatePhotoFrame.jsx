import styled from 'styled-components'
import PropTypes from 'prop-types'

/**
 * Your carved gold frame, punched transparent in the opening,
 * stretched so the opening matches the photo aspect.
 *
 * Insets / opening fractions measured from the source asset.
 */
const OPEN_W = 0.5615
const OPEN_H = 0.6268
const FRAME_INSET = {
  left: '22.69%',
  right: '21.15%',
  top: '23.24%',
  bottom: '14.08%',
}

const Shell = styled.button`
  position: relative;
  display: block;
  /* Outer box aspect so the *opening* equals the photo ratio. */
  width: min(
    92vw,
    560px,
    calc(58vh * ${(p) => p.$frameAspect})
  );
  aspect-ratio: ${(p) => p.$frameAspect};
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 16px 36px rgba(0, 0, 0, 0.55));
  transition: width 0.7s ease, aspect-ratio 0.7s ease;

  &:focus-visible {
    outline: 2px solid #c4a06a;
    outline-offset: 6px;
  }
`

const Well = styled.div`
  position: absolute;
  left: ${FRAME_INSET.left};
  right: ${FRAME_INSET.right};
  top: ${FRAME_INSET.top};
  bottom: ${FRAME_INSET.bottom};
  background: #0a0806;
  overflow: hidden;
`

const FrameArt = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill; /* stretch with aspect — ornaments warp with the frame */
  pointer-events: none;
  z-index: 3;
  user-select: none;
`

const Caption = styled.div`
  position: absolute;
  left: 50%;
  bottom: 2.2%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 3px 12px 4px;
  background: linear-gradient(180deg, #3a2a18, #1a120c);
  border: 1px solid rgba(196, 160, 106, 0.55);
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #e8d2a8;
  white-space: nowrap;
  pointer-events: none;
`

export default function OrnatePhotoFrame({
  aspect = 4 / 3,
  caption = '',
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  'aria-label': ariaLabel,
}) {
  const photoAspect = Number.isFinite(aspect) && aspect > 0.2 && aspect < 5 ? aspect : 4 / 3
  // Stretch the whole PNG so its opening matches this photo ratio.
  const frameAspect = photoAspect * (OPEN_H / OPEN_W)

  return (
    <Shell
      type="button"
      $frameAspect={frameAspect}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={ariaLabel}
    >
      <Well>{children}</Well>
      <FrameArt src="/photo-frame.png" alt="" draggable={false} />
      {caption ? <Caption>{caption}</Caption> : null}
    </Shell>
  )
}

OrnatePhotoFrame.propTypes = {
  aspect: PropTypes.number,
  caption: PropTypes.string,
  children: PropTypes.node,
  onClick: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  'aria-label': PropTypes.string,
}
