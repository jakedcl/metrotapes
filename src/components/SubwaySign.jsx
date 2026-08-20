import styled from 'styled-components'

const flicker = `
  0%, 100% { filter: brightness(1); }
  46% { filter: brightness(1); }
  47% { filter: brightness(0.82); }
  49% { filter: brightness(1.08); }
  51% { filter: brightness(0.94); }
  53% { filter: brightness(1); }
`

const SignContainer = styled.div`
  background-color: #000;
  background-image:
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.07) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(0, 0, 0, 0.28) 100%
    ),
    url('/subwaysign.jpg');
  background-repeat: repeat;
  background-position: center;
  background-size: 100%;
  padding: 0;
  width: 100%;
  max-width: 700px;
  height: 100%;
  border-radius: 16px 0 0 16px;
  margin-top: 1.5rem;
  position: relative;
  isolation: isolate;
  transform: perspective(1200px) rotateY(-3deg);
  transform-origin: right center;
  animation: signFlicker 7s ease-in-out infinite;

  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.25),
    0 16px 28px rgba(0, 0, 0, 0.32),
    0 32px 48px rgba(0, 0, 0, 0.22),
    inset 0 2px 4px rgba(255, 255, 255, 0.12),
    inset 0 -2px 4px rgba(0, 0, 0, 0.28);

  @keyframes signFlicker {
    ${flicker}
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.62) 0%,
      rgba(0, 0, 0, 0.42) 45%,
      rgba(0, 0, 0, 0.32) 100%
    );
    border-radius: 16px 0 0 16px;
    z-index: -1;
  }

  @media (min-width: 768px) {
    max-width: 920px;
    margin-top: 2rem;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const ContentWrapper = styled.div`
  padding: 1.2rem 1.5rem 2rem 1.2rem;

  @media (min-width: 768px) {
    padding: 1.6rem 2.6rem 2.6rem;
  }
`

const WhiteLine = styled.div`
  position: absolute;
  top: 1.2rem;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 1) 0%,
    rgba(255, 255, 255, 0.88) 100%
  );
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 0 18px rgba(255, 255, 255, 0.18);
`

const StationText = styled.h1`
  position: relative;
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 2.35rem;
  font-weight: 700;
  width: 100%;
  margin-top: .55rem;
  margin-bottom: .8rem;
  letter-spacing: -0.04em;
  line-height: 0.92;
  text-shadow:
    2px 2px 4px rgba(0, 0, 0, 0.35),
    0 0 28px rgba(255, 255, 255, 0.12);

  @media (min-width: 768px) {
    font-size: 5rem;
    margin-top: .45rem;
    margin-bottom: .85rem;
  }
`

const SubwayLines = styled.div`
  position: relative;
  display: flex;
  gap: 8px;

  @media (min-width: 768px) {
    gap: 12px;
  }
`

const SubwayLine = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.color === '#FCCC0A' ? '#000' : 'white'};
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 700;
  font-size: 1.3rem;
  letter-spacing: -0.04em;
  background-color: ${props => props.color};
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.25),
    0 0 16px ${props => props.color}55,
    inset 0 -2px 4px rgba(0, 0, 0, 0.22),
    inset 0 2px 4px rgba(255, 255, 255, 0.22);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);

  @media (min-width: 768px) {
    width: 54px;
    height: 54px;
    font-size: 1.85rem;
  }
`

export default function SubwaySign() {
  return (
    <SignContainer>
      <WhiteLine />
      <ContentWrapper>
        <StationText>metrotapes</StationText>
        <SubwayLines>
          <SubwayLine color="#FCCC0A">R</SubwayLine>
          <SubwayLine color="#FF6319">F</SubwayLine>
        </SubwayLines>
      </ContentWrapper>
    </SignContainer>
  )
}
