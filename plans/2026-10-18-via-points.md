# Plan: stops in the trip, the UI half (ROADMAP 16)

Status: approved; built on branch `via-points-ui` on routing's planner half (main d5c0306, then 38cbd39). Owners: `app` for the UI half written here; `routing` for the planner
half, whose contract is section 6 (routing writes its own plan against it). Date: 2026-10-18. Source: maintainer,
2026-10-17 ("the rider adds intermediate places, as in Google Maps, to chain a ride, e.g. València → Teruel → Segorbe →
València"); chosen as next with ROADMAP 18 on 2026-10-18.

Mockups (headless Chrome on `vite preview` of main 61ef806, the real app with the proposed pieces injected), in
`~/code/twisty/data/plan-mockups/`:
- `via-1-editor-{en,es}`: the fields with two stops and a loop.
- `via-2-ride-{en,es}`: a ride with stops, the A → B bar and the map.
- `via-3-legs-{en,es}`: the summary with its legs.
- `via-4-menu-{en,es}`: long-press on the map.
- `via-5-fold-open-{en,es}`: the side panel.

The ride on the map in `via-2` is today's València → Los Santos without stops; the two stop points were placed on its
line by hand, as there is no planner for stops yet. The ux-designer's review is folded in (section 9); the shots were taken again
after it.

**Words.** In code, the slider's positions are already "stops" (`stopsHidden`, `wantedStop`, `selected`). The rider's
intermediate places are **`via`** in code and **Stop / Parada** on screen. Two strings already say "stop" on screen for
other things and change with this plan:
- `ride.coverageAdds`, "This stop adds {road}" / "Esta parada añade…", about a slider position, becomes "This option
  adds {road}" / "Esta opción añade…".
- `openIn.mapsFollows`, "Rides each twisty via stops" / "Sigue los tramos con paradas", about the Google Maps pins,
  becomes "Rides each twisty via waypoints" / "Sigue los tramos con puntos de paso".

## Where we are

- A trip is two places: `from` and `to` in `App.svelte`, two `PlaceField`s in `Panel.svelte`, A and B markers in
  `MapView.svelte`, and `planner.plan(from, to, includeTracks)`.
- On the phone the fields live in the full-screen place search (`editorOpen`). Once a ride is planned they fold into
  the A → B bar. In the side panel they stay in view.
- Long-press on the map offers "Start here" and "Finish here" (`pick-menu`).
- `twisty.trip` and `twisty.trips` store `from` and `to`. The history's identity is the two ends.
- The map numbers the twisties 1…n with coloured badges.

## Design

### 1. The fields

The trip editor (`via-1-editor-*`, phone; `via-5-fold-open-en`, side panel) lists **start, stops in riding order,
finish**.
- Each stop is a `PlaceField` with a plain white dot where A and B have their letters. Numbers belong to the twisty
  badges on the map, and a numbered stop would read as "twisty 1".
- Each stop has a grip (drag to reorder) and a × (remove), each a 44 × 44 px target with at least 8 px between them, so
  a gloved drag never lands on remove. A long-press anywhere on a stop's field also starts the drag.
- Removing a stop shows "Teruel removed · Undo".
- The locate button stays on the start's row and swap on the finish's row, whatever comes between: next to a stop,
  "My location" would read as "use my location for Teruel".
- **"+ Add stop"** shows once start and finish are both set, so a new rider still sees two fields. It sits under the
  finish. It inserts an empty field before the finish and focuses it, so typing
  searches at once, as in Google Maps.
  - At the cap (`MAX_VIA`, section 6; 3 proposed) it greys out with a note: "Up to 3 stops, so Google Maps can follow
    the ride".
  - An empty stop field left behind is dropped when the editor closes.
- **A loop**: with at least one stop, the finish's suggestions offer **"Back to the start"** (the start's place, its
  label kept) above the towns. A loop without a stop is not offered: it would be a different feature, a round trip
  from home.
- **Reorder**: a drag on the grip lifts the field, and the others make room. On release the trip is planned again.
  - Keyboard: the grip is a button ("Move Teruel"), and arrow keys move the stop up or down.
  - The order logic is one pure function, `moveVia(list, from, to)`, with tests.
- **Swap** reverses the whole trip: finish, stops backwards, start.
- **"My location"** stays offered for the start only. A stop is a place the rider is going to, not where they are.
- Two consecutive identical places are merged before planning, with no error to show.
- **When the trip is planned again**:
  - On the phone, picking a place in a field opened by "+ Add stop" closes the editor and plans, as picking the second
    end does today (`placeChosen`). The rider sees what the stop did to the route at once.
  - Reordering and removing in the phone's editor plan when the editor closes; it covers the result anyway.
  - In the side panel every change plans at once, debounced (about 400 ms) so a drag in progress plans nothing.

### 2. The ride on screen

- **The A → B bar** (`via-2-ride-*`) keeps A and B and puts one small white dot per stop on the arrow between them
  (at most 3, about 28 px), with "2 stops" as its aria label. No words: it takes no room from the names in either
  language, and it echoes the stops on the map.
  - Tapping the bar opens the editor, on the tapped part (start, the dots open the first stop, finish).
- **The map**: each stop is a solid 14 px white dot with a 2 px dark ring, drawn above the line and under the twisty
  badges, with its place name beside it in small type (at most 3 labels). Not numbered: numbers are the twisties'
  badges, and letters are A and B. Not draggable (YAGNI; ROADMAP 19 brings editing on the map).
- **The camera** does not move when the new route already fits the view (a stop added from the map, a reorder): a
  flight on every edit reads as jank. It frames the route as today when the route does not fit.
- **The slider reads the whole trip, exactly as today**:
  - Each bar is a whole ride from A to B through every stop.
  - The headline's time and "+44 min" compare with the fastest whole ride.
  - "+36 km of curves" counts the whole ride.
  - Nothing on the slider is per leg: the rider picks how much time they will give the day, and the planner decides
    where the detours go.
  - The short-trip rule (`stopsHidden`) looks at the whole trip's time.
- **The summary** (`via-3-legs-*`) gets a **Legs** list above "Curvy roads on this ride": one row per leg, the two
  places, its time (`formatDuration`: "52 min", "1 h 01") and its km of curves. The time column keeps its width; a long
  place name ellipsises, each name on its own.
  - The twisty list stays one list in riding order, numbered as on the map.
  - A leg row is not a button in this plan. In ROADMAP 19 it is what opens "edit a stretch".
- **Planning**: the label says "Planning 3 legs…" instead of "Planning…". The fastest whole ride arrives first, as
  today.
- **The pins note stays true**: "Each twisty is pinned with waypoints so Google Maps rides it end to end" shows only
  when every twisty of the option got its pins (`pinnedAll`, section 6). Otherwise one short line says that Google
  Maps may skip a twisty and that GPX follows the whole line.
- **A leg with no road** (a stop on an island, a closed valley): the error names it, e.g. "No road found from Teruel to
  Segorbe", and its button opens the editor on that stop instead of "Choose another finish".

### 3. The map menu

Long-press offers "Add stop here" / "Pasar por aquí" between "Start here" and "Finish here" (`via-4-menu-*`), once
both ends are set. Its white dot takes the same slot as the A and B badges, so the three labels line up.
- The stop goes where it adds the least straight-line distance between its neighbours. The rider can drag it
  elsewhere in the editor.
- The point is named like a long-pressed end today (`describe`, the town it lies in).

### 4. Storage: the maintainer's trips stay

- `twisty.trip` and the history entries gain an optional `via: [{ label, position }]`, written only when there are
  stops.
- Parsing treats a missing `via` as no stops, so every stored trip reads exactly as before. No migration rewrites
  anything.
- The history's identity (`sameTrip`) becomes the start, the stops in order and the finish. "A → B" and "A → C → B" are
  two entries.
- A recent trip with stops shows "València → Los Santos" with "via Chelva, Ademuz" on its second line, the wording
  Share uses, and plans with its stops when tapped.
- An older APK installed over this one would drop the stops of an entry it rewrites. That is a downgrade, accepted.
- Saved rides (ROADMAP 18) already keep `via` in their version 1.

### 5. Hand-offs

- **Google Maps**: the rider's stops are waypoints, in order, never dropped. The twisty pins use what is left of the 9
  (section 6).
- **GPX**: the track plus one `<wpt>` per stop, named with its place.
- **Share text**: "València → Los Santos via Chelva, Ademuz".
- **The GPX file name** keeps start and finish only.

### 6. Planner contract (for routing)

What the UI needs from the planner. The how (legs, the slider over several legs, where detours go) is routing's plan.

**Request** (`messages.ts`):

```ts
{ type: 'plan'; id: number; points: LonLat[]; includeTracks: boolean }
```

- `points` is the start, the stops in order, the finish: 2 to `2 + MAX_VIA` points.
- The first and the last may be the same point (a loop) when there are at least 3 points.
- The UI never sends two identical consecutive points.
- `from` and `to` go away; the two-point trip is `points.length === 2`.

**Answer**: `fastest` then `planned`, as today. Each `RideOption` is a whole ride through every point, plus:

```ts
legs: { timeS: number; distanceM: number; twistyM: number; curvyM: number }[] // one per pair of consecutive points
// and on each RideTwisty:
leg: number // index of the leg it is ridden in
```

- `timeS`, `distanceM`, `twistyM`, `curvyM`, `motorwayM`, `otherM` and `segments` are the whole ride's, as today.
- `pinnedAll: boolean` on each option: every twisty got its entry and exit pins in `googleMapsUrl`. The UI shows the
  pins note only then (section 2).
- `extraS` is measured against the fastest whole ride.
- Options are ordered by time and keep today's promise: each one adds time and curves over the previous one. At most 9,
  like today.
- Which leg carries the detours is routing's call. The UI reads only the whole ride and the legs' totals.

**Failure**: `{ type: 'failed'; id; code; leg?: number }`.
- `leg` is the index of the leg with no road (`noConnection`).
- For `tooFar` it is the index of the point that is far from any road, and the field is named `point`, not `leg`.

**Waypoint budget** (`googleMaps.ts`, routing's):
- `MAX_VIA = 3` is proposed, exported next to `MAX_WAYPOINTS`, and the UI caps the fields with it.
- With 3 stops, 6 waypoints are left for pins: three twisties pinned end to end, or fewer with interior pins.
- Routing decides which pins go when they do not fit: detour pins are dropped or merged first, a rider's stop never.
- If routing finds 3 too many for the pins, the cap moves and the UI follows the constant.

**Speed** (the Huawei, the performance bar):
- The fastest whole ride should arrive about as fast as a two-point trip of the same length does today. The rider
  waits on the bar while the options come.
- The full set should come no slower than the sum of its legs planned one by one.
- Routing measures it with `plantime.mjs` (the three baseline trips plus a loop, València → Teruel → Segorbe →
  València) and reports it next to main.

**Tests the UI side relies on**:
- A loop plans.
- A stop on the fastest line changes nothing but adds a leg.
- `legs` add up to the whole ride.
- Every twisty's `leg` is in range.
- `googleMapsUrl` holds every stop in order.
- `pinnedAll` is false exactly when some twisty lost a pin.

### 7. Code (the UI half)

| file | change |
| --- | --- |
| `App.svelte` | `via` state next to `from` and `to`; the plan request with `points`; the wanted-stop key includes `via`; `pickTrip` restores stops |
| `components/Panel.svelte` | the stop fields, "+ Add stop", the reorder, the bar's pill, the leg error |
| `components/PlaceField.svelte` | a `via` role (white dot, grip, ×) |
| `components/MapView.svelte` | stop markers; "Add stop here" |
| `components/RideSummary.svelte` | the Legs list |
| `lib/via.ts` + test | `moveVia`, the cheapest insertion for a long-pressed stop, merging identical neighbours |
| `lib/tripStorage.ts`, `lib/tripHistory.ts` + tests | the optional `via` (section 4), old entries read unchanged |
| `lib/shareRide.ts` + test | "via …" in the text |
| `components/RideActions.svelte` | the pins note only with `pinnedAll`, the honest line otherwise |
| `lib/i18n/en.ts`, `es.ts` | the copy below |

Built after routing's planner half lands, or alongside it against the contract with a stub planner in tests.

### 8. Copy (`en.ts` is the source)

| key | en | es |
| --- | --- | --- |
| `via.add` | Add stop | Añadir parada |
| `via.placeholder` | Add a stop | Añade una parada |
| `via.capped(n)` | Up to {n} stops, so Google Maps can follow the ride | Hasta {n} paradas, para que Google Maps pueda seguir la ruta |
| `via.count(n)` | {n} stops / 1 stop | {n} paradas / 1 parada |
| `via.remove(place)` (aria) | Remove the stop {place} | Quitar la parada {place} |
| `via.move(place)` (aria) | Move {place} | Mover {place} |
| `via.backToStart` | Back to the start | Volver al inicio |
| `map.addStopHere` | Add stop here | Pasar por aquí |
| `ride.legs` | Legs | Etapas |
| `planning.legs(n)` | Planning {n} legs… | Planeando {n} etapas… |
| `errors.noLeg(from, to)` | No road found from {from} to {to}. | No hay carretera de {from} a {to}. |
| `panel.editStop` | Change this stop | Cambiar esta parada |
| `share.via(places)` | via {places} | por {places} |
| `history.via(places)` | via {places} | por {places} |
| `via.removed(place)` | {place} removed | {place} quitada |
| `ride.pinsPartial` | Google Maps may skip a twisty here; the GPX follows the whole line. | Google Maps puede saltarse algún tramo; el GPX sigue la línea entera. |
| `ride.coverageAdds(road)` (changed) | This option adds {road} | Esta opción añade {road} |
| `openIn.mapsFollows` (changed) | Rides each twisty via waypoints | Sigue los tramos con puntos de paso |

"Etapas" for legs: "tramo" already means a twisty in three Spanish strings, and "etapa" is the touring rider's word
for the stretch between stops.

### 9. Review

One ux-designer pass (2026-10-18) on the plan and every mockup. No blocker. Everything was taken, and the shots were
taken again:

| Rank | Finding | Taken as |
| --- | --- | --- |
| Major | The stop marker read as a twisty badge or a GPS dot | A 14 px solid dot under the badges, with its place name (section 2) |
| Major | Grip and × too small and too close; no Undo on remove | 44 px targets 8 px apart, long-press drag, Undo (section 1) |
| Major | When a change plans was not said, and `placeChosen` would close the editor on every stop | One rule per layout (section 1) |
| Major | "My location" next to a stop | Locate pinned to the start's row, swap to the finish's (section 1) |
| Major | "Stop" already said two other things on screen | Both strings reworded (Words) |
| Major | The pins note could be untrue with 3 stops | `pinnedAll` in the contract, and an honest line otherwise (sections 2 and 6) |
| Minor | The worded pill cut the finish's name | One dot per stop on the arrow (section 2) |
| Minor | Leg times as "0 h 52"; long names | `formatDuration`; the names ellipsise, the time keeps its column (section 2) |
| Minor | "Parar aquí" reads as "stop now"; the menu's indent | "Pasar por aquí"; the dot takes the badge's slot (section 3) |
| Minor | "+ Add stop" on an empty start screen | Only once both ends are set (section 1) |
| Minor | A camera flight on every edit | No move when the route fits (section 2) |
| Minor | "· 2 stops" in the history is hard to recognise | "via Chelva, Ademuz" (section 4) |
| Open | "Tramos" or "Etapas" | "Etapas" (section 8) |
| Open | The cap of 3 and its note | Kept; the greyed button keeps a 3:1 contrast; it holds only with `pinnedAll` |

## Not in this plan

- **Dragging a stop or the route on the map**, and "avoid this road": ROADMAP 19.
- **A round trip with no stop** ("a loop from home, 2 hours"): a different feature, not asked for.
- **Optimising the order of the stops**: the rider's order is the ride.

## Document changes (the director keeps them)

- ROADMAP 16: this plan's path; routing's plan path when it exists.
- PRD, Trips row: "A trip may have up to 3 stops between start and finish, a loop included; the slider applies to the
  whole trip."

## As built

Two ux-designer rounds on the build (shots in `~/code/twisty/data/via-points-shots/`, EN and ES, phone and the Fold
open). Changes from the plan, and what waits:

- **No long-press drag on a field.** On a text input a long-press is the system's caret and selection gesture; only the
  44 px grip drags, in the column of the locate and swap buttons (the reviewer accepted it). A drop lands where the
  finger is wherever the grip is taken (`dropIndex`, tested), and the stops it passes make room.
- **Stops are drawn over the twisty badges**, not under: a stop is the one point the rider placed. Badges keep clear of
  the stops as of A and B, and one with no room goes where it is least in the way.
- **A point away from any town** is "Near <place>" within 25 km (`describe`), for A and B as well.
- **A failed trip** dims the last ride, badges included, and frames every point of the trip.
- **Open in…** (ROADMAP 32): "Google Maps may change your route; we recommend apps that read the GPX directly", firmer
  when not every twisty is pinned, where the GPX apps then come first and Google Maps saved as the choice asks again.
- **Waits** (follow-ups): one badge for a twisty ridden there and back (two stack today on a dead-end stop); the A pin
  hidden by B on a loop; room for a stop's name at the edge of a failed trip's frame.
- **The cap note** reads "Up to 3 stops per trip" / "Hasta 3 paradas por viaje" (director, after ROADMAP 32: it no longer
  gives Google Maps as the reason).
