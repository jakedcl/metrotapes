import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { font, route } from '../styles/theme'

const Page = styled.article`
  max-width: 36rem;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 4rem;
  color: #fff;
  font-family: ${font};
`

const Title = styled.h1`
  margin: 0 0 0.75rem;
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.02em;
`

const Lead = styled.p`
  margin: 0 0 0.75rem;
  line-height: 1.45;
  font-size: 1.05rem;
`

const Note = styled.p`
  margin: 0 0 1.5rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.92rem;
  line-height: 1.4;
`

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const Item = styled(Link)`
  display: flex;
  align-items: center;
  min-height: 48px;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
`

const Bullet = styled.span`
  width: 14px;
  height: 14px;
  margin-right: 0.75rem;
  border-radius: 50%;
  background: ${(p) => p.$color};
  flex: 0 0 auto;
`

/** 2D way in when the station canvas cannot run. */
export default function FlatHome() {
  return (
    <Page>
      <Title>metrotapes</Title>
      <Lead>
        Photography and video by Ronnie Foreman in the New York metropolitan area.
        Skate, snow, and other visual work.
      </Lead>
      <Note>The station view needs WebGL, which is not available right now.</Note>
      <Nav aria-label="Site">
        <Item to="/photo"><Bullet $color={route.photo} />Photo</Item>
        <Item to="/video"><Bullet $color={route.video} />Video</Item>
        <Item to="/about"><Bullet $color={route.about} />About</Item>
      </Nav>
    </Page>
  )
}
