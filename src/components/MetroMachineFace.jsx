/**
 * Flat CSS MetroCard-machine face for the kiosk screen middle.
 * Aesthetic only — lightweight digital MVM panel (not Three.js, not nav).
 *
 * Layout: 3 columns inside the steel bezel
 *   LEFT   — Green (coins/bills) → Red (change) → Blue (credit)
 *   CENTER — Full-height yellow “machine removed” LCD + AUDIO
 *   RIGHT  — Payphone (visual) + phone keypad
 */
import styled, { keyframes } from 'styled-components'
import { font } from '../styles/theme'
import LineBounceField from './LineBounceField'

const C = {
  steelHi: '#e4e7eb',
  steel: '#c2c6cb',
  steelLo: '#8f949b',
  black: '#121212',
  blue: '#004b91',
  green: '#2a7a32',
  yellow: '#f5c400',
  red: '#c41230',
}

const Face = styled.div`
  position: relative;
  /* Only a tad shorter than before — leave room for GO */
  flex: 1 1 auto;
  min-height: 168px;
  margin: 4px 12px 5px;
  padding: 5px 5px 15px;
  display: grid;
  grid-template-columns: 0.92fr 1.7fr 0.48fr;
  grid-template-rows: 1fr;
  gap: 4px;
  border-radius: 3px;
  background:
    linear-gradient(165deg, ${C.steelHi} 0%, ${C.steel} 42%, ${C.steelLo} 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(0, 0, 0, 0.22);
  font-family: ${font};
  pointer-events: none;
  user-select: none;
`

const Block = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 2px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35),
    0 1px 2px rgba(0, 0, 0, 0.2);
  min-height: 0;
`

/* ——— LEFT: payment stack ——— */
const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
  min-width: 0;
`

const Green = styled(Block)`
  flex: 1.35 1 0;
  background: ${C.green};
  padding: 3px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const Blue = styled(Block)`
  flex: 0.85 1 0;
  background: ${C.blue};
  padding: 2px 3px;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const Red = styled(Block)`
  flex: 0 0 auto;
  height: 36px;
  background: ${C.red};
  display: flex;
  flex-direction: column;
  padding: 2px 4px 3px;
  gap: 2px;
`

const Tag = styled.div`
  flex: 0 0 auto;
  background: ${C.black};
  color: #fff;
  font-size: 6.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 4px;
  line-height: 1.2;
`

const Slot = styled.div`
  background: #0d0d0d;
  border: 1px solid rgba(0, 0, 0, 0.45);
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.55);
`

const bulbPulse = keyframes`
  0%, 100% {
    background: radial-gradient(circle at 35% 35%, #b8ffc4, #1f9a3a 55%, #0a4a18);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.35),
      0 0 3px 1px rgba(61, 204, 90, 0.55);
  }
  50% {
    background: radial-gradient(circle at 35% 35%, #e8ffe8, #3dcc5a 50%, #157a2c);
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.25),
      0 0 7px 2px rgba(61, 204, 90, 0.95);
  }
`

/* Steel dome on green panel (not the phone lamp) */
const Mirror = styled.div`
  position: absolute;
  top: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #f2f4f6, #6a7078 70%, #2a2e32);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
  z-index: 1;
`

const CoinBand = styled.div`
  display: grid;
  grid-template-columns: 12px 1fr;
  gap: 3px;
  align-items: stretch;
  flex: 0.9 1 0;
  min-height: 0;
  overflow: hidden;
  padding-right: 11px;
`

const CoinMouth = styled.div`
  width: 11px;
  height: 100%;
  max-height: 18px;
  align-self: center;
  border-radius: 2px;
  background: linear-gradient(180deg, #d8dce0, #6a7078 55%, #2a2e32);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.25);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 2px;
    right: 2px;
    top: 45%;
    height: 2px;
    background: #0a0a0a;
    border-radius: 1px;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
  }
`

const CoinPanel = styled.div`
  background: ${C.black};
  border-radius: 1px;
  padding: 2px 3px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 0;
  overflow: hidden;
  justify-content: center;
`

const CoinTitle = styled.div`
  font-size: 6px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #fff;
  text-transform: uppercase;
  line-height: 1.1;
`

const CoinGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 4px;
  font-size: 6.5px;
  font-weight: 800;
  color: #fff;
  line-height: 1.15;
`

const BillBand = styled.div`
  flex: 1.15 1 0;
  min-height: 0;
  overflow: hidden;
  background: ${C.black};
  border-radius: 1px;
  padding: 2px 3px;
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-template-rows: auto 1fr;
  gap: 1px 3px;
`

const BillTitle = styled.div`
  grid-column: 1 / -1;
  font-size: 6px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #fff;
  text-transform: uppercase;
  line-height: 1.1;
`

const BillDenoms = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  min-height: 0;
  overflow: hidden;
  font-size: 6px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
`

const BillAcceptor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`

const BillMouth = styled(Slot)`
  flex: 1 1 0;
  min-height: 8px;
  border-radius: 2px;
  background: linear-gradient(180deg, #1a1a1a, #050505);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 10%;
    right: 10%;
    top: 42%;
    height: 2px;
    background: #000;
    border-radius: 1px;
    box-shadow: 0 0 0 1px #333;
  }
`

const BillHint = styled.div`
  flex: 0 0 auto;
  font-size: 3.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  text-align: center;
  line-height: 1.05;
`

const CardRow = styled.div`
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 3px;
  flex: 1;
  min-height: 0;
`

const DipBay = styled.div`
  background: #003a73;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px;
  min-width: 0;
`

const DipSlot = styled(Slot)`
  width: 86%;
  height: 6px;
  border-radius: 1px;
`

const DipLight = styled.div`
  width: 3.5px;
  height: 3.5px;
  border-radius: 50%;
  background: #3dcc5a;
  box-shadow: 0 0 3px #3dcc5a;
`

const TapPad = styled.div`
  background: #d8d4c8;
  border-radius: 2px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  min-width: 0;
`

const TapIcon = styled.img`
  width: 100%;
  max-width: 28px;
  height: auto;
  display: block;
  object-fit: contain;
`

const Tray = styled(Slot)`
  flex: 1;
  min-height: 6px;
  border-radius: 1px;
  background: linear-gradient(180deg, #2a2a2a, #0a0a0a);
`

/* ——— CENTER: yellow hero LCD ——— */
const Screen = styled(Block)`
  background: ${C.black};
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-height: 0;
  min-width: 0;
`

const Lcd = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  background: ${C.yellow};
  color: #111;
  border-radius: 1px;
  padding: 8px 7px 6px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  overflow: hidden;
`

const LcdCopy = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  text-shadow:
    0 0 6px rgba(245, 196, 0, 0.95),
    0 1px 0 rgba(245, 196, 0, 0.8);
`

const LcdEyebrow = styled.div`
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.7;
  line-height: 1.1;
`

const LcdTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-transform: uppercase;
`

const LcdBody = styled.div`
  font-size: 8px;
  font-weight: 600;
  line-height: 1.3;
  opacity: 0.88;
  max-width: 22em;
`

const Audio = styled.div`
  margin-top: 4px;
  flex: 0 0 auto;
  height: 20px;
  background: #0a0a0a;
  border: 1px solid #333;
  color: #eee;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.12em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`

/* ——— RIGHT: payphone + keypad ——— */
const Right = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 0;
  min-width: 0;
`

const Payphone = styled(Block)`
  flex: 1.35 1 0;
  overflow: visible;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 40%),
    linear-gradient(145deg, #c8ccd2, #8a9098 50%, #5e646c);
  padding: 4px 4px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
`

/* Classic wall phone: handset on the left, hanging on the cradle */
const PhoneBody = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 3px;
  align-items: stretch;
`

const HandsetCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  height: 100%;
  padding: 1px 0;
`

/* Classic bone-shaped receiver — CSS only, no filters */
const Handset = styled.div`
  position: relative;
  width: 14px;
  flex: 1 1 auto;
  min-height: 42px;
  max-height: 100%;
  margin: 10px 0;
  border-radius: 7px;
  background:
    linear-gradient(90deg, #0c0d0e 0%, #3a3e44 38%, #5a6068 52%, #2a2e32 78%, #0a0b0c 100%);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.22),
    inset -1px 0 0 rgba(0, 0, 0, 0.55),
    1px 2px 3px rgba(0, 0, 0, 0.4);

  /* Earpiece (top) + mouthpiece (bottom) — wider than the grip */
  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 24px;
    height: 16px;
    border-radius: 8px;
    background:
      linear-gradient(160deg, #6a7078 0%, #3a3e44 40%, #1a1c1e 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.28),
      inset 0 -2px 3px rgba(0, 0, 0, 0.55),
      0 2px 3px rgba(0, 0, 0, 0.35);
  }
  &::before { top: -9px; }
  &::after { bottom: -9px; }
`

const PhoneFace = styled.div`
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  padding: 2px 2px 1px;
  background: linear-gradient(180deg, #9aa0a8, #6a7078);
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
`

const PhoneLamp = styled.div`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  align-self: flex-end;
  margin-right: 1px;
  animation: ${bulbPulse} 1.1s ease-in-out infinite;
`

const CoinRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding-bottom: 2px;
`

const CoinSlot = styled.div`
  width: 5px;
  height: 18px;
  border-radius: 1px;
  background: #0a0a0a;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.85),
    0 0 0 1px rgba(0, 0, 0, 0.25);
  position: relative;

  &::after {
    content: '25¢';
    position: absolute;
    top: -7px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 3.5px;
    font-weight: 800;
    letter-spacing: 0;
    color: rgba(20, 22, 26, 0.75);
    white-space: nowrap;
  }
`

const PhoneLabel = styled.div`
  font-size: 4.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(20, 22, 26, 0.78);
  line-height: 1;
`

const Keypad = styled(Block)`
  flex: 0.72 1 0;
  background: linear-gradient(160deg, #3a3e44, #1c1e22);
  padding: 4px 5px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 2.5px;
  min-height: 0;
`

const Key = styled.div`
  background: linear-gradient(180deg, #5a5e64, #2a2e32);
  border-radius: 1.5px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.45),
    0 1px 1px rgba(0, 0, 0, 0.3);
  color: #e8eaec;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`

const Plate = styled.div`
  position: absolute;
  right: 5px;
  bottom: 2px;
  width: 28px;
  height: 9px;
  background: #d0d3d7;
  border: 1px solid #7a7f86;
  border-radius: 1px;
  font-size: 5px;
  font-weight: 700;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.04em;
  z-index: 2;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.18);
`

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

export default function MetroMachineFace() {
  return (
    <Face aria-hidden="true">
      <Left>
        <Green>
          <Mirror />
          <CoinBand>
            <CoinMouth />
            <CoinPanel>
              <CoinTitle>Coins</CoinTitle>
              <CoinGrid>
                <span>$1</span>
                <span>10¢</span>
                <span>25¢</span>
                <span>5¢</span>
              </CoinGrid>
            </CoinPanel>
          </CoinBand>
          <BillBand>
            <BillTitle>Bills</BillTitle>
            <BillDenoms>
              <span>$50</span>
              <span>$20</span>
              <span>$10</span>
              <span>$5</span>
              <span>$1</span>
            </BillDenoms>
            <BillAcceptor>
              <BillMouth />
              <BillHint>Insert bills face up</BillHint>
            </BillAcceptor>
          </BillBand>
        </Green>

        <Red>
          <Tag>Change &amp; Receipt</Tag>
          <Tray />
        </Red>

        <Blue>
          <Tag>Credit / ATM Card</Tag>
          <CardRow>
            <DipBay>
              <DipSlot />
              <DipLight />
            </DipBay>
            <TapPad>
              <TapIcon src="/contactless-tap.png" alt="" width={28} height={28} />
            </TapPad>
          </CardRow>
        </Blue>
      </Left>

      <Screen>
        <Lcd>
          <LineBounceField size={15} speed={1.05} />
          <LcdCopy>
            <LcdEyebrow>Welcome</LcdEyebrow>
            <LcdTitle>Ronnie Foreman</LcdTitle>
            <LcdBody>
              Photography &amp; video from the New York metropolitan area.
            </LcdBody>
          </LcdCopy>
        </Lcd>
        <Audio>
          <span aria-hidden="true">★</span>
          AUDIO
        </Audio>
      </Screen>

      <Right>
        <Payphone>
          <PhoneBody>
            <HandsetCol>
              <Handset />
            </HandsetCol>
            <PhoneFace>
              <PhoneLamp />
              <PhoneLabel>Pay Phone</PhoneLabel>
              <CoinRow>
                <CoinSlot />
              </CoinRow>
            </PhoneFace>
          </PhoneBody>
        </Payphone>
        <Keypad>
          {KEYS.map((k) => (
            <Key key={k}>{k}</Key>
          ))}
        </Keypad>
      </Right>

      <Plate>0983</Plate>
    </Face>
  )
}
