import type { LonLat } from './geo'

const COORDINATE_DECIMALS = 6

/** A place the rider stops at on the way, written as a GPX waypoint. */
export interface GpxStop {
  label: string
  position: LonLat
}

/**
 * GPX 1.1 track of a ride, for apps that follow a line instead of re-routing it (Wikiloc, OsmAnd, Garmin…), with a
 * waypoint for each of the rider's stops.
 */
export function gpxTrack(name: string, line: LonLat[], stops: GpxStop[] = []): string {
  const points = line
    .filter((point, i) => i === 0 || point[0] !== line[i - 1][0] || point[1] !== line[i - 1][1])
    .map(([lon, lat]) => `<trkpt ${latLon([lon, lat])}/>`)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Twisty" xmlns="http://www.topografix.com/GPX/1/1">',
    `<metadata><name>${escapeXml(name)}</name></metadata>`,
    // GPX 1.1 puts the waypoints before the tracks.
    ...stops.map(({ label, position }) => `<wpt ${latLon(position)}><name>${escapeXml(label)}</name></wpt>`),
    `<trk><name>${escapeXml(name)}</name><trkseg>`,
    ...points,
    '</trkseg></trk>',
    '</gpx>',
    '',
  ].join('\n')
}

/**
 * A file name such as `twisty-valencia-los-santos.gpx`, or `twisty-valencia-los-santos-14min.gpx` for a slider stop that adds
 * 14 minutes: apps that keep imported files ask before replacing one of the same name, which two stops should not do.
 */
export function gpxFileName(from: string, to: string, extraS = 0): string {
  const extraMin = Math.round(extraS / 60)
  return `twisty-${slug(from)}-${slug(to)}${extraMin > 0 ? `-${extraMin}min` : ''}.gpx`
}

function latLon([lon, lat]: LonLat): string {
  return `lat="${lat.toFixed(COORDINATE_DECIMALS)}" lon="${lon.toFixed(COORDINATE_DECIMALS)}"`
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
