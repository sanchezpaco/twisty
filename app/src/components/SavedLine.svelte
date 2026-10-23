<script lang="ts">
  import { dayLabel } from '../lib/dayLabel'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import type { SavedRide } from '../lib/savedRide'
  import { savedRides } from '../lib/savedRidesState.svelte'
  import RideIcon from './RideIcon.svelte'

  interface Props {
    saved: SavedRide
    onplanagain: () => void
  }

  let { saved, onplanagain }: Props = $props()

  const folder = $derived(savedRides.store.folders.find((candidate) => candidate.id === saved.folderId) ?? null)
  const day = $derived(dayLabel(saved.savedAt, Date.now(), i18n.locale, i18n.t.history))
</script>

<!-- In the slider's place: a saved ride is one ride, kept as it was; planning it again is the rider's call. -->
<!-- Padding, not margins: the sheet measures this block, and a child's margins would fall outside the measure. -->
<div class="slot">
  <div class="line">
    <span class="where">
      <RideIcon name="bookmarked" />
      <span>{folder ? i18n.t.saved.where(folder.name, day) : i18n.t.saved.whereLoose(day)}</span>
    </span>
    <button onclick={onplanagain} aria-label={i18n.t.saved.planAgainLabel}>
      <RideIcon name="replan" />
      {i18n.t.saved.planAgain}
    </button>
  </div>
</div>

<style>
  .slot {
    padding: 8px 0 12px;
  }

  .line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    height: 52px;
    padding: 0 4px 0 14px;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text-muted);
    font: 500 14px var(--font-ui);
    animation: appear 0.24s var(--ease-out) both;
  }

  .where {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .where span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .where :global(svg) {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--amber);
  }

  button {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--touch-target);
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--amber);
    font: 600 14px var(--font-ui);
  }

  button :global(svg) {
    width: 17px;
    height: 17px;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .line {
      animation: none;
    }
  }
</style>
