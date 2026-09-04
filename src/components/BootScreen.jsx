import styled, { keyframes } from 'styled-components'
import { font, station } from '../styles/theme'

const pulse = keyframes`
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
`

const Root = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  background: ${station};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.1rem;
`

const Word = styled.div`
  font-family: ${font};
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #fff;
`

const Bar = styled.div`
  width: 140px;
  height: 2px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
`

const Fill = styled.div`
  width: 40%;
  height: 100%;
  background: #fccc0a;
  animation: ${pulse} 1.1s ease-in-out infinite;
`

const Hint = styled.div`
  font-family: ${font};
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
`

export default function BootScreen() {
  return (
    <Root>
      <Word>Metrotapes</Word>
      <Bar>
        <Fill />
      </Bar>
      <Hint>Hold on — station’s coming up</Hint>
    </Root>
  )
}
