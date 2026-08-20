import styled, { keyframes } from 'styled-components'
import PropTypes from 'prop-types'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'
import { theme } from '../styles/theme'

const Panel = styled.div`
  ${frostedPanel}
  ${frostedPanelShadow}
  border-radius: 12px;
  padding: 1.75rem 1.5rem;
  max-width: 28rem;
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.88);
  font-family: ${theme.font};
  letter-spacing: -0.02em;
  line-height: 1.5;
`

const pulse = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
`

const Pulse = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 0.6rem;
  border-radius: 50%;
  background: ${theme.color.yellow};
  animation: ${pulse} 1.4s ease-in-out infinite;
  vertical-align: middle;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export default function StatusPanel({ children, pulsing }) {
  return (
    <Panel>
      {pulsing ? <Pulse aria-hidden="true" /> : null}
      {children}
    </Panel>
  )
}

StatusPanel.propTypes = {
  children: PropTypes.node.isRequired,
  pulsing: PropTypes.bool,
}
