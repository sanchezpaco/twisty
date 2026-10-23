<script lang="ts">
  import { tick, untrack } from 'svelte'
  import type { AppError, FailedAt } from '../lib/errors'
  import { formatNumber } from '../lib/format'
  import type { LonLat } from '../lib/geo'
  import type { Place } from '../lib/geocoding'
  import { onBackButton } from '../lib/backButton'
  import { TRACKS_OFFERED } from '../lib/offRoad'
  import { isSidePanel, onLayoutChange } from '../lib/layout'
  import { gpxFileName } from '../lib/gpx'
  import { MAX_VIA } from '../lib/googleMaps'
  import { showToast } from '../lib/toastState.svelte'
  import { backToStart, distinctStops, dropIndex, moveVia } from '../lib/via'
  import { credits } from '../lib/creditsState.svelte'
  import { PRIVACY_URL } from '../lib/privacy'
  import { i18n, type Locale, LOCALES } from '../lib/i18n/i18n.svelte'
  import type { RideOption, RideTwisty } from '../lib/routing/ride'
  import type { SavedRide } from '../lib/savedRide'
  import { savedRides } from '../lib/savedRidesState.svelte'
  import { cycleSnap, type SnapName, snapsFor } from '../lib/sheet'
  import { createSheetDrag } from '../lib/sheetDrag'
  import type { HistoryTrip } from '../lib/tripHistory'
  import Logo from './Logo.svelte'
  import OptionsChip from './OptionsChip.svelte'
  import PlaceField from './PlaceField.svelte'
  import type { PlaceList } from './PlaceSuggestions.svelte'
  import PlaceSuggestions from './PlaceSuggestions.svelte'
  import RecentTrips from './RecentTrips.svelte'
  import RideActions from './RideActions.svelte'
  import RideHeadline from './RideHeadline.svelte'
  import RideIcon from './RideIcon.svelte'
  import RideSlider from './RideSlider.svelte'
  import RideSummary from './RideSummary.svelte'
  import SavedLine from './SavedLine.svelte'
  import SavedRides from './SavedRides.svelte'

  const TOUCH_QUERY = '(pointer: coarse)'
  /** A sheet with no middle snap, such as the start screen, never makes the camera give up more than this of the map. */
  const MAX_COVER_FRACTION = 0.52
  /** On the start screen the middle snap adds the intro, as long as it leaves the map this much of the screen. */
  const START_HALF_MAX_FRACTION = 0.6
  /**
   * The credit and the region box stand above a sheet up to this much of the screen, the start screen's intro included. A
   * taller sheet covers them whole: they then stay on the camera's cover, which stops at MAX_COVER_FRACTION, well below.
   */
  const FOOT_ABOVE_SHEET_MAX_FRACTION = 0.62

  interface Props {
    from: Place | null
    /** The rider's stops between start and finish, in riding order. */
    via: Place[]
    onvia: (list: Place[]) => void
    /** Where the trip failed, when it has stops: the leg with no road, or the point far from any. */
    errorAt: FailedAt
    /** Where place suggestions are biased towards when neither end of the trip is set yet. */
    searchCenter: LonLat
    to: Place | null
    includeTracks: boolean
    options: RideOption[]
    selected: number
    /** A very short trip: its stops are held back, with a way to show them. */
    stopsHidden: boolean
    onshowstops: () => void
    showPinsNote: boolean
    planning: boolean
    refining: boolean
    error: AppError | null
    loadProgress: number | null
    engineReady: boolean
    twistyCount: number
    onfrom: (place: Place | null) => void
    onto: (place: Place | null) => void
    onswap: () => void
    /** Clears the trip and its ride; the toast with Undo stands next to `anchor`, or on the sheet's edge when null. */
    onstartover: (anchor: HTMLElement | null) => void
    ontracks: (include: boolean) => void
    onlocate: () => void
    /** The rider's position is on its way to the start: from the tap until a fix or an error. */
    locating: boolean
    onselect: (index: number) => void
    /** A finger is on the slider, or has left it. */
    onscrub: (scrubbing: boolean) => void
    onfocus: (twisty: RideTwisty) => void
    /** Rides handed to a navigation app, and the last one left on screen: the start screen offers them again. */
    history: HistoryTrip[]
    onpicktrip: (index: number) => void
    onremovetrip: (index: number) => void
    onclearhistory: () => void
    /** The ride went to another app (Open in…). */
    onhandover: () => void
    /** A saved ride is on screen, as it was saved: no slider, and a way to plan it again. */
    savedView: SavedRide | null
    onopensaved: (ride: SavedRide) => void
    onclosesaved: () => void
    onplanagain: () => void
    /** `generatedAt` of the data the planner uses, kept with a saved ride. */
    dataAt: string | null
  }

  /**
   * How much of the map the camera should treat as covered, and where the credit and the region box stand at the map's
   * foot; both change when the sheet settles, never while dragged.
   */
  let {
    coveredHeight = $bindable(0),
    footClearance = $bindable(0),
    listOpen = $bindable(false),
    ...props
  }: Props & { coveredHeight?: number; footClearance?: number; listOpen?: boolean } = $props()
  /** The phone's full-screen place search is open. */
  let editorOpen = $state(false)
  /** The saved rides are open: at the top (folderId null) or inside a folder. Kept while a saved ride is on screen. */
  let savedList = $state<{ folderId: string | null } | null>(null)
  const hasSaved = $derived(savedRides.store.rides.length > 0 || savedRides.store.folders.length > 0)
  let optionsOpen = $state(false)
  let snapName = $state<SnapName>('half')
  let sidePanel = $state(isSidePanel())
  /** The sheet takes its first position without sliding there. */
  let animated = $state(false)

  let panelHeight = $state(0)
  // The sheet is measured in blocks: what its snaps show is a sum of them, whatever the snap it sits on.
  let limitPx = $state(0)
  let headPx = $state(0)
  let sliderPx = $state(0)
  let detailsPx = $state(0)
  let footSpacePx = $state(0)
  /** With a history on the start screen: where the middle snap cuts the list, through the middle of a row. */
  let recentPeekPx = $state(0)
  /** The pinned footer is a button, and a line about tracks above it on some rides. */
  let footerPx = $state(0)

  let startField: PlaceField
  let finishField: PlaceField
  let startList = $state<PlaceList | null>(null)
  let finishList = $state<PlaceList | null>(null)
  const stopFields: PlaceField[] = $state([])
  // A stop's open list, bound by index; a field not yet bound has none.
  const stopLists = $state<(PlaceList | null | undefined)[]>([])
  const openList = $derived(startList ?? stopLists.find((list) => list) ?? finishList)
  let activeRole = $state<'from' | 'to' | 'via'>('from')

  /**
   * The stops as the fields show them while the rider edits them, a stop not chosen yet being null. On the phone they
   * plan when the place search closes (it covers the ride anyway); beside the map, after a pause, so a drag in progress
   * plans nothing. Picking a stop's place plans at once.
   */
  let draft = $state<(Place | null)[] | null>(null)
  const shownStops = $derived(draft ?? props.via)
  const STOPS_SETTLE_MS = 400
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  // A trip changed from elsewhere (the map, the swap, a recent trip) is what the fields show, unless a stop is being typed.
  $effect(() => {
    void props.via
    untrack(() => {
      if (draft && !draft.includes(null)) draft = null
    })
  })

  function editStops(list: (Place | null)[], now = false) {
    draft = list
    clearTimeout(settleTimer)
    if (now) commitStops()
    else if (sidePanel) settleTimer = setTimeout(commitStops, STOPS_SETTLE_MS)
  }

  /** Plans the stops as they are; a field still empty stays on screen until it is chosen or dropped. */
  function commitStops(dropEmpty = false) {
    if (!draft) return
    const chosen = draft.filter((stop): stop is Place => stop !== null)
    draft = dropEmpty || chosen.length === draft.length ? null : draft
    if (chosen.length !== props.via.length || chosen.some((stop, i) => stop !== props.via[i])) props.onvia(chosen)
  }

  async function addStop() {
    editStops([...shownStops, null])
    await tick()
    stopFields[shownStops.length - 1]?.focus()
  }

  function stopChosen(index: number, place: Place) {
    editStops(shownStops.map((stop, i) => (i === index ? place : stop)), true)
    if (editorOpen) closeEditor()
  }

  function removeStop(index: number) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const before = shownStops
    const removed = before[index]
    editStops(before.filter((_, i) => i !== index), !editorOpen)
    // The toast stands under the "Add stop" row, clear of the fields and of the button the rider may tap next.
    const anchor = panel.querySelector<HTMLElement>('.add-stop') ?? panel
    if (removed) showToast(i18n.t.via.removed(removed.label), anchor, { below: true, action: { label: i18n.t.saved.undo, run: () => editStops(before, !editorOpen) } })
  }

  /**
   * Dragging a stop by its grip: the row follows the finger within the stops, the rows it passes make room, and it
   * lands where the room is. Measured when the drag begins, so the rows moving aside do not move the target.
   */
  let stopDrag: { index: number; startY: number; dy: number; middles: number[]; step: number; minDy: number; maxDy: number; target: number } | null =
    $state(null)
  function gripDown(event: PointerEvent, index: number) {
    // Managing stops is not typing: the keyboard goes.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    const rows = [...panel.querySelectorAll<HTMLElement>('.place-row--via')].map((row) => row.getBoundingClientRect())
    const middles = rows.map((row) => row.top + row.height / 2)
    const step = rows.length > 1 ? rows[1].top - rows[0].top : rows[0].height
    stopDrag = { index, startY: event.clientY, dy: 0, middles, step, minDy: rows[0].top - rows[index].top, maxDy: rows[rows.length - 1].top - rows[index].top, target: index }
  }
  function gripMove(event: PointerEvent) {
    if (!stopDrag) return
    stopDrag.dy = Math.min(stopDrag.maxDy, Math.max(stopDrag.minDy, event.clientY - stopDrag.startY))
    stopDrag.target = dropIndex(stopDrag.middles, stopDrag.index, stopDrag.middles[stopDrag.index] + stopDrag.dy)
  }
  function gripUp() {
    if (!stopDrag) return
    const { index, target } = stopDrag
    stopDrag = null
    if (target !== index) editStops(moveVia(shownStops, index, target), !editorOpen)
  }
  /** How far a row moves aside while another is dragged past it. */
  function makeRoom(index: number): string | null {
    if (!stopDrag) return null
    if (index === stopDrag.index) return `translateY(${stopDrag.dy}px)`
    const { index: from, target, step } = stopDrag
    if (from < target && index > from && index <= target) return `translateY(${-step}px)`
    if (target < from && index >= target && index < from) return `translateY(${step}px)`
    return null
  }
  function gripKey(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    if (!step || index + step < 0 || index + step >= shownStops.length) return
    event.preventDefault()
    editStops(moveVia(shownStops, index, index + step), !editorOpen)
  }

  /** The finish of a trip with stops can go back where it started: a loop. */
  const loopOffer = $derived(
    props.from && shownStops.some((stop) => stop !== null) ? backToStart(props.from, i18n.t.via.backToStart) : null,
  )
  /** The trip's places as its legs run, for the legs list and the errors. */
  const legPlaces = $derived(props.from && props.to ? [props.from, ...distinctStops(props.from, props.via, props.to), props.to] : [])
  const errorText = $derived.by(() => {
    if (!props.error) return null
    const { leg, point } = props.errorAt
    if (props.error === 'noConnection' && leg !== undefined && legPlaces.length > 2) return i18n.t.via.noLeg(legPlaces[leg].label, legPlaces[leg + 1].label)
    if (props.error === 'sameSpot' && leg !== undefined && legPlaces.length > 2) return i18n.t.via.sameSpot(legPlaces[leg].label, legPlaces[leg + 1].label)
    if (props.error === 'tooFar' && point !== undefined && point > 0 && point < legPlaces.length - 1) return i18n.t.via.farStop(legPlaces[point].label)
    return i18n.t.errors[props.error]
  })
  /** The stop to change when the trip failed at one, or null when it failed at an end or has no stops. */
  const failedStop = $derived.by(() => {
    const { leg, point } = props.errorAt
    const last = legPlaces.length - 1
    const atLeg = props.error === 'noConnection' || props.error === 'sameSpot'
    const at = props.error === 'tooFar' ? point : atLeg && leg !== undefined ? (leg + 1 < last ? leg + 1 : leg) : undefined
    return at !== undefined && at > 0 && at < last ? at - 1 : null
  })
  // "My location" is offered as a start until the rider starts typing something else.
  const offersMyLocation = $derived(activeRole === 'from' && (!openList || openList.query.trim() === (props.from?.label ?? '').trim()))

  const ride = $derived(props.options[props.selected] ?? null)
  // A saved ride needs no planner: it is shown while the network is still loading.
  const waitingForEngine = $derived(!props.engineReady && props.from !== null && props.to !== null && props.savedView === null)
  const places = $derived(props.from && props.to ? { from: props.from, to: props.to, via: props.via } : null)
  const showsSavedList = $derived(savedList !== null && ride === null && !editorOpen)
  // The map keeps its region box out of the way of a list.
  $effect(() => {
    listOpen = editorOpen || showsSavedList || openList !== null
  })
  const showsRide = $derived(ride !== null && !props.error && !props.planning && !waitingForEngine)
  const gpxName = $derived(gpxFileName(props.from?.label ?? 'start', props.to?.label ?? 'finish', ride?.extraS))

  // A ride gives the sheet three snaps, the start screen two (the fields, then the intro too); every other state is
  // one block, shown whole.
  const hasSnaps = $derived(showsRide && !editorOpen)
  const isStart = $derived(ride === null && !props.error && !props.planning && !waitingForEngine)
  const contentPx = $derived(headPx + (showsRide ? sliderPx : 0) + detailsPx + footSpacePx)
  const measuredSnaps = $derived(
    snapsFor({
      peekPx: hasSnaps || isStart ? headPx + footSpacePx : contentPx,
      halfPx: hasSnaps
        ? headPx + sliderPx + footSpacePx
        : isStart
          ? Math.min(contentPx, START_HALF_MAX_FRACTION * limitPx, recentPeekPx > 0 ? headPx + recentPeekPx + footSpacePx : Infinity)
          : contentPx,
      contentPx,
      viewportPx: limitPx,
      topReservePx: 0,
    }),
  )
  // The place search takes the whole screen, status bar band included.
  const snaps = $derived(editorOpen ? [{ name: 'full' as const, visiblePx: panelHeight }] : measuredSnaps)
  const snap = $derived(snaps.find((candidate) => candidate.name === snapName) ?? snaps[snaps.length - 1])
  const nextSnap = $derived(cycleSnap(snaps, snap.name))
  const bodyMaxPx = $derived(snaps[snaps.length - 1].visiblePx - headPx - footSpacePx)

  /** The phone sheet is as tall as the screen and slides up until `visiblePx` of it shows. */
  const sheetTransform = (visiblePx: number) => `translate3d(0, calc(100% - ${visiblePx}px), 0)`
  let panel: HTMLElement
  let body: HTMLElement
  let dragging = $state(false)
  const sheetDrag = createSheetDrag({
    snaps: () => (sidePanel ? [] : snaps),
    restingPx: () => snap.visiblePx,
    begin: () => (dragging = true),
    // The position is written as a transform and nothing else: a custom property would restyle everything inside the
    // sheet each time it changes, which on an old phone costs several milliseconds.
    move: (visiblePx) => (panel.style.transform = sheetTransform(visiblePx)),
    settle: (target) => {
      dragging = false
      // Svelte only writes the transform when the snap changes, so a sheet that settles where it was is put back here.
      panel.style.transform = sheetTransform(target.visiblePx)
      snapName = target.name
    },
  })

  $effect(() => onLayoutChange(() => (sidePanel = isSidePanel())))

  // The place search is a phone screen: a foldable that opens while it is up goes back to the side panel.
  $effect(() => {
    if (sidePanel) editorOpen = false
  })

  $effect(() => {
    const frame = requestAnimationFrame(() => (animated = true))
    return () => cancelAnimationFrame(frame)
  })

  // The full sheet leaves the map as it was on the middle snap: a thin strip of map is no use to frame a route in.
  const coverPx = $derived(Math.min(snap.visiblePx, snaps.find((candidate) => candidate.name === 'half')?.visiblePx ?? MAX_COVER_FRACTION * panelHeight))
  // What was scrolled away at full must not hide the slider when the sheet comes back down.
  $effect(() => {
    if (snap.name !== 'full') body.scrollTop = 0
  })

  // The camera stays where it was while the place search covers everything.
  $effect(() => {
    if (editorOpen) return
    coveredHeight = sidePanel ? panelHeight : coverPx
    // The camera may give up less of the map than the sheet hides (the start screen's intro), but the credit must not.
    if (sidePanel) footClearance = panelHeight
    else if (snap.visiblePx <= FOOT_ABOVE_SHEET_MAX_FRACTION * panelHeight) footClearance = snap.visiblePx
    else footClearance = Math.min(coverPx, MAX_COVER_FRACTION * panelHeight)
  })

  // A fresh ride opens with the sheet on its middle snap, so the map and the slider get the screen.
  // Keyed on the fastest ride, which stays the same object while the other options arrive.
  const fastestRide = $derived(props.options[0])
  // In the side panel the fields stay in view: a finished trip must not leave a keyboard up over the ride's stats.
  $effect(() => {
    if (!fastestRide) return
    untrack(() => {
      snapName = 'half'
      // The side panel may have been scrolled down a long list of saved rides: a ride opens at its top.
      body.scrollTop = 0
      if (sidePanel && document.activeElement instanceof HTMLInputElement) document.activeElement.blur()
    })
  })

  // Back from a saved ride returns to the list it was opened from; leaving it by changing its trip (Plan again, a pick
  // on the map) leaves the list too, or the list would cover that trip while it is planned.
  let closingSaved = false
  let hadSaved = false
  function closeSaved() {
    closingSaved = true
    props.onclosesaved()
  }
  $effect(() => {
    const open = props.savedView !== null
    if (hadSaved && !open && !closingSaved) savedList = null
    hadSaved = open
    closingSaved = false
  })

  $effect(() =>
    onBackButton(() => {
      if (editorOpen) closeEditor()
      // A short start screen has no half snap of its own (it merges into full): there back goes on to leave the app.
      else if (snap.name === 'full' && snaps.some((candidate) => candidate.name === 'half')) snapName = 'half'
      else if (props.savedView) closeSaved()
      else if (savedList?.folderId) savedList = { folderId: null }
      else if (savedList) savedList = null
      // Back out of a trip is Start over, with its Undo; only the bare start screen leaves the app.
      else if (props.from || props.to) startOver()
      else return false
      return true
    }),
  )

  // The fields are hidden while the ride is shown; focusing inside the tap keeps the keyboard coming up.
  function startOver() {
    editorOpen = false
    // Beside the map the toast stands over the map, on its credit line: in the panel it would cover the recent trips
    // moving up. On a phone it stands on the sheet's edge.
    props.onstartover(sidePanel ? document.querySelector<HTMLElement>('.foot__credit') : null)
  }

  async function editTrip(field: PlaceField) {
    editorOpen = true
    await tick()
    field.focus()
  }

  // Tapping a control next to the fields must not take the keyboard away from the field being edited.
  const keepFocus = (event: MouseEvent) => event.preventDefault()

  function closeEditor() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    editorOpen = false
    optionsOpen = false
    commitStops(true)
  }

  // Focusing a field opens the place search on phones.
  function fieldFocused(event: FocusEvent) {
    if (sidePanel || !(event.target instanceof HTMLInputElement)) return
    const role = event.target.dataset.role
    activeRole = role === 'to' || role === 'via' ? role : 'from'
    editorOpen = true
  }

  // The other end comes next; with both set the trip is complete and the search gives way to the planning.
  function placeChosen(role: 'from' | 'to') {
    if (!editorOpen) return
    const other = role === 'from' ? props.to : props.from
    if (other) closeEditor()
    else (role === 'from' ? finishField : startField).focus()
  }

  // A twisty picked from the list is shown on the map, which the full sheet would be covering.
  function showTwisty(twisty: RideTwisty) {
    if (snap.name === 'full') snapName = 'half'
    props.onfocus(twisty)
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && editorOpen && closeEditor()} />

<aside
  class="panel"
  class:panel--trip={ride !== null && !editorOpen}
  class:panel--editor={editorOpen}
  class:panel--animated={animated}
  class:panel--dragging={dragging}
  bind:this={panel}
  onfocusin={fieldFocused}
  style:transform={sidePanel ? null : sheetTransform(snap.visiblePx)}
  style:--body-max="{bodyMaxPx}px"
  bind:clientHeight={panelHeight}
>
  <!-- Stands where the sheet may reach, so the snaps follow the viewport without reading env(). -->
  <div class="limit" aria-hidden="true" bind:clientHeight={limitPx}></div>

  <div class="head" bind:offsetHeight={headPx}>
    <button
      class="handle"
      use:sheetDrag.handle
      onclick={() => (snapName = nextSnap.name)}
      disabled={snaps.length < 2}
      aria-label={nextSnap.visiblePx > snap.visiblePx ? i18n.t.panel.expand : i18n.t.panel.collapse}
    >
      <span></span>
    </button>

    <div class="editor-bar">
      <button class="back" onclick={closeEditor} aria-label={i18n.t.panel.closeSearch}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <header>
      <Logo />
      <div class="brand">
        <h1>twisty</h1>
        <p>{i18n.t.tagline}</p>
      </div>
    </header>

    {#if !props.engineReady}
      <div class="engine" aria-live="polite">
        <div class="engine__bar" class:engine__bar--indeterminate={props.loadProgress === null}>
          <span style:width="{Math.round((props.loadProgress ?? 0.3) * 100)}%"></span>
        </div>
        <span>
          {i18n.t.loading}{props.loadProgress === null ? '…' : ` · ${Math.round(props.loadProgress * 100)} %`}
        </span>
      </div>
    {/if}

    {#if ride}
      <div class="trip-line">
        <div class="trip" use:sheetDrag.handle>
          <button onclick={() => editTrip(startField)} aria-label={i18n.t.panel.changeStart(props.from?.label ?? '')}>
            <span class="dot dot--from">A</span>
            <span class="trip__name">{props.from?.label}</span>
          </button>
          {#if props.via.length > 0}
            <!-- One dot per stop on the arrow: it opens the stops to manage, with no field (and no keyboard) taken. -->
            <button class="trip__stops" onclick={() => (editorOpen = true)} aria-label={i18n.t.via.count(props.via.length)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              {#each props.via as stop (stop)}<i></i>{/each}
            </button>
          {:else}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          {/if}
          <button onclick={() => editTrip(finishField)} aria-label={i18n.t.panel.changeFinish(props.to?.label ?? '')}>
            <span class="dot dot--to">B</span>
            <span class="trip__name">{props.to?.label}</span>
          </button>
        </div>
        <!-- Its own button outside the row: inside, next to B, it would read as "clear the finish", and the row is a drag handle. -->
        <button class="start-over" onclick={startOver} aria-label={i18n.t.panel.startOver} title={i18n.t.panel.startOver}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    {/if}

    <div class="places">
      <div class="place-row">
        <PlaceField
          bind:this={startField}
          role="from"
          value={props.from}
          near={props.to?.position ?? props.searchCenter}
          showDistance={props.to !== null}
          placeholder={props.locating ? i18n.t.places.locating : i18n.t.places.startPlaceholder}
          busy={props.locating}
          onchange={props.onfrom}
          onchosen={() => placeChosen('from')}
          dropdown={sidePanel}
          bind:list={startList}
        />
        <!-- "My location" belongs to the start, whatever lies between it and the finish. -->
        <button class="row-action" class:row-action--busy={props.locating} onmousedown={keepFocus} onclick={props.onlocate} title={i18n.t.places.locate} aria-label={i18n.t.places.locate}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      {#each shownStops as stop, index (index)}
        <div
          class="place-row place-row--via"
          class:place-row--dragged={stopDrag?.index === index}
          class:place-row--making-room={stopDrag !== null && stopDrag.index !== index}
          style:transform={makeRoom(index)}
        >
          <PlaceField
            bind:this={stopFields[index]}
            role="via"
            {index}
            value={stop}
            near={stop?.position ?? props.from?.position ?? props.searchCenter}
            showDistance={false}
            placeholder={i18n.t.via.placeholder}
            onchange={(place) => place && editStops(shownStops.map((other, i) => (i === index ? place : other)))}
            onchosen={(place) => stopChosen(index, place)}
            dropdown={sidePanel}
            bind:list={stopLists[index]}
          >
            {#snippet tools()}
              <button class="stop-tool" onclick={() => removeStop(index)} aria-label={i18n.t.via.remove(stop?.label ?? i18n.t.via.placeholder)}>×</button>
            {/snippet}
          </PlaceField>
          <!-- The grip stands in the column of the locate and swap buttons: the name keeps its room, and the grip is far from ×. -->
          <button
            class="row-action stop-grip"
            onpointerdown={(event) => gripDown(event, index)}
            onpointermove={gripMove}
            onpointerup={gripUp}
            onpointercancel={() => (stopDrag = null)}
            onkeydown={(event) => gripKey(event, index)}
            aria-label={i18n.t.via.move(stop?.label ?? i18n.t.via.placeholder)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <g fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></g>
            </svg>
          </button>
        </div>
      {/each}
      <div class="place-row">
        <PlaceField
          bind:this={finishField}
          role="to"
          value={props.to}
          near={props.from?.position ?? props.searchCenter}
          showDistance={props.from !== null}
          placeholder={i18n.t.places.finishPlaceholder}
          onchange={props.onto}
          onchosen={() => placeChosen('to')}
          dropdown={sidePanel}
          bind:list={finishList}
          offer={loopOffer}
        />
        <!-- The swap turns the whole trip round: it stays with the finish. -->
        <button class="row-action" onmousedown={keepFocus} onclick={props.onswap} title={i18n.t.places.swap} aria-label={i18n.t.places.swap}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path d="M8 4v16M8 20l-4-4M8 20l4-4M16 20V4M16 4l-4 4M16 4l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <!-- Stops come once there is a trip to put them in: a new rider sees two fields. -->
      {#if props.from && props.to}
        <div class="add-stop">
          <div class="add-stop__line">
            <button onmousedown={keepFocus} onclick={addStop} disabled={shownStops.length >= MAX_VIA}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              {i18n.t.via.add}
            </button>
            <!-- Beside the map there is no trip row: the fields stay, and the way to start over sits with them. -->
            {#if sidePanel}<button class="start-over-text" onclick={startOver}>{i18n.t.panel.startOver}</button>{/if}
          </div>
          {#if shownStops.length >= MAX_VIA}<p>{i18n.t.via.capped(MAX_VIA)}</p>{/if}
        </div>
      {/if}
    </div>

    {#if TRACKS_OFFERED}
      <div class="options" class:options--hidden={openList !== null}>
        <OptionsChip includeTracks={props.includeTracks} ontracks={props.ontracks} bind:open={optionsOpen} />
      </div>
    {/if}

    {#if showsRide && ride}
      <div class="headline-slot" use:sheetDrag.handle>
        <RideHeadline {ride} fastestTwistyM={props.options[0].twistyM} saved={props.savedView !== null} />
      </div>
    {/if}
  </div>

  {#if editorOpen && !sidePanel}
    <div class="editor-list">
      <!-- The details below the fields are out of sight while a field is edited, and this is where the rider is looking. -->
      {#if props.error === 'location'}
        <div class="error error--editing" role="alert"><p>{i18n.t.errors.location}</p></div>
      {/if}
      {#if offersMyLocation}
        <button
          class="here"
          onmousedown={(event) => {
            event.preventDefault()
            props.onlocate()
            placeChosen('from')
          }}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>{i18n.t.places.locate}</span>
        </button>
      {/if}
      {#if openList}<PlaceSuggestions list={openList} dropdown={false} />{/if}
    </div>
  {/if}

  <div class="body" class:body--scroll={snap.name === 'full'} bind:this={body} use:sheetDrag.scroller>
    {#if showsRide}
      <div class="slider-slot" data-no-drag bind:offsetHeight={sliderPx}>
        {#if props.savedView}
          <SavedLine saved={props.savedView} onplanagain={props.onplanagain} />
        {:else}
          <RideSlider options={props.options} selected={props.selected} refining={props.refining} onselect={props.onselect} onscrub={props.onscrub} onshowstops={props.stopsHidden ? props.onshowstops : undefined} />
        {/if}
      </div>
    {/if}
    <div class="details" class:details--ride={showsRide} bind:offsetHeight={detailsPx}>
      {#if props.error}
        <div class="error" role="alert">
          <p>{errorText}</p>
          {#if failedStop !== null}
            <button onclick={() => editTrip(stopFields[failedStop])}>{i18n.t.via.change}</button>
          {:else if props.error === 'noConnection' || props.error === 'tooFar' || props.error === 'sameSpot'}
            <button onclick={() => editTrip(finishField)}>{i18n.t.panel.otherFinish}</button>
          {/if}
          <button onclick={startOver}>{i18n.t.panel.startOver}</button>
        </div>
      {:else if props.planning || waitingForEngine}
        <div class="planning" aria-live="polite">
          <svg viewBox="0 0 220 40" aria-hidden="true">
            <defs>
              <linearGradient id="planning-gradient">
                <stop offset="0" stop-color="#ffb547" />
                <stop offset="1" stop-color="#ff2e6e" />
              </linearGradient>
            </defs>
            <path d="M4 30C24 30 24 10 44 10S64 30 84 30 104 10 124 10 144 30 164 30 184 10 216 10" />
          </svg>
          <span>{props.via.length > 0 ? i18n.t.planning.legs(props.via.length + 1) : props.includeTracks ? i18n.t.planning.tracks : i18n.t.planning.roads}</span>
        </div>
      {:else if ride}
        <RideSummary {ride} refining={props.refining} onlyOption={props.options.length === 1 && !props.refining} onfocus={showTwisty} legNames={legPlaces.map((place) => place.label)} />
      {:else if showsSavedList && savedList && sidePanel}
        <SavedRides folderId={savedList.folderId} inline onfolder={(folderId) => (savedList = { folderId })} onopen={props.onopensaved} onback={() => (savedList = null)} />
      {:else}
        {#if hasSaved && !editorOpen}
          <button class="saved-entry" onclick={() => (savedList = { folderId: null })}>
            <span class="saved-entry__tile"><RideIcon name="bookmark" /></span>
            <span class="saved-entry__text">
              <span class="saved-entry__name">{i18n.t.saved.heading}</span>
              <span class="saved-entry__meta">{i18n.t.saved.summary(savedRides.store.rides.length, savedRides.store.folders.length)}</span>
            </span>
            <span class="saved-entry__chevron"><RideIcon name="chevron" /></span>
          </button>
        {/if}
        {#if props.history.length > 0 && !editorOpen}
          <RecentTrips bind:peekPx={recentPeekPx} trips={props.history} onpick={props.onpicktrip} onremove={props.onremovetrip} onclear={props.onclearhistory} />
        {/if}
        <div class="intro">
          <!-- Who has ridden before knows what Twisty is for: the title and the paragraph give way to the trips. -->
          {#if props.history.length === 0}
            <h2>{i18n.t.intro.title}</h2>
            <p>{i18n.t.intro.body}</p>
            <p class="tip tip--note" role="note">{i18n.t.intro.safety}</p>
          {/if}
          <p class="tip">{i18n.t.intro.tip(formatNumber(props.twistyCount), window.matchMedia(TOUCH_QUERY).matches)}</p>
          <div class="intro-foot">
          <div class="language" role="group" aria-label={i18n.t.intro.language}>
            {#each Object.entries(LOCALES) as [code, { name }] (code)}
              <button
                class:language--active={code === i18n.locale}
                aria-pressed={code === i18n.locale}
                onclick={() => (i18n.locale = code as Locale)}>{name}</button
              >
            {/each}
          </div>
          <div class="foot-links">
            <button class="credits-link" onclick={() => (credits.open = true)}>{i18n.t.credits.link}</button>
            <span aria-hidden="true">·</span>
            <a class="credits-link" href={PRIVACY_URL} target="_blank" rel="noopener">{i18n.t.credits.privacy.link}</a>
          </div>
          </div>
        </div>
      {/if}
    </div>

    {#if sidePanel && showsRide && ride}
      <div class="actions">
        <RideActions {ride} fromLabel={props.from?.label ?? ''} toLabel={props.to?.label ?? ''} {gpxName} showPinsNote={props.showPinsNote} onhandover={props.onhandover} {places} dataAt={props.dataAt} />
      </div>
    {/if}
  </div>

  <!-- Room for the pinned footer, which sits over the bottom of the sheet; it also keeps the home indicator clear. -->
  <div
    class="foot-space"
    class:foot-space--footer={showsRide && !sidePanel}
    style:height={showsRide && !sidePanel && footerPx > 0 ? `${footerPx}px` : null}
    bind:offsetHeight={footSpacePx}
  ></div>
</aside>

<!-- Outside the sheet, so it stays put while the sheet slides: the main button is always one thumb away. -->
{#if !sidePanel && showsRide && ride && !editorOpen}
  <div class="footer" use:sheetDrag.handle bind:offsetHeight={footerPx}>
    <RideActions
      {ride}
      fromLabel={props.from?.label ?? ''}
      toLabel={props.to?.label ?? ''}
      {gpxName}
      showPinsNote={props.showPinsNote}
      onwarning={() => (snapName = 'full')}
      onhandover={props.onhandover}
      {places}
      dataAt={props.dataAt}
    />
  </div>
{/if}

<!-- On the phone the saved rides take the whole screen, as the place search does. -->
{#if showsSavedList && savedList && !sidePanel}
  <SavedRides folderId={savedList.folderId} inline={false} onfolder={(folderId) => (savedList = { folderId })} onopen={props.onopensaved} onback={() => (savedList = null)} />
{/if}

<style>
  .panel {
    position: absolute;
    z-index: 10;
    top: calc(16px + env(safe-area-inset-top));
    left: 16px;
    display: flex;
    flex-direction: column;
    /* As tall as its content, up to the screen: the body scrolls beyond that. */
    max-height: calc(100dvh - 32px - env(safe-area-inset-top));
    width: 400px;
    padding: 20px;
    border-radius: var(--radius-lg);
    background: var(--surface);
    backdrop-filter: blur(22px) saturate(1.3);
    box-shadow: var(--shadow);
    /* Visible so place suggestions can spill over the panel; .body scrolls on its own. */
    overflow: visible;
    animation: enter 0.7s var(--ease-out) both;
  }

  @media (max-width: 1023px) {
    .panel {
      width: 360px;
    }
  }

  .handle,
  .trip,
  .trip-line {
    display: none;
  }

  .head {
    display: flex;
    flex: none;
    flex-direction: column;
  }

  /* Only the body shrinks and scrolls when the sheet runs out of room. */
  header,
  .engine,
  .handle,
  .trip,
  .places,
  .options,
  .headline-slot {
    flex: none;
  }

  .limit,
  .foot-space,
  .footer,
  .editor-bar,
  .editor-list {
    display: none;
  }

  .trip-line {
    align-items: center;
    gap: 8px;
  }

  .trip-line .trip {
    flex: 1;
    min-width: 0;
  }

  .start-over {
    display: grid;
    flex: none;
    place-items: center;
    width: 46px;
    height: 46px;
    border: 0;
    border-radius: 50%;
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text-muted);
  }

  .start-over:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  .trip {
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 46px;
    padding: 0 4px;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    font-weight: 500;
  }

  .trip button {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: var(--touch-target);
    padding: 0 8px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
  }

  .trip svg {
    flex: none;
    color: var(--text-faint);
  }

  .trip__name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .dot {
    flex: none;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font: 700 10px var(--font-display);
  }

  .dot--from {
    background: var(--text);
    color: var(--bg);
  }

  .dot--to {
    background: var(--gradient);
    color: #fff;
  }

  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
  }

  h1 {
    margin: 0;
    font: 700 22px/1 var(--font-display);
    letter-spacing: -0.02em;
  }

  .brand p {
    margin: 4px 0 0;
    font-size: 12.5px;
    color: var(--text-muted);
  }

  .engine {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .engine__bar {
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .engine__bar span {
    display: block;
    height: 100%;
    background: var(--gradient);
    transition: width 0.2s;
  }

  .engine__bar--indeterminate span {
    animation: sweep 1.2s var(--ease-out) infinite;
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(340%);
    }
  }

  .places {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Each place with its own action beside it: the locate button on the start, the swap on the finish. */
  .place-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .place-row > :global(.field) {
    flex: 1;
    min-width: 0;
  }

  /* The stop being dragged lifts: a raised field with an amber edge, a touch larger, over the rows it passes. */
  .place-row--dragged {
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45));
  }

  .place-row--dragged :global(.field) {
    background: var(--surface-sheet-solid);
    box-shadow: inset 0 0 0 1.5px var(--amber);
    transform: scale(1.02);
  }

  /* The rows a dragged stop passes slide aside; the dragged one follows the finger without lag. */
  .place-row--making-room {
    transition: transform 0.15s var(--ease-out);
  }

  .stop-grip {
    touch-action: none;
    cursor: grab;
  }

  /* A fix can take seconds: the button the rider tapped says it is working on it. */
  .row-action--busy {
    color: var(--amber);
    animation: locating 1.2s ease-in-out infinite;
  }

  @keyframes locating {
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .row-action--busy {
      animation: none;
    }
  }

  .row-action {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--text-muted);
    transition: background 0.2s, color 0.2s;
  }

  /* Move and remove: full targets with room between them, so a gloved drag never lands on remove. */
  .stop-tool {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    border: 0;
    background: transparent;
    color: var(--text-faint);
    font-size: 20px;
    line-height: 1;
  }

  .add-stop {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .add-stop__line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .add-stop button.start-over-text {
    color: var(--text-muted);
  }

  .add-stop button {
    display: flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    min-height: var(--touch-target);
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--amber);
    font: 500 14.5px var(--font-ui);
  }

  /* At the cap the button stays readable (3:1 at least), with the reason under it. */
  .add-stop button:disabled {
    color: var(--text-muted);
  }

  .add-stop p {
    margin: 0 6px 4px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.35;
  }

  /* The stops sit on the arrow from A to B, a full touch target wide. */
  .trip__stops {
    flex: none !important;
    flex-direction: row-reverse;
    justify-content: center;
    gap: 4px !important;
    min-width: var(--touch-target);
    padding: 0 6px !important;
    color: var(--text-faint);
    background: linear-gradient(currentColor, currentColor) no-repeat center / calc(100% - 20px) 2px !important;
  }

  .trip__stops i {
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 1.5px var(--bg);
  }

  @media (hover: hover) {
    .row-action:hover {
      background: var(--surface-hover);
      color: var(--text);
    }
  }

  .options {
    margin-top: 6px;
  }

  .body {
    flex: 1;
    min-height: 0;
    margin: 18px -20px -20px;
    padding: 4px 20px 20px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    scrollbar-width: thin;
  }

  .headline-slot {
    margin-top: 18px;
  }

  /* The summary's own top margin adds up to the gap the slider needs. */
  .details--ride {
    padding-top: 4px;
  }

  /* While a ride is shown the side panel keeps one height and the main button one place, however long the list is
     while sliding between options; the other states are as tall as their content. */
  @media (min-width: 700px) {
    .panel--trip {
      height: calc(100dvh - 32px - env(safe-area-inset-top));
    }

    .panel--trip .body {
      display: flex;
      flex-direction: column;
    }

    /* The pinned actions follow the details in the flow, so scrolled to the end nothing hides behind them; the padding
       keeps the last card from touching the bar. */
    .panel--trip .details {
      flex: 1 0 auto;
      padding-bottom: 12px;
    }

    /* The body has no bottom padding, so the pinned main button reaches the panel's edge; the space under the last
       content comes from the spacer after it. The auto top margin keeps the button at the bottom while the content
       is short. */
    .body {
      padding-bottom: 0;
    }

    .body::after {
      content: '';
      display: block;
      height: 20px;
    }

    .actions {
      position: sticky;
      bottom: 0;
      margin: auto -20px -20px;
      padding: 32px 20px 20px;
      background: linear-gradient(to top, var(--surface-sheet-solid) calc(100% - 24px), transparent);
    }
  }

  .intro h2 {
    margin: 4px 0 8px;
    font: 600 20px var(--font-display);
    letter-spacing: -0.01em;
  }

  .intro p {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--text-muted);
  }

  .intro p + .tip {
    margin-top: 8px;
  }

  .intro .tip {
    font-size: 12.5px;
    color: var(--text-faint);
  }

  /* The one tip a rider must read: legible, still quieter than the body. */
  .intro .tip--note {
    color: var(--text-quiet);
  }

  .intro-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
  }

  .language {
    display: flex;
    gap: 4px;
  }

  .language button,
  .credits-link {
    position: relative;
    padding: 5px 10px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--text-faint);
    font-size: 12.5px;
    font-weight: 500;
    transition: background 0.2s, color 0.2s;
  }

  /* 25 px to look at, 44 px to hit. */
  .language button::before,
  .credits-link::before {
    content: '';
    position: absolute;
    inset: -10px -2px;
  }

  @media (hover: hover) {
    .language button:hover,
    .credits-link:hover {
      color: var(--text-muted);
    }
  }

  .credits-link {
    border: 0;
    background: transparent;
    text-decoration: none;
  }

  .foot-links {
    display: flex;
    align-items: center;
    color: var(--text-faint);
    font-size: 12.5px;
  }

  .language .language--active {
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text);
  }

  .planning {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 0 8px;
    font-size: 14px;
    color: var(--text-muted);
  }

  .planning svg {
    width: 200px;
    overflow: visible;
  }

  .planning path {
    fill: none;
    stroke: url(#planning-gradient);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-dasharray: 60 300;
    filter: drop-shadow(0 0 6px rgba(255, 46, 110, 0.6));
    animation: ride 1.6s linear infinite;
  }

  .error p {
    margin: 0;
  }

  .error button {
    margin-top: 10px;
    padding: 0 14px;
    height: var(--touch-target);
    border: 0;
    border-radius: 999px;
    background: rgba(255, 46, 110, 0.14);
    color: #ffb3c7;
    font-size: 14px;
    font-weight: 500;
  }

  .error {
    padding: 14px 16px;
    border-radius: var(--radius-md);
    background: rgba(255, 46, 110, 0.08);
    box-shadow: inset 0 0 0 1px rgba(255, 46, 110, 0.3);
    color: #ff8fab;
    font-size: 14px;
  }

  .error--editing {
    margin-bottom: 8px;
  }

  @keyframes ride {
    from {
      stroke-dashoffset: 360;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }

  /* The phone sheet is one full-height layer that only ever moves by transform: the snaps never change its size, so
     dragging it costs no layout. What shows is its top part, the rest is below the screen. */
  @media (max-width: 699px) {
    .panel,
    .footer {
      --footer-h: calc(76px + env(safe-area-inset-bottom));
    }

    .panel {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: auto;
      height: var(--app-height, 100dvh);
      max-height: none;
      padding: 0;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      /* Solid: without the blur, map labels would show through a translucent sheet. */
      background: var(--surface-sheet-solid);
      /* The blur costs 50-70 MB of GPU memory on a full-width sheet (measured on the Huawei P smart 2019), which risks
         a lost WebGL context there; a nearly opaque surface keeps the look without it. */
      backdrop-filter: none;
      will-change: transform;
      animation: none;
    }

    .panel--animated {
      transition: transform 0.3s var(--ease-out);
    }

    .panel--dragging {
      transition: none;
    }

    /* These parts hand their vertical touches to the sheet instead of the browser. */
    .handle,
    .panel--trip .trip,
    .headline-slot {
      touch-action: none;
    }

    .limit {
      display: block;
      position: absolute;
      top: 0;
      width: 0;
      height: calc(100% - env(safe-area-inset-top) - 48px);
      pointer-events: none;
    }

    .panel--trip .places,
    .panel--trip .options {
      display: none;
    }

    .panel--trip .trip,
    .panel--trip .trip-line {
      display: flex;
    }

    .head {
      padding: 0 16px;
    }

    /* The grabber is 32 px tall, with its hit box reaching 12 px above the sheet so a thumb finds it. */
    .handle {
      display: grid;
      position: relative;
      place-items: center;
      height: 32px;
      margin: 0 -16px;
      border: 0;
      background: transparent;
    }

    .handle::before {
      content: '';
      position: absolute;
      inset: -12px 0 0;
    }

    .handle span {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: var(--border-strong);
    }

    /* The place search: the sheet covers the whole screen, with the fields at the top and the options under them. */
    .panel--editor {
      padding-top: calc(env(safe-area-inset-top) + 8px);
      border-radius: 0;
      background: var(--surface-sheet-solid);
    }

    .panel--editor .handle,
    .panel--editor .trip,
    .panel--editor .headline-slot,
    .panel--editor .body,
    .panel--editor .foot-space,
    .panel--editor .options--hidden {
      display: none;
    }

    .panel--editor .editor-bar {
      display: flex;
      align-items: center;
      height: var(--touch-target);
      margin: 0 -8px;
    }

    .back {
      display: grid;
      place-items: center;
      width: var(--touch-target);
      height: var(--touch-target);
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text);
    }

    .panel--editor .editor-bar,
    .panel--editor .places,
    .panel--editor .options {
      animation: editor-in 0.16s var(--ease-out) 0.06s both;
    }

    .here {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 52px;
      padding: 9px 11px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--amber);
      font-size: 15px;
      font-weight: 500;
      text-align: left;
    }

    .editor-list {
      display: block;
      flex: 1;
      min-height: 0;
      margin-top: 8px;
      padding: 0 16px var(--keyboard-inset, 0px);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }

    @keyframes editor-in {
      from {
        opacity: 0;
      }
    }

    header {
      display: none;
    }

    .headline-slot {
      margin-top: 8px;
      padding-bottom: 12px;
    }

    .body {
      flex: none;
      max-height: var(--body-max);
      margin: 0;
      padding: 0 16px;
      border-radius: 0;
      overflow-y: hidden;
    }

    .body--scroll {
      overflow-y: auto;
    }

    .details {
      padding-bottom: 16px;
    }

    .foot-space {
      display: block;
      height: calc(12px + env(safe-area-inset-bottom));
    }

    .foot-space--footer {
      height: var(--footer-h);
    }

    .footer {
      display: block;
      touch-action: none;
      position: fixed;
      z-index: 11;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 10px 16px calc(12px + env(safe-area-inset-bottom));
      /* Opaque, so the sheet's content slides under it instead of showing through. */
      background: var(--surface-sheet-solid);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel--animated {
      transition: none;
    }
  }

  /* One quiet row above the recent trips: the rider's own library, there once something is saved. */
  .saved-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 58px;
    margin: 6px 0 0;
    padding: 6px 0;
    border: 0;
    border-bottom: 1px solid var(--border);
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
  }

  .saved-entry__tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--surface-raised);
    color: var(--amber);
  }

  .saved-entry__text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .saved-entry__name {
    font: 500 15px var(--font-ui);
  }

  .saved-entry__meta {
    margin-top: 2px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .saved-entry__chevron {
    flex: none;
    color: var(--text-muted);
    transform: rotate(-90deg);
  }

  @media (hover: hover) {
    .saved-entry:hover .saved-entry__name {
      color: var(--amber);
    }
  }
</style>
