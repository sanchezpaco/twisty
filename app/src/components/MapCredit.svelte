<script lang="ts">
  import { credits } from '../lib/creditsState.svelte'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { OSM_CREDIT, PNOA_CREDIT, SENTINEL_CREDIT } from '../lib/map/style'
  import { sheetCover } from '../lib/sheetCover.svelte'
  import type { MapTheme } from '../lib/map/theme'

  interface Props {
    theme: MapTheme
    /** The camera is close enough for PNOA orthophotos; further out the imagery is the Sentinel-2 mosaic. */
    pnoa: boolean
    /** Tilted on the relief, the far half of a close view is Sentinel-2 imagery. */
    terrain: boolean
    unavailable: boolean
    /** How much of the map the phone sheet covers. */
    coveredHeight: number
    onusedark: () => void
    /** How tall the foot of the map is, so the route is framed above it. */
    height?: number
  }

  let { theme, pnoa, terrain, unavailable, coveredHeight, onusedark, height = $bindable(0) }: Props = $props()

  // A sheet over the ride (Open in…, Save) stands taller than the ride's own: the credit is never half under its edge.
  const lift = $derived(Math.max(coveredHeight, sheetCover.heightPx))
  const imageryCredit = $derived(pnoa ? (terrain ? `${PNOA_CREDIT} · ${SENTINEL_CREDIT}` : PNOA_CREDIT) : SENTINEL_CREDIT)
  // Tiles that loaded before the service failed may still be on screen, so their credit stays with the note.
  const imageryShown = $derived(theme === 'satellite')
</script>

<!-- The licences ask for the credits at the map's foot, legible and next to the map: they are never folded away. The
     (i) opens the full credits, where the elevation data and the rest are named. -->
<div class="foot" style:--sheet-covered="{lift}px" bind:offsetHeight={height}>
  {#if theme === 'satellite' && unavailable}
    <button class="foot__note" onclick={onusedark}>
      {i18n.t.map.imageryUnavailable} · <span class="foot__action">{i18n.t.map.useDark}</span>
    </button>
  {/if}
  <div class="foot__row">
    <p class="foot__credit" class:foot__credit--imagery={imageryShown}>
      <span>{@html OSM_CREDIT}</span>
      {#if imageryShown}<span class="foot__imagery">{@html imageryCredit}</span>{/if}
    </p>
    <button class="foot__info" aria-label={i18n.t.credits.link} onclick={() => (credits.open = true)}>i</button>
  </div>
</div>

<style>
  /* Above the phone sheet, across the map's foot: the credit on the left, the (i) in the right corner. */
  .foot {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: calc(var(--sheet-covered, 0px) + 6px);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    pointer-events: none;
    transition: bottom 0.3s var(--ease-out);
  }

  .foot__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
  }

  .foot__credit {
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 100%;
    margin: 0;
    padding: 3px 10px;
    border-radius: 12px;
    background: var(--surface-sheet);
    color: var(--text-muted);
    font-size: 10px;
    line-height: 14px;
    text-wrap: balance;
  }

  /* The imagery formula changes with the zoom and cannot be shortened: on a phone the box always holds three lines (the
     map's credit, then the imagery's), so the route framing above it does not jump. */
  .foot__credit--imagery {
    min-height: 48px;
  }

  /* Only the links take a touch, and they do not look like buttons: a drag that starts on the credit pans the map. */
  .foot__credit :global(a) {
    position: relative;
    color: inherit;
    text-decoration: none;
    pointer-events: auto;
  }

  /* Ten pixels of text, but a finger has to hit it: taller, not wider, so neighbouring links keep their own. */
  .foot__credit :global(a)::before {
    content: '';
    position: absolute;
    inset: -12px 0;
  }

  .foot__info {
    position: relative;
    flex: none;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--surface-sheet);
    color: var(--text-muted);
    font: italic 600 13px/24px Georgia, serif;
    pointer-events: auto;
  }

  /* 24 px to look at, 44 px to hit. */
  .foot__info::before {
    content: '';
    position: absolute;
    inset: -10px;
  }

  .foot__note {
    min-height: var(--touch-target);
    padding: 0 16px;
    border: 0;
    border-radius: 22px;
    background: var(--surface-sheet-solid);
    box-shadow: inset 0 0 0 1px var(--border-strong), var(--shadow);
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
    pointer-events: auto;
  }

  .foot__action {
    color: var(--amber);
    font-weight: 600;
  }

  /* Beside the side panel (its widths are in Panel.svelte), 16 px clear of it and on its bottom line. Two lines are kept,
     as the imagery formula takes one or two there. */
  @media (min-width: 700px) {
    .foot {
      left: 392px;
      right: 16px;
      bottom: 16px;
    }

    .foot__credit--imagery {
      min-height: 34px;
    }
  }

  @media (min-width: 1024px) {
    .foot {
      left: 432px;
    }
  }
</style>
