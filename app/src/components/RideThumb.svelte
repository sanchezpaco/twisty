<script lang="ts">
  import type { LonLat } from '../lib/geo'
  import { RATING_COLORS } from '../lib/map/theme'
  import { decodeLine } from '../lib/polyline'
  import type { SavedRide } from '../lib/savedRide'

  interface Props {
    ride: SavedRide
  }

  let { ride }: Props = $props()

  const SIZE = 44
  const INSET = 4
  /** Points per stretch at most: a thumbnail needs the shape, not every bend. */
  const MAX_POINTS = 40

  /** The ride's stretches as SVG paths in a square, north up, the twisties in their rating's colour. */
  const paths = $derived.by(() => {
    const parts = ride.ride.segments.map((segment) => ({ segment, line: thin(decodeLine(segment.line)) }))
    const points = parts.flatMap((part) => part.line)
    if (points.length === 0) return []
    const lons = points.map(([lon]) => lon)
    const lats = points.map(([, lat]) => lat)
    const [west, east, south, north] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)]
    // A degree of longitude is shorter than one of latitude away from the equator.
    const squash = Math.cos((((south + north) / 2) * Math.PI) / 180)
    const span = Math.max((east - west) * squash, north - south, 1e-6)
    const scale = (SIZE - 2 * INSET) / span
    const offsetX = (SIZE - (east - west) * squash * scale) / 2
    const offsetY = (SIZE - (north - south) * scale) / 2
    const at = ([lon, lat]: LonLat) => `${(offsetX + (lon - west) * squash * scale).toFixed(1)} ${(offsetY + (north - lat) * scale).toFixed(1)}`
    return [...parts].sort((a, b) => Number(a.segment.kind === 'twisty') - Number(b.segment.kind === 'twisty')).map(({ segment, line }) => ({
      d: `M${line.map(at).join('L')}`,
      color: segment.kind === 'twisty' && segment.rating ? RATING_COLORS[segment.rating - 1] : null,
    }))
  })

  function thin(line: LonLat[]): LonLat[] {
    if (line.length <= MAX_POINTS) return line
    const step = (line.length - 1) / (MAX_POINTS - 1)
    return Array.from({ length: MAX_POINTS }, (_, i) => line[Math.round(i * step)])
  }
</script>

<svg class="thumb" viewBox="0 0 {SIZE} {SIZE}" width={SIZE} height={SIZE} aria-hidden="true">
  {#each paths as path, index (index)}
    <path d={path.d} stroke={path.color ?? 'currentColor'} class:twisty={path.color !== null} />
  {/each}
</svg>

<style>
  .thumb {
    flex: none;
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--text-muted);
    fill: none;
    stroke-width: 2.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .twisty {
    stroke-width: 3.25;
  }
</style>
