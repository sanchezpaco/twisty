<script lang="ts">
  import { formatDuration, formatExtra, formatKm } from '../lib/format'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import type { RideOption } from '../lib/routing/ride'

  interface Props {
    ride: RideOption
    /** Km of twisties on the fastest option, to tell what the extra time buys. */
    fastestTwistyM: number
    /** A saved ride has no fastest option on screen to compare with: the chip says its own curves. */
    saved?: boolean
  }

  let { ride, fastestTwistyM, saved = false }: Props = $props()

  const isFastest = $derived(ride.extraS < 60 && !saved)
</script>

<div class="headline">
  <div class="time">
    {formatDuration(ride.timeS)}
    <small>{formatKm(ride.distanceM)} km</small>
  </div>
  <div class="extra" class:extra--fastest={isFastest}>
    {#if saved}
      <span class="extra__time">{i18n.t.saved.curves(formatKm(ride.twistyM))}</span>
    {:else}
      <span class="extra__time">{formatExtra(ride.extraS)}</span>
    {/if}
    {#if !isFastest && !saved}
      <span class="extra__curves">{i18n.t.ride.curvesGained(formatKm(Math.max(0, ride.twistyM - fastestTwistyM)))}</span>
    {/if}
  </div>
</div>

<style>
  /* Fixed height and no wrapping, so the sheet does not jump while sliding between options. */
  .headline {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    height: 60px;
  }

  .time {
    font: 600 40px/1 var(--font-display);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .time small {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    color: var(--text-muted);
  }

  .extra {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    padding: 7px 14px;
    white-space: nowrap;
    border-radius: 14px;
    background: rgba(255, 46, 110, 0.12);
    box-shadow: inset 0 0 0 1px rgba(255, 46, 110, 0.35);
    color: #ff7a9c;
  }

  .extra__time {
    font: 600 15px var(--font-display);
  }

  .extra__curves {
    font-size: 12.5px;
    font-weight: 500;
  }

  .extra--fastest {
    background: rgba(31, 200, 216, 0.1);
    box-shadow: inset 0 0 0 1px rgba(31, 200, 216, 0.35);
    color: var(--cyan);
  }
</style>
