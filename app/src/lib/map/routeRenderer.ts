import type { Feature, FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { cumulativeDistancesM, type LonLat, pointAlong } from '../geo'
import type { RideOption, RouteSegment } from '../routing/ride'
import { type BadgeSite, placeBadges } from './badgePlacement'
import { BADGE_FADE_MS, EMPTY, ROUTE_DIMMED_OPACITY, ROUTE_GHOST, ROUTE_MOVING, ROUTE_POINTS, ROUTE_STABLE } from './layers'
import { routeDiff, routeLine, sliceSegments } from './routeDiff'

const DRAW_ON_MS = 1100
const STEP_MS = 250

interface Measured {
  segment: RouteSegment
  cumulative: number[]
  /** Distance along the whole shown stretch where this segment starts. */
  offset: number
}

interface Shown {
  ride: RideOption
  planKey: number
}

/**
 * Draws the ride on the map. A new plan draws on from A to B; moving the slider within a plan only redraws the stretch
 * that changed, with the old one left as a faint ghost until the new one has drawn. A new call completes the animation
 * that is running first.
 */
export class RouteRenderer {
  private frame = 0
  private shown: Shown | null = null
  private finishRunning: (() => void) | undefined
  private pins: LonLat[] = []
  /** Sources this renderer last emptied: emptying one again would still re-tile it and redraw the map. */
  private emptied = new Set<string>()

  constructor(private readonly map: MapLibreMap) {
    // Badges are placed for the zoom the map has, so they are placed again when it settles on another.
    map.on('moveend', () => this.replaceBadges())
  }

  /**
   * `from` and `to` are where the A and B pins stand, `stops` the rider's stops between them; badges keep clear of all
   * of them. Rides of the same `planKey` come from the same plan result, so a different ride among them is a step of the
   * slider. An `instant` step swaps the ride in one upload: a finger scrubbing the slider passes several in a second, and
   * a reveal for each kept the whole map redrawing on every frame.
   */
  show(ride: RideOption | null, from: LonLat | null, to: LonLat | null, planKey: number, stops: LonLat[] = [], instant = false): void {
    this.finishRunning?.()
    const previous = this.shown
    this.shown = ride && { ride, planKey }
    this.pins = [from, ...stops, to].flatMap((pin) => (pin ? [pin] : []))
    if (!ride) {
      this.upload({ stable: EMPTY, moving: EMPTY, ghost: EMPTY, points: EMPTY })
      return
    }
    if (previous?.planKey !== planKey) this.drawOn(ride)
    else if (previous.ride === ride) this.replaceBadges()
    else if (instant) this.swap(ride)
    else this.step(previous.ride, ride)
  }

  private replaceBadges(): void {
    if (this.finishRunning || !this.shown) return
    this.upload({ points: collection(this.placedBadges(measure(this.shown.ride.segments)).map((badge) => badge.feature)) })
  }

  private drawOn(ride: RideOption): void {
    const measured = measure(ride.segments)
    const allBadges = this.placedBadges(measured)
    this.upload({ stable: EMPTY, ghost: EMPTY })
    this.animate(DRAW_ON_MS, (reveal) => {
      this.upload({
        moving: collection(revealed(measured, reveal)),
        points: collection(allBadges.filter((badge) => badge.at <= reveal * total(measured)).map((badge) => badge.feature)),
      })
    }, () => this.replaceBadges())
  }

  private swap(ride: RideOption): void {
    this.upload({
      stable: collection(ride.segments.map(segmentFeature)),
      moving: EMPTY,
      ghost: EMPTY,
      points: collection(this.placedBadges(measure(ride.segments)).map((badge) => badge.feature)),
    })
  }

  private step(old: RideOption, next: RideOption): void {
    const oldLine = routeLine(old.segments)
    const newLine = routeLine(next.segments)
    const diff = routeDiff(oldLine, newLine)
    // The stretch starts and ends on a point both rides share, so it joins the untouched parts without a gap.
    const splitAt = Math.max(0, diff.prefixEnd - 1)
    const stable = [...sliceSegments(next.segments, 0, splitAt), ...sliceSegments(next.segments, diff.newSuffixStart, newLine.length - 1)]
    const moving = measure(sliceSegments(next.segments, splitAt, diff.newSuffixStart))
    const allBadges = this.placedBadges(measure(next.segments)).map((badge) => badge.feature)
    this.setBadgeFade(false)
    this.upload({
      stable: collection(stable.map(segmentFeature)),
      ghost: collection(sliceSegments(old.segments, splitAt, diff.oldSuffixStart).map(segmentFeature)),
      moving: EMPTY,
      points: EMPTY,
    })
    this.animate(
      STEP_MS,
      (reveal) => this.upload({ moving: collection(revealed(moving, reveal)) }),
      () => {
        this.upload({ ghost: EMPTY })
        this.setBadgeFade(true)
        this.upload({ points: collection(allBadges) })
      },
    )
  }

  /** Calls `draw` with how much of the stretch shows, 0 to 1, on every frame; `done` runs once after the last. */
  private animate(durationMs: number, draw: (reveal: number) => void, done?: () => void): void {
    const started = performance.now()
    const finish = () => {
      cancelAnimationFrame(this.frame)
      this.finishRunning = undefined
      draw(1)
      done?.()
    }
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs)
      if (progress >= 1) return finish()
      draw(easeOutCubic(progress))
      this.frame = requestAnimationFrame(tick)
    }
    this.finishRunning = finish
    this.frame = requestAnimationFrame(tick)
  }

  /** A plan that failed leaves the last ride's badges faded with its line: they are not the trip asked for. */
  dimBadges(dimmed: boolean): void {
    for (const property of ['icon-opacity', 'text-opacity'] as const) this.map.setPaintProperty('route-badges', property, dimmed ? ROUTE_DIMMED_OPACITY : 1)
  }

  /** Badges that arrive after a step fade in; the ones of a fresh draw appear as the line reaches them. */
  private setBadgeFade(visible: boolean): void {
    for (const property of ['icon-opacity', 'text-opacity'] as const) {
      // The typings do not list the transition twin of a paint property.
      this.map.setPaintProperty('route-badges', `${property}-transition` as never, { duration: visible ? BADGE_FADE_MS : 0 } as never)
      this.map.setPaintProperty('route-badges', property, visible ? 1 : 0)
    }
  }

  /** One badge for each twisty, numbered in riding order; `at` is the distance at which the drawing line reaches it. */
  private placedBadges(measured: Measured[]): { at: number; feature: Feature }[] {
    const twisties = measured.filter(({ segment }) => segment.kind === 'twisty')
    const sites: BadgeSite[] = twisties.map(({ segment, cumulative }) => ({
      line: segment.line,
      cumulative,
      priority: -(cumulative[cumulative.length - 1] * (segment.rating ?? 1)),
    }))
    const placements = placeBadges(sites, (point) => this.map.project(point), this.pins.map((pin) => this.map.project(pin)))
    return twisties.map(({ segment, offset }, i) => ({
      at: offset + placements[i].alongM,
      feature: pointFeature(placements[i].at, {
        index: i + 1,
        rating: segment.rating,
        scale: placements[i].scale,
        priority: sites[i].priority,
      }),
    }))
  }

  private upload(data: { stable?: FeatureCollection; moving?: FeatureCollection; ghost?: FeatureCollection; points?: FeatureCollection }): void {
    const sources = { [ROUTE_STABLE]: data.stable, [ROUTE_MOVING]: data.moving, [ROUTE_GHOST]: data.ghost, [ROUTE_POINTS]: data.points }
    for (const [id, collection] of Object.entries(sources)) {
      if (!collection) continue
      const empty = collection.features.length === 0
      if (empty && this.emptied.has(id)) continue
      if (empty) this.emptied.add(id)
      else this.emptied.delete(id)
      ;(this.map.getSource(id) as GeoJSONSource | undefined)?.setData(collection)
    }
  }
}

function measure(segments: RouteSegment[]): Measured[] {
  let offset = 0
  return segments.map((segment) => {
    const cumulative = cumulativeDistancesM(segment.line)
    const measured = { segment, cumulative, offset }
    offset += cumulative[cumulative.length - 1]
    return measured
  })
}

const total = (measured: Measured[]) => {
  const last = measured[measured.length - 1]
  return last ? last.offset + last.cumulative[last.cumulative.length - 1] : 0
}

/** The stretch drawn up to `share` (0 to 1) of its length. */
function revealed(measured: Measured[], share: number): Feature[] {
  const reveal = total(measured) * share
  return measured.flatMap(({ segment, cumulative, offset }) => {
    const visible = reveal - offset
    if (visible <= 0) return []
    const length = cumulative[cumulative.length - 1]
    return [segmentFeature(visible >= length ? segment : { ...segment, line: truncate(segment.line, cumulative, visible) })]
  })
}

function truncate(line: LonLat[], cumulative: number[], distanceM: number): LonLat[] {
  const end = cumulative.findIndex((d) => d >= distanceM)
  return [...line.slice(0, end), pointAlong(line, distanceM, cumulative)]
}

const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features })

function segmentFeature(segment: RouteSegment): Feature {
  return lineFeature(segment.line, { kind: segment.kind, rating: segment.rating })
}

function lineFeature(coordinates: LonLat[], properties: Record<string, unknown>): Feature {
  return { type: 'Feature', properties, geometry: { type: 'LineString', coordinates } }
}

function pointFeature(coordinates: LonLat, properties: Record<string, unknown>): Feature {
  return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [coordinates[0], coordinates[1]] } }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}
