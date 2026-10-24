<script lang="ts">
  import CreditsSheet from './components/CreditsSheet.svelte'
  import MapView from './components/MapView.svelte'
  import Panel from './components/Panel.svelte'
  import Toast from './components/Toast.svelte'
  import { type AppError, type FailedAt, PlanningError } from './lib/errors'
  import { credits } from './lib/creditsState.svelte'
  import type { LonLat } from './lib/geo'
  import { untrack } from 'svelte'
  import { type LocationProblem, locateRider, locationProblem, permissionAsk, placeHere, riderPosition, type RiderFix } from './lib/locate'
  import { loadPlaceIndex, type Place } from './lib/geocoding'
  import { i18n } from './lib/i18n/i18n.svelte'
  import { PlannerClient } from './lib/planner/plannerClient'
  import type { RideOption, RideTwisty } from './lib/routing/ride'
  import { rideOfSaved, type SavedPlace } from './lib/savedRide'
  import { savedRides } from './lib/savedRidesState.svelte'
  import { stopsHidden } from './lib/shortTrip'
  import { refreshInstalledApps } from './lib/openIn/openInState.svelte'
  import {
    historyPlace,
    type HistoryTrip,
    loadHistory,
    needsHere,
    recordHandedOver,
    recordPlanned,
    removeTrip,
    restoreTrips,
    restoreTrip,
    saveHistory,
    type TripInput,
  } from './lib/tripHistory'
  import { tracksFor } from './lib/offRoad'
  import { clearToast, showToast, toasts } from './lib/toastState.svelte'
  import { twistyCaption } from './lib/curves'
  import { formatKm } from './lib/format'
  import { isSidePanel } from './lib/layout'
  import { BUILD, type Drag, everyFrame, loadScrubMemory, nextFrame, rememberDrag, saveScrubMemory, startDrag } from './lib/scrubMode'
  import { loadTrip, saveTrip, takeTrip } from './lib/tripStorage'
  import { distinctStops, endAtStop, insertionIndex, withoutStopAt } from './lib/via'
  import { MAX_VIA } from './lib/googleMaps'

  // The slider opens on the twistiest option that costs at most this much extra time.
  const DEFAULT_EXTRA_S = 45 * 60

  // Android may kill the app while the rider is in another app: bring the ride just handed over back and plan it again.
  // Any other launch opens on the start screen, with the recent trips.
  const restored = loadTrip(Date.now())
  /** A trip's identity for the slider stop to open on: its points in order and the tracks switch. */
  const tripKey = (points: LonLat[], tracks: boolean) => `${points.join(';')}|${tracks}`
  const positions = (start: Place, stops: Place[], finish: Place) => [start, ...stops, finish].map((place) => place.position)
  /**
   * The slider stop to open on when the trip with this key is planned: the one the rider had chosen before, or for a
   * saved ride planned again the one nearest its extra time.
   */
  let wantedStop: { key: string; selected: number } | { key: string; extraS: number } | null =
    restored?.from && restored.to ? { key: tripKey(positions(restored.from, restored.via, restored.to), restored.includeTracks), selected: restored.selected } : null

  let from = $state<Place | null>(restored?.from ?? null)
  let to = $state<Place | null>(restored?.to ?? null)
  /** The rider's stops between start and finish, in riding order. */
  let via = $state<Place[]>(restored?.via ?? [])
  let includeTracks = $state(tracksFor(restored?.includeTracks ?? false))
  let options = $state.raw<RideOption[]>([])
  let selected = $state(0)
  // A drag the phone could not keep up with in full: the map swaps the rides it passes and leaves the camera alone until
  // the release.
  let lightScrub = $state(false)
  let scrubMemory = loadScrubMemory(BUILD)
  let endDrag: (() => void) | undefined
  /** The rider asked to see the stops of a very short trip; asked again for every trip. */
  let revealStops = $state(false)
  let locating = $state(false)
  /** The rider's last fix, from either way of asking for it; never stored or sent. */
  let rider = $state.raw<RiderFix | null>(null)
  /** Why the last ask for the rider's position for the trip failed, and how to ask again; gone once the start changes. */
  let locationTrouble = $state.raw<{ problem: LocationProblem; retry: () => void } | null>(null)
  $effect(() => {
    void from
    untrack(() => (locationTrouble = null))
  })
  /** The map asks the rider where to put an end or a stop: a crosshair over the map's centre, confirmed by a tap. */
  let mapPick = $state<{ role: 'from' | 'to' | 'via'; index?: number } | null>(null)
  /** Changes with every plan result, so the map knows a new route from a step of the slider. */
  let planKey = $state(0)
  let ridesPlanned = $state(0)
  let planning = $state(false)
  /** The fastest ride is on screen while the other options are still being searched. */
  let refining = $state(false)
  const hidesStops = $derived(stopsHidden(options, refining, revealStops))
  // A trip that hides its stops is its fastest ride alone, for the map, the hand-off and the saved trip as well.
  const shownOptions = $derived(hidesStops ? options.slice(0, 1) : options)
  const shownSelected = $derived(hidesStops ? 0 : selected)
  let error = $state<AppError | null>(null)
  /** Where the trip failed, when it has stops: the leg with no road, or the point far from any. */
  let errorAt = $state<FailedAt>({})
  let loadProgress = $state<number | null>(0)
  let engineReady = $state(false)
  let twistyCount = $state(0)
  let focus = $state.raw<LonLat[] | null>(null)
  let mapCenter = $state.raw<LonLat>([-3.7, 40.2])
  let coveredHeight = $state(0)
  let footClearance = $state(0)
  let listOpen = $state(false)
  let history = $state.raw<HistoryTrip[]>(loadHistory())
  let dataAt = $state<string | null>(null)
  /** The saved ride on screen, by id: renaming or moving it shows at once, removing it closes it. */
  let savedId = $state<string | null>(null)
  const savedView = $derived(savedId === null ? null : (savedRides.store.rides.find((ride) => ride.id === savedId) ?? null))
  const savedOption = $derived(savedView && rideOfSaved(savedView))
  /** The ride the map draws: the saved one on screen, or the stop of the slider. */
  const mapRide = $derived(savedOption ?? shownOptions[shownSelected] ?? null)
  /** A twisty tapped on the map, for the list to show; a new object on each tap, so a second tap shows it again. */
  let tappedTwisty = $state<{ number: number } | null>(null)
  const savedPlace = (place: SavedPlace): Place => ({ label: place.label, position: place.position })
  /** Changes with every saved ride opened, so the map frames it as a new route. */
  let savedKey = $state(0)

  const planner = new PlannerClient({
    onProgress: (fraction) => (loadProgress = fraction),
    onReady: () => (engineReady = true),
    onError: (code) => (error = code),
  })

  // Apps come and go while Twisty is in the background (the rider installs OsmAnd, then comes back).
  $effect(() => {
    void refreshInstalledApps()
    const refreshWhenVisible = () => document.visibilityState === 'visible' && void refreshInstalledApps()
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible)
  })

  loadPlaceIndex()
  fetch(`${import.meta.env.BASE_URL}data/meta.json`)
    .then((response) => response.json())
    .then((meta) => {
      twistyCount = meta.twisties
      dataAt = meta.generatedAt ?? null
    })

  $effect(() => {
    document.documentElement.lang = i18n.locale
    document.title = i18n.t.documentTitle
  })

  /** The ride on screen as a trip, or null when there is none to keep. */
  function currentTrip(): TripInput | null {
    if (!from || !to || options.length === 0 || error) return null
    return { from: historyPlace(from), to: historyPlace(to), via: via.map(historyPlace), includeTracks, selected: shownSelected, at: Date.now() }
  }

  function commitHistory(list: HistoryTrip[]) {
    history = list
    saveHistory(list)
  }

  function handOver() {
    if (savedView) return
    const trip = currentTrip()
    if (!trip || !from || !to) return
    saveTrip({ from, to, via, includeTracks, selected: shownSelected, at: trip.at })
    commitHistory(recordHandedOver(history, trip))
  }

  // A rider who plans in the evening and leaves in the morning has handed nothing over by the time the app closes.
  function leaveRide() {
    if (savedView) return
    const trip = currentTrip()
    if (trip) commitHistory(recordPlanned(history, trip))
  }

  $effect(() => {
    const leaveWhenHidden = () => document.visibilityState === 'hidden' && leaveRide()
    document.addEventListener('visibilitychange', leaveWhenHidden)
    window.addEventListener('pagehide', leaveRide)
    return () => {
      document.removeEventListener('visibilitychange', leaveWhenHidden)
      window.removeEventListener('pagehide', leaveRide)
    }
  })

  let latestRequest = 0
  /** The stops that make a leg: one on the place before it, or on the finish, plans nothing and is left out. */
  const stops = $derived(from && to ? distinctStops(from, via, to) : [])
  $effect(() => {
    // A start and a finish on the same place with nothing between are no trip (a loop needs a stop).
    const loopWithoutStop = from && to && stops.length === 0 && from.position.join() === to.position.join()
    if (!from || !to || loopWithoutStop) {
      // A plan still in flight must not answer for a trip that lost an end: its ride would reappear under an empty field.
      latestRequest++
      planning = false
      refining = false
      error = null
      options = []
      return
    }
    const points = $state.snapshot(positions(from, stops, to)) as LonLat[]
    if (undone?.key === tripKey(points, includeTracks)) return restoreRide(undone)
    plan(points, includeTracks, from.here === true)
  })

  /** What Start over clears and Undo puts back. */
  interface ClearedTrip {
    from: Place | null
    to: Place | null
    via: Place[]
    includeTracks: boolean
    options: RideOption[]
    planKey: number
    selected: number
    revealStops: boolean
  }

  /** A ride brought back by Undo after Start over, with its options: it was planned already, so it is not again. */
  let undone: (Pick<ClearedTrip, 'options' | 'planKey' | 'selected' | 'revealStops'> & { key: string }) | null = null

  function restoreRide(ride: NonNullable<typeof undone>) {
    undone = null
    options = ride.options
    planKey = ride.planKey
    selected = ride.selected
    revealStops = ride.revealStops
  }

  /**
   * Clears the trip and its ride; the camera stays, as the next trip is usually nearby. The ride goes to Recent trips,
   * and the ride handed over is taken out of storage, or a restart would bring it back; Undo puts both back as they were.
   */
  function startOver(anchor: HTMLElement | null) {
    const trip = currentTrip()
    if (trip) commitHistory(recordPlanned(history, trip))
    const handed = takeTrip(Date.now())
    const before: ClearedTrip = { from, to, via, includeTracks, options, planKey, selected, revealStops }
    from = null
    to = null
    via = []
    focus = null
    showToast(i18n.t.panel.rideCleared, anchor ?? document.querySelector<HTMLElement>('aside.panel'), {
      action: { label: i18n.t.saved.undo, run: () => undoStartOver(before, handed) },
    })
  }

  function undoStartOver(before: ClearedTrip, handed: ReturnType<typeof takeTrip>) {
    if (handed) saveTrip(handed)
    if (before.from && before.to && before.options.length > 0) {
      const points = positions(before.from, distinctStops(before.from, before.via, before.to), before.to)
      const { options, planKey, selected, revealStops } = before
      undone = { key: tripKey(points, before.includeTracks), options, planKey, selected, revealStops }
    }
    includeTracks = before.includeTracks
    via = before.via
    from = before.from
    to = before.to
  }

  async function plan(points: LonLat[], tracks: boolean, startIsRider: boolean) {
    const request = ++latestRequest
    planning = true
    refining = false
    revealStops = false
    error = null
    errorAt = {}
    let fastest: RideOption | undefined
    try {
      const result = await planner.plan(points, { includeTracks: tracks, startIsRider }, (option) => {
        if (request !== latestRequest) return
        fastest = option
        options = [option]
        planKey = request
        selected = 0
        focus = null
        planning = false
        refining = true
      })
      if (request !== latestRequest) return
      // The fastest option is the same ride: keeping the object stops the map drawing it all over again.
      options = fastest ? [fastest, ...result.slice(1)] : result
      planKey = request
      const wanted = wantedStop?.key === tripKey(points, tracks) ? wantedStop : null
      const keepsWantedStop = wanted !== null && ('extraS' in wanted || wanted.selected < result.length)
      selected = !wanted || !keepsWantedStop ? defaultOption(result) : 'extraS' in wanted ? nearestOption(result, wanted.extraS) : wanted.selected
      // A stop the rider had chosen on a short trip is one they asked to see.
      if (keepsWantedStop && selected > 0) revealStops = true
      wantedStop = null
      focus = null
      ridesPlanned++
    } catch (failure) {
      if (request !== latestRequest) return
      error = failure instanceof PlanningError ? failure.code : 'unexpected'
      errorAt = failure instanceof PlanningError ? failure.at : {}
      // A trip with stops that fails is shown whole, so the stop at fault is in view.
      if (points.length > 2) focus = points
    } finally {
      if (request === latestRequest) {
        planning = false
        refining = false
      }
    }
  }

  function nearestOption(result: RideOption[], extraS: number): number {
    return result.reduce((best, option, index) => (Math.abs(option.extraS - extraS) < Math.abs(result[best].extraS - extraS) ? index : best), 0)
  }

  function defaultOption(result: RideOption[]): number {
    const affordable = result.findLastIndex((option) => option.extraS <= DEFAULT_EXTRA_S)
    return Math.max(0, affordable)
  }

  async function pickOnMap(role: 'from' | 'to' | 'via', position: LonLat, index?: number) {
    // A pick on a saved ride edits the saved ride's trip, not the one the fields held before it was opened.
    leaveSaved()
    const place = (await loadPlaceIndex()).describe(position, i18n.t.places.nearPlace)
    if (role !== 'via') return changeEnd(role, place)
    if (!from || !to) return
    // A stop field chosen on the map keeps its place among the stops.
    if (index !== undefined && index < via.length) return changeVia(via.map((stop, i) => (i === index ? place : stop)))
    if (via.length >= MAX_VIA) return
    // A stop dropped on the map goes where it lengthens the trip least; the rider can move it in the fields.
    const at = insertionIndex(positions(from, via, to), place.position)
    changeVia([...via.slice(0, at), place, ...via.slice(at)])
  }

  /** A pin dragged on the map; the one pin of a loop takes both ends along, so the trip stays a loop. */
  async function movePin(pin: 'from' | 'to' | 'loop', position: LonLat) {
    if (pin !== 'loop') return pickOnMap(pin, position)
    leaveSaved()
    const place = (await loadPlaceIndex()).describe(position, i18n.t.places.nearPlace)
    from = place
    to = place
  }

  /** A stop tapped on the map, removed or made the finish; Undo puts the trip back as it was. */
  function stopOnMap(action: 'remove' | 'finish', position: LonLat) {
    leaveSaved()
    const stop = endAtStop(via, position)
    if (!stop || !to) return
    const before = { to, via }
    if (action === 'remove') via = withoutStopAt(via, position)
    else ({ via, to } = stop)
    const message = action === 'remove' ? i18n.t.via.removed(stop.to.label) : i18n.t.map.finishMoved(stop.to.label)
    showToast(message, document.querySelector<HTMLElement>('aside.panel'), {
      action: {
        label: i18n.t.saved.undo,
        run: () => {
          leaveSaved()
          ;({ via, to } = before)
        },
      },
    })
  }

  /** The rider's position, or null after saying why there is none under the start, with `retry` to ask again. */
  async function locate(retry: () => void): Promise<Place | null> {
    locating = true
    try {
      rider = await locateRider(riderPosition(), permissionAsk())
      locationTrouble = null
      return placeHere(rider, i18n.t.places.myLocation)
    } catch (failure) {
      locationTrouble = { problem: await locationProblem(failure), retry }
      return null
    } finally {
      locating = false
    }
  }

  /** The map's own "where am I": the trip stays as it is, so a failure is the map's to tell. */
  async function locateOnMap(): Promise<RiderFix | LocationProblem> {
    try {
      rider = await locateRider(riderPosition(), permissionAsk())
      return rider
    } catch (failure) {
      return locationProblem(failure)
    }
  }

  async function locateStart() {
    const here = await locate(locateStart)
    if (here) changeEnd('from', here)
  }

  function confirmMapPick(position: LonLat) {
    if (!mapPick) return
    const { role, index } = mapPick
    mapPick = null
    void pickOnMap(role, position, index)
  }

  /**
   * One tap on a recent trip: its places are filled, the trip is planned and the slider opens where the rider left it.
   * A trip with a "here" end waits for one position, used for both ends of a loop; the fields change only then, so the
   * previous trip is not planned with half of this one.
   */
  function openTrip(trip: HistoryTrip) {
    includeTracks = tracksFor(trip.includeTracks)
    const plan = (places: ReturnType<typeof restoreTrip>) => {
      if (!places) return
      wantedStop = { key: tripKey(positions(places.from, places.via, places.to), trip.includeTracks), selected: trip.selected }
      via = places.via
      from = places.from
      to = places.to
    }
    if (needsHere(trip)) locate(() => openTrip(trip)).then((here) => plan(restoreTrip(trip, here)))
    else plan(restoreTrip(trip, null))
  }

  function openSaved(id: string) {
    savedId = id
    savedKey--
    focus = null
  }

  /** The saved ride's trip goes into the fields and is planned with today's roads; the saved ride itself stays. */
  function planAgain() {
    if (!savedView) return
    const start = savedPlace(savedView.from)
    const finish = savedPlace(savedView.to)
    const stops = savedView.via.map(savedPlace)
    wantedStop = { key: tripKey(positions(start, stops, finish), false), extraS: savedView.ride.extraS }
    includeTracks = false
    savedId = null
    via = stops
    from = start
    to = finish
  }

  /** Editing a saved ride on screen (an end, the swap, a pick on the map) starts from its trip, as Plan again does. */
  function leaveSaved() {
    if (!savedView) return
    from = savedPlace(savedView.from)
    to = savedPlace(savedView.to)
    via = savedView.via.map(savedPlace)
    includeTracks = false
    savedId = null
  }

  function changeEnd(role: 'from' | 'to', place: Place | null) {
    leaveSaved()
    if (role === 'from') from = place
    else to = place
  }

  function changeVia(list: Place[]) {
    leaveSaved()
    via = list
  }

  /** The whole trip backwards: the finish first, the stops in reverse, the start last. */
  function swap() {
    leaveSaved()
    ;[from, to] = [to, from]
    via = [...via].reverse()
  }

  function forgetTrip(index: number) {
    forgetTrips(removeTrip(history, index), i18n.t.history.removed)
  }

  /** Recent trips go at once, as the rider asked, and come back with Undo for a few seconds. */
  function forgetTrips(left: HistoryTrip[], message: string) {
    const before = history
    commitHistory(left)
    showToast(message, document.querySelector<HTMLElement>('aside.panel'), {
      action: { label: i18n.t.saved.undo, run: () => commitHistory(restoreTrips(history, before)) },
    })
  }

  function scrub(active: boolean) {
    endDrag?.()
    endDrag = active ? measureDrag() : undefined
  }

  function measureDrag(): () => void {
    let drag: Drag = startDrag(scrubMemory)
    lightScrub = drag.light
    const stop = everyFrame((deltaMs) => {
      drag = nextFrame(drag, deltaMs)
      lightScrub = drag.light
    })
    return () => {
      stop()
      lightScrub = false
      scrubMemory = rememberDrag(scrubMemory, drag)
      saveScrubMemory(scrubMemory)
    }
  }

  function select(index: number) {
    selected = index
    focus = null
  }

  function focusTwisty(twisty: RideTwisty) {
    focus = [...twisty.line]
  }

  /**
   * A twisty tapped on the map: the map shows it whole. Beside the map the list brings its row into view; on the phone
   * the sheet stays as it is, so the map stays in view, and a toast names the twisty as its row does.
   */
  function showTappedTwisty(number: number) {
    const twisty = mapRide?.twisties[number - 1]
    if (!twisty) return
    focusTwisty(twisty)
    if (isSidePanel()) tappedTwisty = { number }
    else showToast(twistyCaption(number, twisty, i18n.t.ride, formatKm), document.querySelector<HTMLElement>('aside.panel'), { kind: 'info' })
  }
</script>

<main>
  <MapView
    ride={mapRide}
    planKey={savedOption ? savedKey : planKey}
    from={savedView ? savedView.from.position : (from?.position ?? null)}
    to={savedView ? savedView.to.position : (to?.position ?? null)}
    stops={savedView ? savedView.via : stops}
    {focus}
    scrubbing={lightScrub}
    onpick={pickOnMap}
    onmove={(center) => (mapCenter = center)}
    {coveredHeight}
    {footClearance}
    planning={(planning || error !== null) && !savedView}
    stopsCapped={(savedView?.via ?? via).length >= MAX_VIA}
    failed={error !== null && !savedView}
    {listOpen}
    {rider}
    onlocate={locateOnMap}
    picking={mapPick?.role ?? null}
    onpickhere={confirmMapPick}
    oncancelpick={() => (mapPick = null)}
    onmovepin={movePin}
    ontwisty={showTappedTwisty}
    onstop={stopOnMap}
  />
  <Panel
    from={savedView ? savedPlace(savedView.from) : from}
    to={savedView ? savedPlace(savedView.to) : to}
    via={savedView ? savedView.via.map(savedPlace) : via}
    onvia={changeVia}
    {includeTracks}
    searchCenter={mapCenter}
    bind:coveredHeight
    bind:footClearance
    bind:listOpen
    options={savedOption ? [savedOption] : shownOptions}
    selected={savedOption ? 0 : shownSelected}
    stopsHidden={hidesStops && !savedView}
    onshowstops={() => (revealStops = true)}
    showPinsNote={ridesPlanned <= 1}
    planning={planning && !savedView}
    refining={refining && !savedView}
    error={savedView ? null : error}
    {errorAt}
    {loadProgress}
    {engineReady}
    {twistyCount}
    onfrom={(place) => changeEnd('from', place)}
    onto={(place) => changeEnd('to', place)}
    onswap={swap}
    onstartover={startOver}
    ontracks={(include) => (includeTracks = include)}
    onlocate={locateStart}
    {locating}
    locationProblem={locationTrouble?.problem ?? null}
    onretrylocate={() => locationTrouble?.retry()}
    onchooseonmap={(role, index) => (mapPick = { role, index })}
    onselect={select}
    onscrub={scrub}
    onfocus={focusTwisty}
    {tappedTwisty}
    {history}
    onpicktrip={(index) => openTrip(history[index])}
    onremovetrip={forgetTrip}
    onclearhistory={() => forgetTrips([], i18n.t.history.cleared)}
    onhandover={handOver}
    {savedView}
    onopensaved={(ride) => openSaved(ride.id)}
    onclosesaved={() => (savedId = null)}
    onplanagain={planAgain}
    {dataAt}
  />
</main>

{#if credits.open}<CreditsSheet onclose={() => (credits.open = false)} />{/if}

{#key toasts.shown?.id}
  {#if toasts.shown}
    <Toast message={toasts.shown.message} anchor={toasts.shown.anchor} below={toasts.shown.below} action={toasts.shown.action} kind={toasts.shown.kind} ondone={clearToast} />
  {/if}
{/key}

<style>
  main {
    position: relative;
    height: 100%;
    overflow: hidden;
  }
</style>
