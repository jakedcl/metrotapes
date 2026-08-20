import styled from 'styled-components'
import PropTypes from 'prop-types'
import { theme } from '../styles/theme'

const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 1.5rem;
`

const Bullet = styled.span`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$color};
  color: ${props => props.$color === theme.color.yellow ? '#111' : '#fff'};
  font-family: ${theme.font};
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: -0.04em;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.28),
    inset 0 -2px 4px rgba(0, 0, 0, 0.22),
    inset 0 2px 4px rgba(255, 255, 255, 0.22);
`

const Name = styled.h1`
  margin: 0;
  color: ${theme.color.white};
  font-family: ${theme.font};
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;

  @media (min-width: 768px) {
    font-size: 2.35rem;
  }
`

export default function StationMark({ letter, color, children }) {
  return (
    <Wrap>
      <Bullet $color={color} aria-hidden="true">{letter}</Bullet>
      <Name>{children}</Name>
    </Wrap>
  )
}

StationMark.propTypes = {
  letter: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
}
