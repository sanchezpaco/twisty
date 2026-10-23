import { type LonLat, pointAlong } from '../geo'

/** The badge circle, halo included, as drawn at full size. */
export const BADGE_RADIUS_PX = 13.5
/** Room kept free around each A and B pin: the pin is 30 px wide and pings a little beyond it. */
const RESERVED_RADIUS_PX = 20
const GAP_PX = 2
/** A badge that does not fit is shrunk before it is given up on, and it is never dropped. */
const SCALES = [1, 0.75, 0.6]
/** Where along its twisty a badge may sit, middle first: a badge moves along the road to find room. */
const FRACTIONS = [0.5, 0.35, 0.65, 0.2, 0.8]

export interface BadgeSite {
  line: LonLat[]
  cumulative: number[]
  /** Lower is more important: the longest, twistiest roads are placed first and keep the best spot. */
  priority: number
}

export interface Placement {
  at: LonLat
  /** Share of the full size the badge is drawn at. */
  scale: number
  /** Distance along the twisty where the badge sits. */
  alongM: number
}

interface Disc {
  x: number
  y: number
  radius: number
}

const overlaps = (a: Disc, b: Disc) => Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius + GAP_PX

/**
 * Finds a spot and a size for every badge on screen, so that no badge covers another or an A or B pin. `reserved` are
 * the screen points of the pins. The result is in the order of `sites`.
 */
export function placeBadges(
  sites: BadgeSite[],
  project: (point: LonLat) => { x: number; y: number },
  reserved: { x: number; y: number }[],
): Placement[] {
  const taken: Disc[] = reserved.map((pin) => ({ ...pin, radius: RESERVED_RADIUS_PX }))
  const placements: Placement[] = new Array(sites.length)
  const byPriority = sites.map((site, index) => ({ site, index })).sort((a, b) => a.site.priority - b.site.priority)

  for (const { site, index } of byPriority) {
    const length = site.cumulative[site.cumulative.length - 1]
    const fits = (scale: number, fraction: number) => {
      const alongM = length * fraction
      const at = pointAlong(site.line, alongM, site.cumulative)
      const disc = { ...project(at), radius: BADGE_RADIUS_PX * scale }
      return taken.every((other) => !overlaps(disc, other)) ? { at, scale, alongM, disc } : null
    }
    let found: ReturnType<typeof fits> = null
    for (const scale of SCALES) {
      for (const fraction of FRACTIONS) {
        found ??= fits(scale, fraction)
      }
      if (found) break
    }
    // No room at any size: it still shows, small, where it is least in the way of the pins and the other badges.
    const chosen = found ?? leastInTheWay(site, length, project, taken)
    taken.push(chosen.disc)
    placements[index] = { at: chosen.at, scale: chosen.scale, alongM: chosen.alongM }
  }
  return placements
}

/** Of the badge's possible spots at its smallest size, the one with the most room to the nearest pin or badge. */
function leastInTheWay(site: BadgeSite, length: number, project: (point: LonLat) => { x: number; y: number }, taken: Disc[]) {
  const radius = BADGE_RADIUS_PX * SCALES[SCALES.length - 1]
  const spots = FRACTIONS.map((fraction) => {
    const alongM = length * fraction
    const at = pointAlong(site.line, alongM, site.cumulative)
    const disc = { ...project(at), radius }
    const room = Math.min(Infinity, ...taken.map((other) => Math.hypot(disc.x - other.x, disc.y - other.y) - other.radius - radius))
    return { at, scale: SCALES[SCALES.length - 1], alongM, disc, room }
  })
  return spots.reduce((best, spot) => (spot.room > best.room ? spot : best))
}
