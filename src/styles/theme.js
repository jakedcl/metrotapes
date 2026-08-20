/**
 * One source of truth for the station.
 *
 * Concept: the site is an NYC subway station at night.
 * Colors are real MTA line colors. Type is Helvetica.
 * Motion is physical (weight, friction) not decorative bounce.
 */
export const theme = {
  font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  color: {
    ink: '#0C0C0C',
    station: '#141414',
    white: '#F6F6F2',
    mute: 'rgba(246, 246, 242, 0.72)',
    yellow: '#FCCC0A',
    orange: '#FF6319',
    blue: '#0039A6',
    green: '#00933C',
    brown: '#996633',
    red: '#EE352E',
    purple: '#B933AD',
    lime: '#6CBE45',
    silver: '#A7A9AC',
  },
  route: {
    photo: { color: '#0039A6', letter: 'A' },
    video: { color: '#00933C', letter: '4' },
    about: { color: '#996633', letter: 'J' },
  },
  z: {
    atmosphere: 0,
    content: 1,
    header: 100,
    grain: 160,
    landing: 200,
    modal: 1000,
  },
}
