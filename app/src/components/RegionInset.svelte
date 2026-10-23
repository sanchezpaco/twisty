<script lang="ts">
  import canaries from '../assets/inset-canaries.svg'
  import mainland from '../assets/inset-mainland.svg'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import type { Region } from '../lib/map/regions'

  interface Props {
    /** The region the box takes the camera to: the one off screen. */
    region: Region
    shown: boolean
    /** It stands above the sheet and the credit at the map's foot. */
    coveredHeight: number
    footHeight: number
    onpick: (region: Region) => void
  }

  let { region, shown, coveredHeight, footHeight, onpick }: Props = $props()

  const PICTURES: Record<Region, string> = { canaries, mainland }
</script>

<!-- The other region is far off the map's edge, so a box stands in for it, as an inset does on a paper map of Spain. -->
<button
  class="inset"
  class:inset--shown={shown}
  inert={!shown}
  style:--sheet-covered="{coveredHeight}px"
  style:--foot-height="{footHeight}px"
  aria-label={i18n.t.map.showRegion[region]}
  onclick={() => onpick(region)}
>
  <img src={PICTURES[region]} alt="" />
  <span>{i18n.t.map.regions[region]}</span>
</button>

<style>
  .inset {
    position: absolute;
    left: 12px;
    bottom: calc(var(--sheet-covered) + var(--foot-height) + 14px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 88px;
    height: 56px;
    padding: 6px 6px 4px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: var(--map-shadow);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    line-height: 12px;
    white-space: nowrap;
    opacity: 0;
    transition:
      opacity 0.2s,
      bottom 0.3s var(--ease-out);
  }

  .inset--shown {
    opacity: 1;
  }

  img {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
  }

  /* Under the side panel, in the map's free corner, where there is room for a bigger picture. */
  @media (min-width: 700px) {
    .inset {
      left: 16px;
      bottom: 16px;
      width: 120px;
      height: 76px;
      padding: 8px 8px 6px;
      font-size: 11px;
      line-height: 14px;
    }
  }
</style>
