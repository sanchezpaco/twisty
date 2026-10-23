<script lang="ts">
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { sheetCover } from '../lib/sheetCover.svelte'

  interface Props {
    /** Part of the ride is off the free map: the camera can take it in whole again. */
    rideHidden: boolean
    locating: boolean
    /** It stands above the sheet and the credit at the map's foot, as the region box does. */
    coveredHeight: number
    footHeight: number
    onshowride: () => void
    onlocate: () => void
  }

  let { rideHidden, locating, coveredHeight, footHeight, onshowride, onlocate }: Props = $props()

  // A sheet over the ride (Open in…, Save) lifts the credit, and the corner with it.
  const lift = $derived(Math.max(coveredHeight, sheetCover.heightPx))
</script>

<!-- The map's own tools, under the thumb on a phone and away from the top-right column where the B pin may stand. -->
<div class="corner" style:--sheet-covered="{lift}px" style:--foot-height="{footHeight}px">
  <button class="corner__button" class:corner__button--shown={rideHidden} inert={!rideHidden} onclick={onshowride} title={i18n.t.map.showRide} aria-label={i18n.t.map.showRide}>
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M8 15c2-4 4 1 8-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
  <button class="corner__button corner__button--shown" class:corner__button--busy={locating} onclick={onlocate} title={i18n.t.map.locateMe} aria-label={i18n.t.map.locateMe}>
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
</div>

<style>
  .corner {
    position: absolute;
    right: 16px;
    bottom: calc(var(--sheet-covered) + var(--foot-height) + 14px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    transition: bottom 0.3s var(--ease-out);
  }

  .corner__button {
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: var(--map-shadow);
    color: var(--text-muted);
    opacity: 0;
    transform: scale(0.85);
    transition:
      opacity 0.2s,
      transform 0.2s var(--ease-out),
      color 0.3s;
  }

  .corner__button--shown {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .corner__button--busy {
    color: var(--amber);
    animation: locating 1.2s ease-in-out infinite;
  }

  @keyframes locating {
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .corner__button--busy {
      animation: none;
    }
  }

  /* Beside the side panel, over the credit's line in the map's free corner. */
  @media (min-width: 700px) {
    .corner {
      bottom: calc(16px + var(--foot-height) + 8px);
    }
  }
</style>
