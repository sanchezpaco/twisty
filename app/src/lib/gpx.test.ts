import { describe, expect, it } from 'vitest'
import { gpxFileName, gpxTrack } from './gpx'

describe('gpxTrack', () => {
  it('writes every point once, latitude first', () => {
    const gpx = gpxTrack('A → B', [
      [-0.5, 39.1],
      [-0.5, 39.1],
      [-0.4, 39.2],
    ])
    expect(gpx.match(/<trkpt /g)).toHaveLength(2)
    expect(gpx).toContain('<trkpt lat="39.100000" lon="-0.500000"/>')
  })

  it('marks each stop with a waypoint, named after its place, before the track', () => {
    const gpx = gpxTrack('València → Teruel', [[-0.37, 39.47], [-1.1, 40.34]], [{ label: 'Chelva & Tuéjar', position: [-0.9989, 39.7488] }])
    expect(gpx).toContain('<wpt lat="39.748800" lon="-0.998900"><name>Chelva &#38; Tuéjar</name></wpt>')
    expect(gpx.indexOf('<wpt ')).toBeLessThan(gpx.indexOf('<trk>'))
    expect(gpxTrack('A → B', [[0, 0]])).not.toContain('<wpt')
  })

  it('escapes the ride name', () => {
    expect(gpxTrack('Fish & <chips>', [[0, 0]])).toContain('<name>Fish &#38; &#60;chips&#62;</name>')
  })
})

describe('gpxFileName', () => {
  it('is safe for any file system', () => {
    expect(gpxFileName('Massalavés', 'Los Santos (Ademuz)')).toBe('twisty-massalaves-los-santos-ademuz.gpx')
  })

  it('tells slider stops apart by the minutes they add, and leaves the fastest ride unmarked', () => {
    expect(gpxFileName('Jaca', 'Benasque', 14 * 60 + 20)).toBe('twisty-jaca-benasque-14min.gpx')
    expect(gpxFileName('Jaca', 'Benasque', 29)).toBe('twisty-jaca-benasque.gpx')
  })
})
