<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { LonLat } from '../lib/geo'
  import { addressBias, loadPlaceIndex, type Place, searchAddresses } from '../lib/geocoding'
  import { createFieldFocus } from '../lib/fieldFocus'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { knownPosition, locationAllowed, riderPosition } from '../lib/locate'
  import PlaceSuggestions, { type PlaceList } from './PlaceSuggestions.svelte'

  interface Props {
    /** The start, the finish, or one of the rider's stops between them. */
    role: 'from' | 'to' | 'via'
    /** A stop's place among the stops. */
    index?: number
    value: Place | null
    /** Suggestions are ordered by closeness to this point. */
    near: LonLat
    /** Whether `near` is the other end of the trip; a distance from the middle of the map would only confuse. */
    showDistance: boolean
    placeholder: string
    /** Something outside the field is filling it (the rider's position): it shows the same spinner as a search. */
    busy?: boolean
    onchange: (place: Place | null) => void
    /** A place was picked from the list, as opposed to the field being cleared. */
    onchosen?: (place: Place) => void
    /** The options float under the field; otherwise they are handed out through `list` for the parent to lay out. */
    dropdown?: boolean
    /** The open options, or null while there are none to show. */
    list?: PlaceList | null
    /** Offered first, before any search: the finish of a trip with stops can go back to the start. */
    offer?: Place | null
    /** A stop's own controls (move, remove), at the end of the field in place of clearing it. */
    tools?: Snippet
    /** Places the rider went to lately, offered while the field is empty. */
    recent?: Place[]
    /** Offered while the field is empty: the rider chooses the place on the map instead. */
    onmap?: () => void
  }

  let {
    role,
    index,
    value,
    near,
    showDistance,
    placeholder,
    busy = false,
    onchange,
    onchosen,
    dropdown = true,
    list = $bindable(),
    offer = null,
    tools,
    recent = [],
    onmap,
  }: Props = $props()

  let input: HTMLInputElement

  export function focus() {
    input.focus()
  }

  // Below this length an address search is too vague to be worth a request.
  const MIN_ADDRESS_QUERY_LENGTH = 3

  let query = $state('')
  let suggestions = $state<Place[]>([])
  let offerAddressSearch = $state(false)
  let addressMessage = $state<string | null>(null)
  let highlighted = $state(0)
  let focused = $state(false)
  const fieldFocus = createFieldFocus((now) => (focused = now))
  let searching = $state(false)
  // Address results show a distance only when it is from the rider.
  let addressResults = $state(false)
  let addressesFromRider = $state(false)

  /** An empty field has nothing to search: it offers the recent places, and the map. */
  const empty = $derived(query.trim() === '' && !addressResults)
  const listed = $derived(empty ? recent : suggestions)
  /** What the list shows: the offered place first, unless an address search is showing its answers. */
  const shown = $derived(offer && !addressResults ? [offer, ...listed.filter((place) => place.position.join() !== offer.position.join())] : listed)
  /** Where the recent places begin in the list, under their heading; null when there are none. */
  const recentFrom = $derived(empty && shown.length > (offer ? 1 : 0) ? (offer ? 1 : 0) : null)
  const optionCount = $derived(shown.length + (offerAddressSearch ? 1 : 0))
  const open = $derived(focused && (optionCount > 0 || addressMessage !== null || (empty && onmap !== undefined)))

  $effect(() => {
    query = value?.label ?? ''
  })

  $effect(() => {
    list = open
      ? {
          suggestions: shown,
          offerAddressSearch,
          addressMessage,
          highlighted,
          showDistance: addressResults ? addressesFromRider : showDistance,
          query,
          recentFrom,
          onchoose: choose,
          onaddresses: findAddresses,
          onmap: empty ? onmap : undefined,
        }
      : null
  })

  async function onInput(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value
    const trimmed = query.trim()
    addressMessage = null
    highlighted = 0
    addressResults = false
    suggestions = trimmed ? (await loadPlaceIndex()).search(trimmed, near) : []
    offerAddressSearch = trimmed.length >= MIN_ADDRESS_QUERY_LENGTH
  }

  /** A search that opens on a place already chosen offers its neighbours, so the screen has a next step. */
  async function showSimilar() {
    if (!value) return
    addressResults = false
    suggestions = (await loadPlaceIndex()).search(value.label, near)
    highlighted = 0
  }

  async function findAddresses() {
    const searched = query.trim()
    offerAddressSearch = false
    searching = true
    try {
      // The fix is taken while the first request is out: a search that finds the street at once does not wait for it.
      let rider: LonLat | null = value?.here ? value.position : null
      const fix = rider ? Promise.resolve(rider) : knownPosition(riderPosition(), () => locationAllowed(navigator.permissions))
      void fix.then((position) => (rider = position))
      suggestions = await searchAddresses(searched, addressBias(value, null), i18n.locale, fix)
      addressResults = true
      addressesFromRider = rider !== null
      addressMessage = suggestions.length ? null : i18n.t.places.noAddresses(searched)
    } catch (error) {
      console.error(error)
      addressMessage = i18n.t.places.addressSearchUnavailable
    } finally {
      searching = false
      highlighted = 0
    }
  }

  function choose(place: Place) {
    suggestions = []
    offerAddressSearch = false
    query = place.label
    onchange(place)
    onchosen?.(place)
  }

  function activate(index: number) {
    if (index < shown.length) choose(shown[index])
    else findAddresses()
  }

  function clear() {
    query = ''
    suggestions = []
    offerAddressSearch = false
    addressMessage = null
    onchange(null)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      suggestions = []
      offerAddressSearch = false
      addressMessage = null
      query = value?.label ?? ''
      ;(event.currentTarget as HTMLInputElement).blur()
    } else if (optionCount === 0) return
    else if (event.key === 'ArrowDown') highlighted = (highlighted + 1) % optionCount
    else if (event.key === 'ArrowUp') highlighted = (highlighted - 1 + optionCount) % optionCount
    else if (event.key === 'Enter') activate(highlighted)
    else return
    event.preventDefault()
  }
</script>

<div class="field" class:field--focused={focused} class:field--via={role === 'via'}>
  {#if role === 'via'}
    <span class="marker marker--via" aria-hidden="true"><i></i></span>
  {:else}
    <span class="marker marker--{role}">{role === 'from' ? 'A' : 'B'}</span>
  {/if}
  <input
    bind:this={input}
    type="text"
    value={query}
    {placeholder}
    data-role={role}
    data-index={index}
    autocomplete="off"
    spellcheck="false"
    aria-label={placeholder}
    oninput={onInput}
    onkeydown={onKeydown}
    onfocus={(event) => {
      fieldFocus.focus()
      ;(event.currentTarget as HTMLInputElement).select()
      if (!dropdown) showSimilar()
    }}
    onblur={fieldFocus.blur}
  />
  {#if searching || busy}
    <span class="spinner" aria-hidden="true"></span>
  {:else if query && !tools}
    <button class="clear" onclick={clear} aria-label={i18n.t.places.clear}>×</button>
  {/if}
  {#if tools}{@render tools()}{/if}

  {#if dropdown && list}
    <PlaceSuggestions {list} {dropdown} />
  {/if}
</div>

<style>
  .field {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 10px 0 12px;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    transition: box-shadow 0.25s, background 0.25s;
  }

  .field--focused {
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset 0 0 0 1px rgba(255, 181, 71, 0.55), 0 0 0 4px rgba(255, 181, 71, 0.08);
  }

  .marker {
    flex: none;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font: 700 11px var(--font-display);
  }

  .marker--from {
    background: var(--text);
    color: var(--bg);
  }

  .marker--to {
    background: var(--gradient);
    color: #fff;
  }

  /* A stop: the plain white point the map draws, in the slot of the A and B letters. */
  .marker--via i {
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22);
  }

  /* A stop's controls take the end of the field: it gives them its padding. */
  .field--via {
    padding-right: 2px;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    background: transparent;
    outline: none;
    font-size: 15px;
    font-weight: 500;
  }

  input::placeholder {
    color: var(--text-faint);
    font-weight: 400;
  }

  .clear {
    flex: none;
    width: var(--touch-target);
    height: var(--touch-target);
    margin-right: -8px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-faint);
    font-size: 20px;
    line-height: 1;
  }

  @media (hover: hover) {
    .clear:hover {
      color: var(--text);
      background: var(--surface-hover);
    }
  }

  .spinner {
    width: 16px;
    height: 16px;
    margin-right: 5px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--amber);
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
