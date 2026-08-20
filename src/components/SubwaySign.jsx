import styled from 'styled-components'

const SignContainer = styled.div`
  background-color: #000;
  background-image: 
    linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(0, 0, 0, 0.2) 100%
    ),
    url('/subwaysign.jpg');
  background-repeat: repeat;
  background-position: center;
  background-size: 100%;
  padding: 0;
  width: 100%;
  max-width: 700px;
  height: 100%;
  border-radius: 15px 0 0 15px;
  margin-top: 2rem;
  position: relative;
  isolation: isolate;
  transform: perspective(1000px) rotateY(-2deg);
  transform-origin: right center;

  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.2),
    0 12px 16px rgba(0, 0, 0, 0.2),
    0 24px 32px rgba(0, 0, 0, 0.15),
    inset 0 2px 4px rgba(255, 255, 255, 0.1),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.7) 0%,
      rgba(0, 0, 0, 0.5) 40%,
      rgba(0, 0, 0, 0.4) 100%
    );
    border-radius: 15px 0 0 15px;
    z-index: -1;
  }

  @media (min-width: 768px) {
    max-width: 900px;
  }
`

const ContentWrapper = styled.div`
  padding: 1.2rem 1.5rem 2rem 1.2rem;

  @media (min-width: 768px) {
    padding: 1.5rem 2.5rem 2.5rem;
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
    rgba(255, 255, 255, 0.9) 100%
  );
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 -1px 2px rgba(0, 0, 0, 0.1);
`

const StationText = styled.h1`
  position: relative;
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 2.2rem;
  font-weight: 700;
  width: 100%;
  margin-top: .6rem;
  margin-bottom: .75rem;
  letter-spacing: -0.02em;
  text-shadow: 
    2px 2px 4px rgba(0, 0, 0, 0.3),
    0 0 20px rgba(255, 255, 255, 0.1);

  @media (min-width: 768px) {
    font-size: 4.5rem;
    margin-top: .5rem;
    margin-bottom: .75rem;
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
  font-weight: bold;
  font-size: 1.3rem;
  background-color: ${props => props.color};
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2),
    inset 0 2px 4px rgba(255, 255, 255, 0.2);
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);

  @media (min-width: 768px) {
    width: 52px;
    height: 52px;
    font-size: 1.8rem;
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