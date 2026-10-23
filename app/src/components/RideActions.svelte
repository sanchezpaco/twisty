<script lang="ts">
  import { formatKm } from '../lib/format'
  import { loadPlaceIndex, type Place } from '../lib/geocoding'
  import { gpxIsPrimary } from '../lib/gpxPrimary'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { isSidePanel } from '../lib/layout'
  import { buttonLabel, type OpenInTarget, resolveOpenIn, targetName } from '../lib/openIn/openIn'
  import { choice, installed, rememberTarget } from '../lib/openIn/openInState.svelte'
  import type { RideOption } from '../lib/routing/ride'
  import { AppRejected, openRideInApp, shareRideGpx } from '../lib/rideExport'
  import { canShareGpx } from '../lib/shareFile'
  import { isSameRide, type SavedPlace, savedRideOf } from '../lib/savedRide'
  import { addFolder, addRide, deleteRide, moveRide, renameRide, type SavedStore } from '../lib/savedRides'
  import { changeSaved, rememberFolder, savedRides } from '../lib/savedRidesState.svelte'
  import { rideShareText, sharesRiderPosition } from '../lib/shareRide'
  import { shareText } from '../lib/shareText'
  import { showToast } from '../lib/toastState.svelte'
  import OpenInSheet from './OpenInSheet.svelte'
  import SaveRideSheet, { type FolderChoice } from './SaveRideSheet.svelte'
  import ShareHereSheet from './ShareHereSheet.svelte'
  import RideIcon from './RideIcon.svelte'

  interface Props {
    ride: RideOption
    /** The ends of the trip as the rider sees them, for the text a friend receives. */
    fromLabel: string
    toLabel: string
    /** GPX file name, e.g. `twisty-valencia-los-santos.gpx`. */
    gpxName: string
    /** Reassurance about the Google Maps pins, worth reading once rather than on every ride. */
    showPinsNote: boolean
    /** Where the track line leads: the full warning. Without it the line is plain text. */
    onwarning?: () => void
    /** The ride went to another app: it is the trip the rider means to ride. */
    onhandover: () => void
    /** The trip's ends, which a saved ride keeps; null while they are not both set. */
    places: { from: Place; to: Place; via: Place[] } | null
    /** `generatedAt` of the data the ride was planned with. */
    dataAt: string | null
  }

  let { ride, fromLabel, toLabel, gpxName, showPinsNote, onwarning, onhandover, places, dataAt }: Props = $props()

  let sheetOpen = $state(false)
  let failedApp = $state<string | null>(null)
  let line = $state<HTMLElement | null>(null)
  /** The save sheet, with the name it starts from. */
  let saveSheet = $state<{ name: string } | null>(null)
  let shareWarning = $state(false)

  const nameOf = (target: OpenInTarget) => (target.kind === 'app' ? target.label : target.kind === 'maps' ? 'Google Maps' : i18n.t.openIn.otherApp)

  const sharesFiles = canShareGpx()

  // A ride with a good deal of track goes to an app that follows a line: Google Maps would skip it.
  const gpxFirst = $derived(gpxIsPrimary(ride))
  // Google Maps saved as the choice still asks on a ride it cannot ride whole (tracks, or twisties left unpinned).
  const decision = $derived(resolveOpenIn(choice.target, installed.apps, { gpxFirst: gpxFirst || !ride.pinnedAll }))
  const opensMaps = $derived(decision.action === 'open' && decision.target.kind === 'maps')
  const label = $derived(buttonLabel(decision.action === 'open' ? decision.target : null, i18n.t.openIn, sharesFiles))
  const handsToMaps = $derived(ride.twisties.length > 0 && !gpxFirst && (decision.action === 'choose' || opensMaps))
  // The reassurance only when it is true; when Google Maps could not get every twisty's pins, the rider is told, every time.
  const pinsNoteShown = $derived(showPinsNote && handsToMaps && ride.pinnedAll)
  const pinsPartialShown = $derived(handsToMaps && !ride.pinnedAll)
  const savedRide = $derived(places ? savedRides.store.rides.find((saved) => isSameRide(saved, ride, places.from, places.to, places.via)) : undefined)
  // With an app chosen the line holds four buttons: the main one names only where it goes, so it never ellipsises.
  const ctaLabel = $derived(decision.action === 'open' ? targetName(decision.target, i18n.t.openIn, sharesFiles) : label)

  async function openIn(target: OpenInTarget) {
    if (target.kind === 'maps') return onhandover()
    try {
      const stops = places?.via ?? []
      if (target.kind === 'share') await shareRideGpx(ride, gpxName, stops)
      else await openRideInApp(ride, gpxName, target.packageName, stops)
      onhandover()
    } catch (error) {
      console.error(error)
      if (target.kind !== 'app') return
      failedApp = targetName(target, i18n.t.openIn, sharesFiles)
      // Only an app that refused the file is forgotten; failing to write the file says nothing about the app.
      if (error instanceof AppRejected) rememberTarget(null)
      sheetOpen = true
    }
  }

  function picked(target: OpenInTarget, remember: boolean) {
    sheetOpen = false
    // Unticked: the rider wants to be asked every time, so a choice made earlier goes.
    if (remember) rememberTarget(target)
    else if (choice.target) rememberTarget(null)
    void openIn(target)
  }

  function openSheet() {
    failedApp = null
    sheetOpen = true
  }

  function share() {
    if (sharesRiderPosition(places?.to)) shareWarning = true
    else void shareRide()
  }

  /** The system share sheet with the ride as text; where there is none the text is copied, and a toast says so. */
  async function shareRide() {
    shareWarning = false
    const { t } = i18n
    const result = await shareText({ title: t.share.title(fromLabel, toLabel), text: rideShareText(ride, fromLabel, toLabel, t, places?.via.map((stop) => stop.label)), dialogTitle: t.share.dialogTitle })
    if (result === 'cancelled') return
    // The system sheet is its own feedback; only the clipboard needs a word.
    if (result !== 'shared') showToast(result === 'copied' ? t.share.copied : t.share.copyFailed, line, { kind: result === 'copied' ? 'done' : 'problem' })
    // A ride sent to a friend is a ride the rider means to ride.
    if (result !== 'copyFailed') onhandover()
  }

  /** A place as a saved ride keeps it: the rider's own position is named after the town it lies in. */
  async function savedPlace(place: Place): Promise<SavedPlace> {
    const label = place.here ? (await loadPlaceIndex()).describe(place.position).label : place.label
    return { label, position: place.position }
  }

  async function openSaveSheet() {
    if (savedRides.readOnly) return showToast(i18n.t.saved.notSaved[savedRides.readOnly], line, { kind: 'problem' })
    if (savedRide) return (saveSheet = { name: savedRide.name })
    if (!places) return
    const [from, to] = await Promise.all([savedPlace(places.from), savedPlace(places.to)])
    saveSheet = { name: `${from.label} → ${to.label}` }
  }

  /** On the phone a toast with Undo stands on the sheet's top edge, over the map, so it never covers the slider. */
  const change = (next: SavedStore, done: string) => changeSaved(next, done, isSidePanel() ? line : document.querySelector<HTMLElement>('aside.panel'))

  async function save(name: string, choice: FolderChoice) {
    saveSheet = null
    let store = savedRides.store
    let folder = choice && 'id' in choice ? (store.folders.find((candidate) => candidate.id === choice.id) ?? null) : null
    if (choice && 'newName' in choice) ({ store, folder } = addFolder(store, choice.newName, crypto.randomUUID(), Date.now()))
    rememberFolder(folder?.id ?? null)
    const done = folder ? i18n.t.saved.savedIn(folder.name) : i18n.t.saved.savedLoose
    if (savedRide) return change(moveRide(renameRide(store, savedRide.id, name), savedRide.id, folder?.id ?? null), done)
    if (!places) return
    const [from, to] = await Promise.all([savedPlace(places.from), savedPlace(places.to)])
    const via = places.via.map((stop) => ({ label: stop.label, position: stop.position }))
    const fields = { id: crypto.randomUUID(), name, folderId: folder?.id ?? null, savedAt: Date.now(), from, to, via, dataAt }
    change(addRide(store, savedRideOf(ride, fields)), done)
  }

  function remove() {
    saveSheet = null
    if (savedRide) change(deleteRide(savedRides.store, savedRide.id), i18n.t.saved.removed)
  }

  function press() {
    if (decision.action === 'choose') openSheet()
    else void openIn(decision.target)
  }
</script>

{#if ride.trackM > 0}
  {#if onwarning}
    <button class="tracks-line" onclick={onwarning}>{i18n.t.ride.tracksLine(formatKm(ride.trackM))}</button>
  {:else}
    <p class="tracks-line">{i18n.t.ride.tracksLine(formatKm(ride.trackM))}</p>
  {/if}
{/if}

{#if pinsNoteShown}
  <p class="pins-note">{i18n.t.ride.pinsNote}</p>
{:else if pinsPartialShown}
  <p class="pins-note">{i18n.t.ride.pinsPartial}</p>
{/if}

<div class="line" class:line--crowded={decision.action === 'open' && places !== null} bind:this={line}>
  {#if opensMaps}
    <a class="cta" href={ride.googleMapsUrl} target="_blank" rel="noopener" onclick={onhandover} aria-label={label}>
      <span>{ctaLabel}</span>
      <RideIcon name="open" />
    </a>
  {:else}
    <button class="cta" onclick={press} aria-label={label}>
      <span>{ctaLabel}</span>
      <RideIcon name="open" />
    </button>
  {/if}
  {#if decision.action === 'open'}
    <button class="change" onclick={openSheet} aria-label={i18n.t.openIn.change}>
      <RideIcon name="chevron" />
    </button>
  {/if}
  <button class="share" onclick={share} aria-label={i18n.t.share.button} title={i18n.t.share.button}>
    <RideIcon name="share" />
  </button>
  {#if places}
    <button
      class="save"
      class:save--on={savedRide}
      onclick={openSaveSheet}
      aria-label={savedRide ? i18n.t.saved.edit : i18n.t.saved.button}
      title={savedRide ? i18n.t.saved.edit : i18n.t.saved.button}
    >
      <RideIcon name={savedRide ? 'bookmarked' : 'bookmark'} />
    </button>
  {/if}
</div>

{#if saveSheet}
  <SaveRideSheet
    name={saveSheet.name}
    folderId={savedRide ? savedRide.folderId : savedRides.lastFolderId}
    editing={savedRide !== undefined}
    anchor={line}
    onsave={save}
    onremove={remove}
    onclose={() => (saveSheet = null)}
  />
{/if}

{#if shareWarning}
  <ShareHereSheet anchor={line} onshare={shareRide} onclose={() => (shareWarning = false)} />
{/if}

{#if sheetOpen}
  <OpenInSheet
    apps={installed.apps ?? []}
    {gpxFirst}
    pinnedAll={ride.pinnedAll}
    anchor={line}
    mapsUrl={ride.googleMapsUrl}
    saved={choice.target}
    {failedApp}
    onpick={picked}
    onclose={() => (sheetOpen = false)}
  />
{/if}

<style>
  .pins-note {
    margin: 0 0 8px;
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.35;
    text-align: center;
  }

  /* Every ride with a track says so next to the button, whatever the sheet shows. */
  .tracks-line {
    display: block;
    width: 100%;
    margin: 0 0 8px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--earth);
    font-size: 12.5px;
    line-height: 1.35;
    text-align: center;
  }

  .line {
    display: flex;
    gap: 8px;
  }

  .change,
  .share,
  .save {
    flex: none;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border: 0;
    border-radius: var(--radius-md);
    /* Opaque: in the side panel the list scrolls under this bar. */
    background: linear-gradient(var(--surface-raised), var(--surface-raised)), var(--surface-sheet-solid);
    box-shadow: inset 0 0 0 1px var(--border-strong);
    color: var(--text);
  }

  /* Four buttons on a phone: the squares give the main button room, still a full touch target. */
  .line--crowded .change,
  .line--crowded .share,
  .line--crowded .save {
    width: 48px;
  }

  .change :global(svg),
  .share :global(svg),
  .save :global(svg) {
    width: 22px;
    height: 22px;
  }

  .share,
  .save {
    transition: transform 0.2s var(--ease-out), background-color 0.2s;
  }

  .share:active,
  .save:active {
    transform: scale(0.96);
  }

  .share:focus-visible,
  .save:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }

  .save--on {
    color: var(--amber);
  }

  @media (hover: hover) {
    .share:hover,
    .save:hover {
      background: linear-gradient(var(--surface-hover), var(--surface-hover)), var(--surface-sheet-solid);
    }
  }

  /* With the chevron beside it the label is the app's name; it may be long, and only it gives way. */
  .cta span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cta {
    display: flex;
    flex: 1;
    min-width: 0;
    border: 0;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 54px;
    border-radius: var(--radius-md);
    background: var(--gradient);
    background-size: 160% 100%;
    color: #fff;
    font-weight: 600;
    font-size: 16px;
    text-decoration: none;
    box-shadow: 0 14px 34px -10px rgba(255, 46, 110, 0.65);
    transition: background-position 0.5s var(--ease-out), transform 0.2s var(--ease-out), box-shadow 0.3s;
  }

  @media (hover: hover) {
    .cta:hover {
      background-position: 100% 0;
      box-shadow: 0 18px 40px -10px rgba(255, 46, 110, 0.85);
    }
  }

  .cta:active {
    transform: scale(0.98);
  }
</style>
