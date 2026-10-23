<script lang="ts">
  import MapCorner from './MapCorner.svelte'
  import MapCredit from './MapCredit.svelte'
  import MapStylePicker from './MapStylePicker.svelte'
  import RegionInset from './RegionInset.svelte'
  import { i18n } from '../lib/i18n/i18n.svelte'
  import { applyTheme } from '../lib/map/themeApply'
  import { IMAGERY_LAYERS, LOOKS, type MapTheme } from '../lib/map/theme'
  import { chooseTheme, imagery, mapTheme } from '../lib/map/themeState.svelte'
  import {
    LngLatBounds,
    Map as MapLibreMap,
    Marker,
    setWorkerUrl,
    type MapMouseEvent,
    type MapTouchEvent,
    type GeoJSONSource,
    type PaddingOptions,
  } from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  // MapLibre resolves its worker relative to its own module, which bundlers relocate; point at it explicitly.
  import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
  import { onDestroy, onMount, untrack } from 'svelte'
  import { onBackButton } from '../lib/backButton'
  import type { LonLat } from '../lib/geo'
  import { isSidePanel, onLayoutChange, sidePanelCover, sidePanelFitMargin } from '../lib/layout'
  import type { RiderFix } from '../lib/locate'
  import {
    addRouteLayers,
    placePeaks,
    ROUTE_ENDS,
    ROUTE_STOPS,
    routeEnds,
    setOverlayDimmed,
    setRouteDimmed,
  } from '../lib/map/layers'
  import { registerOverlayProtocol } from '../lib/map/overlayProtocol'
  import { addRiderPositionLayers, RIDER_POSITION, riderPositionData } from '../lib/map/position'
  import { RouteRenderer } from '../lib/map/routeRenderer'
  import { goesToStart, START_EASE_MS, START_ZOOM } from '../lib/map/startCamera'
  import { REGION_BOUNDS, regionAt, SPAIN_BOUNDS, type Region } from '../lib/map/regions'
  import { mapStyle, PNOA_FROM_ZOOM, TERRAIN_SOURCE } from '../lib/map/style'
  import type { RideOption } from '../lib/routing/ride'
  import { isLoop } from '../lib/via'

  type Role = 'from' | 'to'
  /** What a long-press can set: an end, or a stop once both ends are set. */
  type PickRole = Role | 'via'
  type PinKind = Role | 'loop'

  interface Props {
    ride: RideOption | null
    /** Which plan result the ride comes from: another ride of the same plan is a step of the slider. */
    planKey: number
    from: LonLat | null
    to: LonLat | null
    /** The rider's stops between them, drawn as plain points with their names. */
    stops: { label: string; position: LonLat }[]
    focus: LonLat[] | null
    /** A drag of the slider in light mode: the rides it passes are swapped in at once, and the camera waits for the release. */
    scrubbing: boolean
    onpick: (role: PickRole, position: LonLat) => void
    onmove: (center: LonLat) => void
    /** How much of the map the sheet or the side panel covers, which the camera and the attribution keep clear. */
    coveredHeight: number
    /** How high the credit and the region box stand: above the sheet, or under it when it covers the map's foot whole. */
    footClearance: number
    /** The ride on the map is about to be replaced, or is not what the rider asked for (the plan failed). */
    planning: boolean
    /** The trip has all the stops it can take: the long-press menu does not offer another. */
    stopsCapped: boolean
    /** The plan failed: the ride still drawn is not the trip asked for, badges included. */
    failed: boolean
    /** A list covers the trip (the place search, the saved rides): the map is not what the rider is looking at. */
    listOpen: boolean
    /** The rider's last known position, drawn as a dot; it stays on the phone. */
    rider: RiderFix | null
    /** Reads the rider's position, or says why it could not and gives null. */
    onlocate: () => Promise<RiderFix | null>
  }

  let { ride, planKey, from, to, stops, focus, scrubbing, onpick, onmove, coveredHeight, footClearance, planning, stopsCapped, failed, listOpen, rider, onlocate }: Props = $props()

  const LONG_PRESS_MS = 550
  /** The pick menu stays inside the map: it is this wide, centred on the press, and this tall above it. */
  const MENU_HALF_WIDTH_PX = 100
  const MENU_EDGE_PX = 8
  const MENU_HEIGHT_PX = 140
  /** With "Add stop here" between the two ends. */
  const MENU_HEIGHT_WITH_STOP_PX = 186
  const TERRAIN_EXAGGERATION = 1.5
  /** How long the sheet takes to settle on a snap: the map eases its padding for as long, along the same curve. */
  const SHEET_SETTLE_MS = 300
  /** A flight redone towards a new padding is shorter than a fresh one: the camera is partly there already. */
  const REFRAME_MS = 600
  const easeOutQuint = (t: number) => 1 - (1 - t) ** 5
  /**
   * Breathing room between a framed route and the edges of the visible map. The top clears the column of map controls
   * and the open style strip under it, with room for half a pin.
   */
  const PHONE_FIT_MARGIN = { top: 132, bottom: 40, left: 30, right: 30 }
  /** What a pin on the route's end spills past the fit line, which must still clear the credit at the map's foot. */
  const PIN_RADIUS_PX = 16
  /** A loop's one pin is its start and its finish, as the fields name them. */
  const PIN_LETTERS: Record<PinKind, string> = { from: 'A', to: 'B', loop: 'AB' }
  /** The credit's gap above the sheet (see MapCredit.svelte). */
  const FOOT_GAP_PX = 6
  /** This many satellite tiles failing in a row, with none loading in between, means the service is down for us. */
  const IMAGERY_FAILURES_TO_WARN = 3
  /** The camera still overlooks a whole region up to this many zoom levels closer than the view that frames it. */
  const OVERVIEW_ZOOM_SPAN = 1
  /** The region box under the side panel needs this much map below the panel: its height and the gaps around it. */
  const INSET_ROOM_BELOW_PANEL_PX = 76 + 3 * 16
  /**
   * Beside the side panel a region is framed this much lower. Spain is framed by its width there, so it only moves down,
   * and that takes the islands' north coast off the bottom edge, where it read as a copy of the region box.
   */
  const SIDE_REGION_DROP_PX = 100
  /** As long as the flight to a route: the islands are as far from the mainland as a long trip's ends. */
  const REGION_FLIGHT_MS = 1000
  /** Close enough to see the roads around the rider; a camera already closer keeps its zoom. */
  const RIDER_ZOOM = 11
  const RIDER_EASE_MS = 900

  let container: HTMLDivElement
  let map: MapLibreMap | undefined
  let renderer: RouteRenderer | undefined
  let mapCreated = $state(false)
  let loaded = $state(false)
  let terrain = $state(false)
  let pnoaInView = $state(false)
  let footHeight = $state(0)
  let mapHeight = $state(0)
  /** The region the camera overlooks whole, or null closer in. */
  let overviewOf = $state<Region | null>(null)
  /** The camera is on its way to the region the box offered; the box comes back with the other one when it lands. */
  let regionFlight = $state(false)
  let imageryFailures = 0
  let menu = $state<{ x: number; y: number; position: LonLat } | null>(null)
  /** Part of the ride is off the free map; read when the camera stops, never on every frame. */
  let rideHidden = $state(false)
  let locatingRider = $state(false)
  let longPress: ReturnType<typeof setTimeout> | undefined
  // The click a finger lifts into after a long-press must not close the menu the long-press just opened.
  let longPressOpenedMenu = false
  const markers: Record<Role, Marker | undefined> = { from: undefined, to: undefined }

  onMount(() => {
    setWorkerUrl(mapWorkerUrl)
    registerOverlayProtocol()
    map = new MapLibreMap({
      container,
      style: mapStyle(mapTheme.current),
      bounds: SPAIN_BOUNDS,
      fitBoundsOptions: { padding: regionMargin() },
      attributionControl: false,
      maxPitch: 75,
      fadeDuration: 200,
    })
    map.on('load', () => {
      addRouteLayers(map!, mapTheme.current)
      addRiderPositionLayers(map!)
      placePeaks(map!, mapTheme.current)
      renderer = new RouteRenderer(map!)
      loaded = true
    })
    // Read on every frame of a zoom, since the imagery changes at the threshold, but set only when it flips.
    const readPnoa = () => {
      const pnoa = map!.getZoom() >= PNOA_FROM_ZOOM
      if (pnoa !== pnoaInView) pnoaInView = pnoa
    }
    readPnoa()
    map.on('zoom', readPnoa)
    map.on('move', readOverview)
    watchImagery(map)
    map.on('contextmenu', (event) => openMenu(event))
    map.on('click', (event) => {
      if (longPressOpenedMenu) longPressOpenedMenu = false
      else if (menu) menu = null
      else if (!from || !to) openMenu(event)
    })
    map.on('touchstart', (event: MapTouchEvent) => {
      clearTimeout(longPress)
      longPressOpenedMenu = false
      if (event.points.length === 1) {
        longPress = setTimeout(() => {
          longPressOpenedMenu = true
          openMenu(event)
        }, LONG_PRESS_MS)
      }
    })
    for (const name of ['touchend', 'touchmove', 'movestart'] as const) map.on(name, () => clearTimeout(longPress))
    map.on('movestart', () => (menu = null))
    map.on('moveend', () => {
      const { lng, lat } = map!.getCenter()
      onmove([lng, lat])
      readRideHidden()
    })
    stopLayoutWatch = onLayoutChange(() => scheduleCamera(() => (ride ? fit(rideLine(ride), 400) : settle())))
    mapCreated = true
  })

  onDestroy(() => {
    stopLayoutWatch?.()
    map?.remove()
  })

  // The sheet covers the bottom of the map, so the camera works on what is left visible. Camera moves are collected for
  // one tick, so a sheet that changes snap and a ride that arrives together become a single move that ends on the
  // right padding.
  let covered: Required<PaddingOptions> = { top: 0, bottom: 0, left: 0, right: 0 }
  let spainFramed = false
  /**
   * The route the camera is flying to, until the flight itself ends. Not a clock: on a slow phone the last frame comes
   * well after the flight's duration, and a padding change in between must redo the flight, not cut it short.
   */
  let framing: { line: LonLat[] } | undefined
  let pendingMove: (() => void) | undefined
  let cameraQueued = false
  let stopLayoutWatch: (() => void) | undefined

  function scheduleCamera(move?: () => void) {
    if (move) pendingMove = move
    if (cameraQueued) return
    cameraQueued = true
    queueMicrotask(() => {
      cameraQueued = false
      const run = pendingMove ?? settle
      pendingMove = undefined
      run()
    })
  }

  /** The sheet settled on another snap: the map slides with it, then checks the route is still in view. */
  function easePadding() {
    if (!map) return
    const target = mapPadding(coveredHeight)
    // The map was created before the sheet had a height, so Spain is framed again once it is measured.
    if (!spainFramed && coveredHeight > 0) {
      spainFramed = true
      covered = target
      map.setPadding(target)
      if (!ride) map.fitBounds(SPAIN_BOUNDS, { padding: regionMargin(), duration: 0 })
      return
    }
    if (samePadding(target, covered)) return
    // The sheet reports its final snap a few frames after a ride arrives, when the camera is already on its way:
    // the flight is redone towards the new padding instead of being cut short by it.
    if (framing) return fit(framing.line, REFRAME_MS)
    covered = target
    map.easeTo({ padding: target, duration: SHEET_SETTLE_MS, easing: easeOutQuint })
    if (ride) {
      const line = rideLine(ride)
      map.once('moveend', () => fitIfHidden(line))
    }
  }

  $effect(() => {
    coveredHeight
    if (mapCreated) untrack(() => scheduleCamera())
  })

  // Frame every new trip once; while sliding through its options only re-frame if the route leaves the view. Decided
  // when the camera moves, so the results that replace the fastest ride before then still frame the trip. A scrub
  // re-frames once, at the release: a flight for each option it passed kept the whole map redrawing on every frame.
  let framedTrip = ''
  $effect(() => {
    if (!loaded || !map) return
    const instant = untrack(() => scrubbing)
    renderer?.show(ride, from, to, planKey, stops.map((stop) => stop.position), instant)
    setOverlayDimmed(map, ride !== null, untrack(() => mapTheme.current))
    if (!ride) return
    const line = rideLine(ride)
    const trip = `${from}|${to}`
    if (instant && trip === framedTrip) return
    untrack(() =>
      scheduleCamera(() => {
        if (trip === framedTrip) return fitIfHidden(line)
        framedTrip = trip
        fit(line)
      }),
    )
  })

  let wasScrubbing = false
  $effect(() => {
    const now = scrubbing
    untrack(() => {
      if (wasScrubbing && !now && loaded && map && ride) scheduleCamera(() => fitIfHidden(rideLine(ride!)))
      wasScrubbing = now
    })
  })

  $effect(() => {
    if (loaded && map) setRouteDimmed(map, planning, untrack(() => mapTheme.current))
  })

  $effect(() => {
    if (loaded) renderer?.dimBadges(failed)
  })

  // The map is switched in place: the route and the camera stay. What the ride and the planning have dimmed is dimmed again.
  let shownTheme: MapTheme = mapTheme.current
  $effect(() => {
    const theme = mapTheme.current
    document.documentElement.dataset.mapTheme = theme
    if (!loaded || !map || theme === shownTheme) return
    untrack(() => {
      applyTheme(map!, shownTheme, theme)
      placePeaks(map!, theme)
      shownTheme = theme
      // Each visit to the satellite gets a fresh chance; an earlier run of failures says nothing about now.
      if (theme === 'satellite') {
        imageryFailures = 0
        imagery.unavailable = false
      }
      setOverlayDimmed(map!, ride !== null, theme)
      setRouteDimmed(map!, planning, theme)
    })
  })

  // When the foot of the map comes, goes or turns into the failure note, the route is kept clear of it once its new height
  // is measured. Not when the credit only reflows with the zoom, which would pull the camera back to the route from
  // wherever the rider took it.
  let footFor = ''
  let footRefit = false
  $effect(() => {
    const key = `${mapTheme.current}|${imagery.unavailable}`
    if (key !== footFor) {
      footFor = key
      footRefit = true
    }
  })
  $effect(() => {
    footHeight
    untrack(() => {
      if (!footRefit) return
      footRefit = false
      if (loaded && map && ride && !pendingMove) scheduleCamera(() => fitIfHidden(rideLine(ride!)))
    })
  })

  $effect(() => {
    const line = focus
    if (loaded && map && line) untrack(() => scheduleCamera(() => fit(line, 1200)))
  })

  /**
   * The camera once the sheet or the panel has moved. A start set alone and not reached yet is gone to with the new
   * padding: the sheet settling after the editor closes would otherwise cut that ease short with its own.
   */
  function settle() {
    if (!(startPending && startShows() && goToStart(startPending))) easePadding()
  }

  const startShows = () => from !== null && to === null && ride === null && !(listOpen && !isSidePanel())
  /** A start set alone that the camera has not reached: once an ease to it ends, or the rider moves the map, it is gone. */
  let startPending: LonLat | null = null

  // A start set alone: the map goes to it, so the finish is searched and picked around it. A finish that comes in the
  // same moment (a recent trip, Undo) leaves the camera to the ride, and the ride's flight replaces this ease. On a
  // phone the trip editor covers the map while the finish is typed: the ease waits until the map shows again, rather
  // than costing the old phone frames behind it.
  $effect(() => {
    const start = from
    startPending = start && to === null && ride === null ? start : null
    if (!start || !startShows()) return
    untrack(() => {
      if (loaded && map) scheduleCamera(() => goToStart(start))
    })
  })

  /** Eases to the start unless it is in view close enough already; says whether it moved. */
  function goToStart(start: LonLat): boolean {
    if (!map) return false
    if (!goesToStart({ start: true, finish: to !== null, ride: ride !== null, zoom: map.getZoom(), startInView: !outsideFreeArea(start) })) {
      startPending = null
      return false
    }
    const target = mapPadding(coveredHeight)
    covered = target
    map.easeTo({ center: start, zoom: START_ZOOM, padding: target, duration: START_EASE_MS, easing: easeOutQuint })
    // A newer move (the sheet settling) ends this one here; settle() then goes on to the start with the new padding.
    map.once('moveend', () => (startPending = null))
    return true
  }

  $effect(() => {
    if (menu) return onBackButton(() => ((menu = null), true))
  })

  $effect(() => {
    const data = riderPositionData(rider)
    if (loaded && map) (map.getSource(RIDER_POSITION) as GeoJSONSource | undefined)?.setData(data)
  })

  // A step of the slider that leaves the camera where it is may still bring a ride that fits, or one that does not.
  $effect(() => {
    ride
    if (loaded) untrack(readRideHidden)
  })

  /**
   * Read once the camera's own work is done: a flight that replaces another ends the first one on the way, and only a
   * camera that is still after that is where it will stay. Hidden means off the free map, not merely inside the margins
   * the camera frames with.
   */
  function readRideHidden() {
    setTimeout(() => {
      if (!map || map.isMoving()) return
      rideHidden = ride !== null && rideLine(ride).some(offFreeMap)
    })
  }

  function showRide() {
    if (ride) fit(rideLine(ride))
  }

  async function locateMe() {
    if (locatingRider) return
    locatingRider = true
    const fix = await onlocate()
    locatingRider = false
    if (!fix || !map) return
    const target = mapPadding(coveredHeight)
    covered = target
    map.easeTo({ center: fix.position, zoom: Math.max(map.getZoom(), RIDER_ZOOM), padding: target, duration: RIDER_EASE_MS, easing: easeOutQuint })
  }

  // A small pin marks where the rider pressed while the menu is open, since the menu may sit away from it.
  $effect(() => {
    if (!map || !menu) return
    const pin = new Marker({ element: Object.assign(document.createElement('div'), { className: 'press-pin' }) })
      .setLngLat(menu.position)
      .addTo(map)
    return () => pin.remove()
  })

  // A loop gets one pin for its start and finish: B drawn on top of A would hide that the ride comes back.
  const loop = $derived(from !== null && to !== null && isLoop(from, to))
  $effect(() => placeMarker('from', from, loop ? 'loop' : 'from'))
  $effect(() => placeMarker('to', loop ? null : to, 'to'))
  $effect(() => {
    const ends = routeEnds(from, to)
    if (loaded && map) (map.getSource(ROUTE_ENDS) as GeoJSONSource | undefined)?.setData(ends)
  })
  $effect(() => {
    const features = stops.map(({ label, position }) => ({ type: 'Feature' as const, properties: { label }, geometry: { type: 'Point' as const, coordinates: position } }))
    if (loaded && map) (map.getSource(ROUTE_STOPS) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features })
  })

  // A blocked or throttled service (CloudFront answers 403 or 429) fails tile after tile; the rider is told, not switched.
  function watchImagery(map: MapLibreMap) {
    const isImagery = (source: string | undefined) => IMAGERY_LAYERS.some((layer) => layer === source)
    map.on('error', (event) => {
      if (!isImagery((event as { sourceId?: string }).sourceId)) return
      imageryFailures++
      if (imageryFailures >= IMAGERY_FAILURES_TO_WARN) imagery.unavailable = true
    })
    map.on('sourcedata', (event) => {
      if (!event.tile || !isImagery(event.sourceId)) return
      imageryFailures = 0
      imagery.unavailable = false
    })
  }

  // Read on every frame of a move, but set only when it flips.
  function readOverview() {
    const region = regionAt(map!.getCenter().toArray())
    const whole = map!.cameraForBounds(REGION_BOUNDS[region], { padding: regionMargin() })?.zoom
    const overview = whole !== undefined && map!.getZoom() <= whole + OVERVIEW_ZOOM_SPAN ? region : null
    if (overview !== overviewOf) overviewOf = overview
  }

  // Only on the start screen with the map at rest on a region: once there is a trip, the camera follows it.
  const insetShown = $derived(
    overviewOf !== null &&
      !ride &&
      !(from && to) &&
      !listOpen &&
      !regionFlight &&
      (!isSidePanel() || mapHeight - coveredHeight >= INSET_ROOM_BELOW_PANEL_PX),
  )

  function showRegion(region: Region) {
    if (!map) return
    regionFlight = true
    map.fitBounds(REGION_BOUNDS[region], { padding: regionMargin(), duration: REGION_FLIGHT_MS })
    map.once('moveend', () => (regionFlight = false))
  }

  function openMenu(event: MapMouseEvent | MapTouchEvent) {
    menu = { x: event.point.x, y: event.point.y, position: [event.lngLat.lng, event.lngLat.lat] }
  }

  function pick(role: PickRole) {
    if (menu) onpick(role, menu.position)
    menu = null
  }

  function placeMarker(role: Role, position: LonLat | null, kind: PinKind) {
    if (!map) return
    if (!position) {
      markers[role]?.remove()
      markers[role] = undefined
      return
    }
    const placed = markers[role]
    if (placed) {
      dressPin(placed.getElement(), kind)
      const { lng, lat } = placed.getLngLat()
      if (lng === position[0] && lat === position[1]) return
      placed.setLngLat(position)
      // A pin that moves pings again.
      placed.getElement().querySelector('.place-marker__pulse')?.getAnimations().forEach((animation) => animation.play())
    } else {
      const element = document.createElement('div')
      element.innerHTML = '<span class="place-marker__pulse"></span><span class="place-marker__dot"></span>'
      markers[role] = new Marker({ element: dressPin(element, kind) }).setLngLat(position).addTo(map)
    }
  }

  function dressPin(element: HTMLElement, kind: PinKind): HTMLElement {
    element.className = `place-marker place-marker--${kind}`
    element.querySelector('.place-marker__dot')!.textContent = PIN_LETTERS[kind]
    return element
  }

  function toggleTerrain() {
    if (!map) return
    terrain = !terrain
    map.setTerrain(terrain ? { source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null)
    const tilt = () => {
      if (ride) fit(rideLine(ride), 1400)
      else map?.easeTo({ pitch: terrain ? 62 : 0, bearing: terrain ? map.getBearing() || -18 : 0, duration: 1400 })
    }
    // The first frame with terrain compiles its shaders, which stalls the phone for a few hundred milliseconds: the
    // camera waits until that frame is out, so the stall does not land in the middle of the tilt.
    if (terrain) map.once('render', () => requestAnimationFrame(tilt))
    else tilt()
  }

  function rideLine(shown: RideOption): LonLat[] {
    return shown.segments.flatMap((segment) => segment.line)
  }

  /** Flies to the route with the map's padding already at its final value, so the sheet and the camera arrive together. */
  function fit(line: LonLat[], duration = 1000) {
    if (!map || line.length === 0) return
    const target = mapPadding(coveredHeight)
    covered = target
    const bounds = line.reduce((b, point) => b.extend(point), new LngLatBounds(line[0], line[0]))
    // The camera that fits the route depends on the padding, which animates: ask for it as if it were already there.
    const current = map.getPadding()
    map.setPadding(target)
    const camera = map.cameraForBounds(bounds, { padding: fitMargin(), maxZoom: 13 })
    map.setPadding(current)
    if (!camera) return
    // A flight that replaces one still under way ends that one here, firing its moveend: the new one is marked after.
    map.flyTo({ ...camera, padding: target, duration, pitch: terrain ? 55 : 0 })
    if (!map.isMoving()) return
    framing = { line }
    map.once('moveend', () => (framing = undefined))
  }

  function fitIfHidden(line: LonLat[]) {
    if (!map) return
    // Mid-flight the route is not where it will land; a ride that arrives then (the planner's refined stop) is flown to.
    if (framing) return fit(line, REFRAME_MS)
    if (line.some(outsideFreeArea)) fit(line)
  }

  /** Whether a point lies outside the part of the map that the sheet or the side panel leaves free, margins kept. */
  function outsideFreeArea(point: LonLat): boolean {
    const { width, height } = map!.getCanvas().getBoundingClientRect()
    const margin = fitMargin()
    const { x, y } = map!.project(point)
    return x < covered.left + margin.left || x > width - covered.right - margin.right || y < covered.top + margin.top || y > height - covered.bottom - margin.bottom
  }

  function offFreeMap(point: LonLat): boolean {
    const { width, height } = map!.getCanvas().getBoundingClientRect()
    const { x, y } = map!.project(point)
    return x < covered.left || x > width - covered.right || y < covered.top || y > height - covered.bottom
  }

  /** The part of the map the sheet or the side panel covers. */
  function mapPadding(coveredBottom: number): Required<PaddingOptions> {
    return isSidePanel()
      ? { top: 0, bottom: 0, left: sidePanelCover(), right: 0 }
      : { top: 0, bottom: coveredBottom, left: 0, right: 0 }
  }

  function samePadding(a: Required<PaddingOptions>, b: Required<PaddingOptions>) {
    return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right
  }

  function regionMargin() {
    const margin = fitMargin()
    return isSidePanel() ? { ...margin, top: margin.top + SIDE_REGION_DROP_PX } : margin
  }

  function fitMargin() {
    const margin = isSidePanel() ? sidePanelFitMargin() : PHONE_FIT_MARGIN
    return footHeight > 0 ? { ...margin, bottom: margin.bottom + FOOT_GAP_PX + footHeight + PIN_RADIUS_PX } : margin
  }
</script>

<div class="map" bind:this={container} bind:clientHeight={mapHeight} style:--sheet-covered="{coveredHeight}px" style:background={LOOKS[mapTheme.current].colors.background}></div>

<MapCredit
  theme={mapTheme.current}
  pnoa={pnoaInView}
  {terrain}
  unavailable={imagery.unavailable}
  coveredHeight={footClearance}
  onusedark={() => chooseTheme('dark')}
  bind:height={footHeight}
/>

<RegionInset region={overviewOf === 'canaries' ? 'mainland' : 'canaries'} shown={insetShown} coveredHeight={footClearance} {footHeight} onpick={showRegion} />

<MapCorner {rideHidden} locating={locatingRider} coveredHeight={footClearance} {footHeight} onshowride={showRide} onlocate={locateMe} />

<!-- Light status-bar icons would vanish on a pale map or a photo, so the top edge of those is shaded. -->
<div class="map-scrim" class:map-scrim--on={mapTheme.current !== 'dark'} aria-hidden="true"></div>

<div class="map-controls">
  <div class="map-controls__row">
    <div class="legend" role="img" aria-label={i18n.t.map.legend}>
      <span>{i18n.t.ride.ratingWords[0]}</span>
      <span class="legend__ramp" class:legend__ramp--backed={mapTheme.current === 'light'} style:background={mapTheme.current === 'light' ? LOOKS.light.colors.land : undefined}>
        {#each LOOKS[mapTheme.current].ramp as color (color)}<i style:background={color}></i>{/each}
      </span>
      <span>{i18n.t.ride.ratingWords[4]}</span>
    </div>
    <button
      class="terrain-toggle"
      class:terrain-toggle--active={terrain}
      onclick={toggleTerrain}
      aria-pressed={terrain}
      title={i18n.t.map.terrain}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M2 19 9 7l4 6 3-4 6 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      </svg>
      3D
    </button>
  </div>
  <MapStylePicker />
</div>

{#if menu}
  <div
    class="pick-menu"
    style:left="clamp({MENU_HALF_WIDTH_PX + MENU_EDGE_PX}px, {menu.x}px, calc(100% - {MENU_HALF_WIDTH_PX + MENU_EDGE_PX}px))"
    style:top="max({menu.y}px, {from && to && !stopsCapped ? MENU_HEIGHT_WITH_STOP_PX : MENU_HEIGHT_PX}px)"
    role="menu"
  >
    <button role="menuitem" onclick={() => pick('from')}><span class="badge badge--from">A</span>{i18n.t.map.startHere}</button>
    {#if from && to && !stopsCapped}
      <button role="menuitem" onclick={() => pick('via')}><span class="badge badge--via"><i></i></span>{i18n.t.map.addStopHere}</button>
    {/if}
    <button role="menuitem" onclick={() => pick('to')}><span class="badge badge--to">B</span>{i18n.t.map.finishHere}</button>
  </div>
{/if}

<style>
  .map {
    position: absolute;
    inset: 0 0 auto;
    height: var(--app-height, 100%);
  }

  .map-scrim {
    position: absolute;
    inset: 0 0 auto;
    height: calc(env(safe-area-inset-top) * 1.75);
    background: linear-gradient(rgba(7, 9, 13, 0.6) calc(env(safe-area-inset-top) * 0.7), transparent);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }

  .map-scrim--on {
    opacity: 1;
  }

  .map-controls {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 12px);
    right: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .map-controls__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--touch-target);
    padding: 0 12px;
    border-radius: 999px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: var(--map-shadow);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    pointer-events: none;
  }

  .legend__ramp {
    display: flex;
    gap: 2px;
  }

  /* The pill is dark chrome; on a light map its swatches sit on paper, so it shows the map's own colours. */
  .legend__ramp--backed {
    padding: 2px;
    border-radius: 4px;
  }

  .legend__ramp i {
    width: 10px;
    height: 6px;
    border-radius: 2px;
  }

  .terrain-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--touch-target);
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: var(--map-shadow);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: var(--text-muted);
    transition: color 0.3s, box-shadow 0.3s;
  }

  .terrain-toggle--active {
    color: var(--text);
    box-shadow: 0 0 0 1px rgba(255, 181, 71, 0.5), 0 10px 30px -8px rgba(255, 46, 110, 0.5);
  }

  .terrain-toggle--active svg {
    color: var(--amber);
  }

  .pick-menu {
    position: absolute;
    z-index: 5;
    transform: translate(-50%, calc(-100% - 14px));
    display: flex;
    width: 200px;
    flex-direction: column;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--surface);
    backdrop-filter: blur(18px);
    box-shadow: var(--map-shadow);
    animation: pop 0.22s var(--ease-out);
  }

  .pick-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px 9px 8px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font-weight: 500;
    white-space: nowrap;
  }

  @media (hover: hover) {
    .pick-menu button:hover {
      background: var(--surface-hover);
    }
  }

  .badge {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 700;
  }

  .badge--from {
    background: var(--text);
    color: var(--bg);
  }

  .badge--to {
    background: var(--gradient);
    color: #fff;
  }

  /* A stop, as the map draws it: a plain white point, in the slot the A and B badges take. */
  .badge--via i {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 2px #15171c, 0 0 0 3px rgba(255, 255, 255, 0.35);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-100% - 4px)) scale(0.94);
    }
  }

  :global(.place-marker) {
    width: 30px;
    height: 30px;
  }

  :global(.place-marker__dot) {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font: 700 12px var(--font-display);
    border: 2.5px solid var(--bg);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6);
  }

  :global(.place-marker--from .place-marker__dot) {
    background: var(--text);
    color: var(--bg);
  }

  :global(.place-marker--to .place-marker__dot) {
    background: var(--gradient);
    color: #fff;
  }

  /* Both pins in one: B's colours inside A's white ring. */
  :global(.place-marker--loop .place-marker__dot) {
    background: var(--gradient);
    color: #fff;
    font-size: 11px;
    letter-spacing: -0.5px;
    box-shadow:
      inset 0 0 0 2.5px var(--text),
      0 6px 18px rgba(0, 0, 0, 0.6);
  }

  :global(.press-pin) {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--text);
    background: rgba(255, 255, 255, 0.25);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
  }

  :global(.place-marker__pulse) {
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px solid currentColor;
    opacity: 0;
    /* A few pings when a pin lands, then nothing: an endless animation keeps the phone drawing frames at idle. */
    animation: marker-pulse 2.4s var(--ease-out) 3;
  }

  :global(.place-marker--from .place-marker__pulse) {
    color: var(--text);
  }

  :global(.place-marker--loop .place-marker__pulse) {
    color: var(--text);
  }

  :global(.place-marker--to .place-marker__pulse) {
    color: var(--pink);
  }

  @keyframes -global-marker-pulse {
    0% {
      opacity: 0.7;
      transform: scale(0.6);
    }
    100% {
      opacity: 0;
      transform: scale(1.5);
    }
  }
</style>
