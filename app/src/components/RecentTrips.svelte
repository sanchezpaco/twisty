<script lang="ts">
  import { dayLabel } from '../lib/dayLabel'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { tracksFor } from '../lib/offRoad'
  import type { HistoryPlace, HistoryTrip } from '../lib/tripHistory'

  interface Props {
    trips: HistoryTrip[]
    onpick: (index: number) => void
    onremove: (index: number) => void
    onclear: () => void
    /** How far from the top of the details the middle of the row after the visible ones is; 0 when the list is short. */
    peekPx?: number
  }

  let { trips, onpick, onremove, onclear, peekPx = $bindable(0) }: Props = $props()

  /** The phone sheet shows this many rows whole and half the next one: the cut row says there are more. */
  const ROWS_SHOWN = 3

  let section: HTMLElement

  $effect(() => {
    void trips.length
    const row = section.querySelectorAll('li')[ROWS_SHOWN]
    const details = section.closest('.details')
    peekPx = row && details ? Math.round(row.getBoundingClientRect().top - details.getBoundingClientRect().top + row.offsetHeight / 2) : 0
  })

  const placeName = (place: HistoryPlace) => ('here' in place ? i18n.t.places.myLocation : place.label)
</script>

<section class="recent" bind:this={section}>
  <h3>{i18n.t.history.heading}</h3>
  <ol>
    {#each trips as trip, index (trip.at)}
      {@const from = placeName(trip.from)}
      {@const to = placeName(trip.to)}
      <li>
        <button class="go" onclick={() => onpick(index)} aria-label={i18n.t.history.plan(from, to)} title="{from} → {to}">
          <span class="names">
            {#if 'here' in trip.from}
              <svg class="here" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            {:else}
              <span class="from">{from}</span>
            {/if}
            <svg class="arrow" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span class="to">{to}</span>
          </span>
          <span class="meta">
            {dayLabel(trip.at, Date.now(), i18n.locale, i18n.t.history)}{#if trip.via.length > 0}{' · '}{i18n.t.via.through(trip.via.map(placeName).join(', '))}{/if}{#if tracksFor(trip.includeTracks)}{' · '}<b>{i18n.t.history.withTracks}</b>{/if}
          </span>
        </button>
        <button class="remove" onclick={() => onremove(index)} aria-label={i18n.t.history.remove(from, to)}>×</button>
      </li>
    {/each}
  </ol>
  <button class="clear" onclick={onclear}>{i18n.t.history.clearAll}</button>
</section>

<style>
  /* A shortcut list: quieter than the fields above it, so flat rows with hairlines and no card fill. */
  .recent {
    margin: 2px 0 14px;
  }

  h3 {
    margin: 14px 0 2px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: stretch;
    border-top: 1px solid var(--border);
  }

  li:first-child {
    border-top: 0;
  }

  .go {
    display: block;
    flex: 1;
    min-width: 0;
    min-height: 56px;
    padding: 9px 4px 9px 0;
    border: 0;
    background: none;
    text-align: left;
    color: var(--text);
    font: inherit;
  }

  .names {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 500 14.5px var(--font-ui);
  }

  .from {
    flex: 0 1 auto;
    max-width: 42%;
  }

  .to {
    flex: 1 1 0;
  }

  .from,
  .to {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    flex: none;
    color: var(--text-faint);
  }

  .here {
    flex: none;
    color: var(--text-muted);
  }

  .meta {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .meta b {
    font-weight: 500;
    color: var(--earth);
  }

  /* A gap between the row and the × so a thumb aiming at the trip does not remove it. */
  .remove {
    flex: none;
    width: var(--touch-target);
    margin-left: 8px;
    border: 0;
    background: none;
    font-size: 18px;
    color: var(--text-muted);
  }

  .clear {
    display: block;
    min-height: var(--touch-target);
    padding: 0;
    border: 0;
    background: none;
    font: 500 12.5px var(--font-ui);
    color: var(--text-muted);
  }

  @media (min-width: 700px) {
    h3 {
      margin-top: 6px;
    }
  }

  @media (hover: hover) {
    .go:hover .names,
    .remove:hover,
    .clear:hover {
      color: var(--text);
    }
  }
</style>
