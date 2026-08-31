import { useState, useEffect } from 'react'
import styled from 'styled-components'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faVideo, faBook, faBars } from '@fortawesome/free-solid-svg-icons'
import { route, station, cushy } from '../styles/theme'
import PropTypes from 'prop-types'

const HeaderContainer = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background: ${station};
  z-index: 100;
`

const HeaderContent = styled.div`
  padding: 0.75rem 1rem;
  position: relative;

  @media (min-width: 768px) {
    padding: 0.75rem 1rem 0.75rem 1rem;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
`

const TopSection = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  padding-bottom: 4px;
`

const TitleWrapper = styled.button`
  ${cushy}
  background: none;
  border: none;
  padding: 0;
  display: inline-block;
  transform-origin: left center;
`

const Title = styled.div`
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
  line-height: 1;
`

const ResetButton = styled.button`
  ${cushy}
  width: 48px;
  height: 48px;
  background: none;
  border: none;
  padding: 0;
  position: relative;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));

  @media (min-width: 768px) {
    width: 52px;
    height: 52px;
  }

  @media (max-width: 767px) {
    width: 42px;
    height: 42px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    display: block;
  }
`

const RightCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
`

const NavList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  max-height: ${props => props.$isOpen ? '300px' : '0'};
  opacity: ${props => props.$isOpen ? 1 : 0};
  transition: all 0.3s ease;
  padding: 0;
  margin: ${props => props.$isOpen ? '1rem 0 .5rem' : '0'};

  @media (min-width: 768px) {
    flex-direction: row;
    gap: 1rem;
    max-height: none;
    opacity: 1;
    overflow: visible;
    padding: 0;
    margin: 0;
  }
`

const NavItem = styled(NavLink)`
  ${cushy}
  display: flex;
  align-items: center;
  text-decoration: none;
  height: 32px;
  position: relative;
  overflow: hidden;

  @media (min-width: 768px) {
    height: 38px;
  }
`

const Circle = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: bold;
  font-size: 0.9rem;
  background-color: ${props => props.color};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  flex-shrink: 0;

  svg {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
  }

  @media (max-width: 767px) {
    width: 120px;
    padding: 0 1.5rem 0 1rem;
    justify-content: flex-start;
  }

  @media (min-width: 768px) {
    width: 38px;
    height: 38px;
    border-radius: 19px;
    font-size: 1.1rem;

    ${NavItem}:hover &, ${NavItem}.active & {
      width: 120px;
      padding: 0 1.5rem 0 1rem;
      justify-content: flex-start;
    }
  }
`

const NavText = styled.span`
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.1rem;
  font-weight: 500;
  opacity: 0;
  position: absolute;
  left: 44px;
  pointer-events: none;
  transition: opacity 0.2s ease;

  @media (max-width: 767px) {
    opacity: 1;
  }

  @media (min-width: 768px) {
    left: 50px;
    opacity: 0;
    font-size: 1.2rem;
    
    ${NavItem}:hover &, ${NavItem}.active & {
      opacity: 1;
    }
  }
`

const MenuButton = styled.button`
  ${cushy}
  display: none;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  padding: 8px;
  margin-right: 12px;
  transition: transform 0.2s ease, color 0.2s ease;

  &:hover {
    color: white;
  }

  @media (max-width: 767px) {
    display: block;
  }
`

const TitleGroup = styled.div`
  display: flex;
  align-items: left;
`

const TitleSection = styled.div`
  display: flex;
  align-items: center;
`

export default function Header({ onShowLanding }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const navigate = useNavigate()
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        setIsOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleTitleClick = (e) => {
    e.preventDefault()
    if (isHomePage) {
      onShowLanding?.()
      return
    }
    navigate('/')
  }

  const handleMenuToggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleNavClick = () => {
    if (isMobile) {
      setIsOpen(false)
    }
  }

  const handleReset = () => {
    navigate('/')
    window.location.reload()
  }

  const renderNavItems = () => (
    <>
      <NavItem to="/photo" onClick={handleNavClick}>
        <Circle color={route.photo}>
          <FontAwesomeIcon icon={faCamera} />
        </Circle>
        <NavText>photo</NavText>
      </NavItem>
      <NavItem to="/video" onClick={handleNavClick}>
        <Circle color={route.video}>
          <FontAwesomeIcon icon={faVideo} />
        </Circle>
        <NavText>video</NavText>
      </NavItem>
      <NavItem to="/about" onClick={handleNavClick}>
        <Circle color={route.about}>
          <FontAwesomeIcon icon={faBook} />
        </Circle>
        <NavText>about</NavText>
      </NavItem>
    </>
  )

  return (
    <HeaderContainer>
      <HeaderContent>
        <TopSection>
          <TitleSection>
            {isMobile && (
              <MenuButton onClick={handleMenuToggle} aria-label="Open menu">
                <FontAwesomeIcon icon={faBars} size="lg" />
              </MenuButton>
            )}
            <TitleWrapper type="button" onClick={handleTitleClick} aria-label={isHomePage ? 'Back to entrance' : 'Home'}>
              <TitleGroup>
                <Title>metrotapes</Title>
              </TitleGroup>
            </TitleWrapper>
          </TitleSection>
          <RightCluster>
            {!isMobile && (
              <NavList $isOpen={isOpen}>
                {renderNavItems()}
              </NavList>
            )}
            <ResetButton type="button" onClick={handleReset} aria-label="Reset to entrance">
              <img src="/lamp.png" alt="" />
            </ResetButton>
          </RightCluster>
        </TopSection>
        {isMobile && (
          <NavList $isOpen={isOpen}>
            {renderNavItems()}
          </NavList>
        )}
      </HeaderContent>
    </HeaderContainer>
  )
}

Header.propTypes = {
  onShowLanding: PropTypes.func,
} 