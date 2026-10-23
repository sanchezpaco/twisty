<script lang="ts" module>
  import type { Place } from '../lib/geocoding'

  /** What a place field offers while it is open: the options, and what picking one does. */
  export interface PlaceList {
    suggestions: Place[]
    offerAddressSearch: boolean
    addressMessage: string | null
    highlighted: number
    /** Whether the distance to each place is shown: only when the other end of the trip is set. */
    showDistance: boolean
    query: string
    onchoose: (place: Place) => void
    onaddresses: () => void
  }
</script>

<script lang="ts">
  import { formatKm } from '../lib/format'
  import { i18n } from '../lib/i18n/i18n.svelte'

  interface Props {
    list: PlaceList
    /** A floating box under its field; otherwise the list fills the room it is given. */
    dropdown: boolean
  }

  let { list, dropdown }: Props = $props()

  function placeDetail(place: Place): string | undefined {
    if (!place.kind) return place.detail
    const kind = i18n.t.places.kind[place.kind]
    return place.context ? i18n.t.places.near(kind, place.context) : kind
  }
</script>

<ul class="suggestions" class:suggestions--dropdown={dropdown} role="listbox">
  {#each list.suggestions as place, index (place.position.join() + index)}
    <li role="option" aria-selected={index === list.highlighted}>
      <!-- Keeps the focus where it is, so the keyboard stays up while the other field takes over. -->
      <button
        class:active={index === list.highlighted}
        onmousedown={(event) => {
          event.preventDefault()
          list.onchoose(place)
        }}
      >
        <span class="label">{place.label}</span>
        <span class="detail">
          {[placeDetail(place), list.showDistance && place.distanceM !== undefined && i18n.t.places.away(formatKm(place.distanceM))]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>
    </li>
  {/each}
  {#if list.offerAddressSearch}
    <li class="address-row" role="option" aria-selected={list.highlighted === list.suggestions.length}>
      <button
        class="address-search"
        class:active={list.highlighted === list.suggestions.length}
        onmousedown={(event) => {
          event.preventDefault()
          list.onaddresses()
        }}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>{i18n.t.places.searchAddresses(list.query.trim())}</span>
      </button>
    </li>
  {/if}
  {#if list.addressMessage}
    <li class="message">{list.addressMessage}</li>
  {/if}
</ul>

<style>
  .suggestions {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A floating box under its field, over whatever is below, as wide as the field and the action beside it: no text of the
     panel shows past its edge. */
  .suggestions--dropdown {
    position: absolute;
    z-index: 20;
    top: calc(100% + 6px);
    left: 0;
    right: calc(-1 * var(--touch-target));
    padding: 6px;
    max-height: min(400px, 46dvh);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    border-radius: var(--radius-md);
    background: #10131b;
    box-shadow: var(--shadow);
    animation: drop 0.2s var(--ease-out);
  }

  /* The street search stays in view at the foot of a long list: it is the way on when no town is the one. */
  .suggestions--dropdown .address-row {
    position: sticky;
    bottom: -6px;
    margin-bottom: -6px;
    padding-bottom: 6px;
    border-top: 1px solid var(--border);
    background: #10131b;
    /* Covers the list's own bottom padding too, where the next result would show a sliver. */
    box-shadow: 0 6px 0 #10131b;
  }

  .suggestions button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    min-height: 52px;
    padding: 9px 11px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
  }

  .suggestions button.active {
    background: var(--surface-hover);
  }

  @media (hover: hover) {
    .suggestions button:hover {
      background: var(--surface-hover);
    }
  }

  .suggestions .address-search {
    flex-direction: row;
    align-items: center;
    gap: 9px;
    color: var(--amber);
    font-size: 13.5px;
    font-weight: 500;
  }

  .message {
    padding: 9px 11px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .label {
    font-size: 15px;
    font-weight: 500;
  }

  .detail {
    margin-top: 2px;
    font-size: 12.5px;
    color: var(--text-muted);
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
</style>
