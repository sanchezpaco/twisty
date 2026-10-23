**Code review of main at 5b9590d (release round, step 1)**

I found no blockers. Four majors should be fixed before the public release; the rest can be filed. The three gates are green.

## Scores
- **Simplicity 8**: a single switch (`TRACKS_OFFERED`, lib/offRoad.ts:5) plus the vite `dropTracks` plugin keeps tracks out of the build with no extra layers. `planner.ts` is dense, but each step has its reason written next to it.
- **Purity 8**: the routing, planner, geo, Google Maps and GPX code is pure, and I/O sits in the worker and the client. But the trip-state logic (pickTrip, leaveSaved, pickOnMap, planAgain) lives untested in App.svelte:224-321, and that is where 2 of the 4 majors are.
- **Naming and constants 8**: the constants are named and grouped at the top (planner.ts:25-55, googleMaps.ts:3-11, geocoding.ts:20-49). A few are declared in the middle of a component (Panel.svelte:130 `STOPS_SETTLE_MS`, PlaceField.svelte:42).
- **Comments 8**: they explain why. One piece of dead code: RideActions.svelte:49.
- **Tests 7**: 118 pytest and 561 vitest tests pass. Nothing covers App-level trip state, the worker and client error protocol, or a trip whose points snap to the same graph node (which crashes).
- **Boundaries 7**: the stored-data parsers are excellent (savedRide.ts, savedRides.ts, tripStorage.ts). But the release build does not fail when candidates.bin is missing, the worker has no `onerror`, and savedRides.ts reads `localStorage` outside its `try`.

## Findings

### Major

**1. A trip whose ends snap to the same graph node fails with "Something went wrong while planning."**
- Where: lib/routing/bidirectional.ts:16 returns `[]` when source equals target. Then lib/routing/ride.ts:311 (`segments`) runs `result[0].line.unshift(from)` on an empty array.
- Scenario: two neighbouring villages, or two long-presses close together, with no junction between them. I reproduced it with a scratch vitest: `Planner.plan([[0,0],[0.0001,0.0001]])` throws `TypeError: Cannot read properties of undefined (reading 'line')` from ride.ts:311, called from planner.ts:144. In the app the same crash happens earlier, at planner.ts:153 (`onFastest`), and the worker reports it as `unexpected`. The same happens when every leg is empty (all points on one node).
- Fix: in `Planner.plan`, after `snap`, throw a `PlanningError` with a new code (e.g. `sameSpot`) when all consecutive nodes are equal. Add its message to en.ts and es.ts with the "Change finish" action. Add a planner test.
- Owner: routing (strings: app).

**2. A loop from "My location" stores the rider's exact position, labelled "My location", as the finish.**
- Where: Panel.svelte:219-221. `backToStart` copies `label` and `position` but not `here`.
- What goes wrong:
  - `historyPlace` (tripHistory.ts:28) keeps the position, which breaks the rule written at tripHistory.ts:10 ("never kept… home or hotel").
  - Tapping that recent trip the next day sends the loop back to yesterday's hotel.
  - A saved ride names its finish "My location" instead of the town (RideActions.svelte:110).
- Fix: carry `...(props.from.here && { here: true as const })` in `backToStart`. Then handle both ends being `here` in `pickTrip` (App.svelte:268-272 handles only one), with one `locate()` for both.
- Owner: app.

**3. "Add stop here" on an open saved ride does nothing, or mixes in the previous trip's stops.**
- Where: App.svelte:227 checks App's own `from`, `to` and `via`, not the saved ride's. App.svelte:349 also passes `stopsCapped` from App's `via`.
- Scenario: the rider opens a saved ride from the start screen (App's `from` or `to` is null there) and long-presses the map. The menu offers "Add stop here" (MapView.svelte:510), and the tap is silently ignored. When App does hold both ends, `changeVia` → `leaveSaved` loads the saved stops, and then `via = list` overwrites them with the old trip's stops plus the new one. A saved ride that already has 3 stops is still offered a 4th.
- Fix: call `leaveSaved()` at the top of `pickOnMap` before reading `from`, `to` and `via`. Pass `stopsCapped={(savedView?.via ?? via).length >= MAX_VIA}`.
- Owner: app.

**4. `make bundle` can ship a release without candidates.bin, or with one from another graph, and nothing fails.**
- Where: Makefile:99-101 and :127-129 (`check-data` checks only graph.bin and overlay). planner.worker.ts:59-62 returns `undefined` on a 404, or logs a `console.warn` on a mismatch.
- Scenario: a bundle built from a worktree or machine without `make candidates`. The planner then runs `findCandidates` plus `buildLegTable` on the phone during the first plan; planner.ts:412 notes this is "only cheap on a small graph". On the Huawei that means a very slow first plan.
- Fix: have `bundle` fail unless `app/public/data/candidates.bin` exists and parses against graph.bin (a small node check using `parseCandidates`).
- Owner: app (Makefile), with routing for the check.

### Minor

**5. Picking a recent trip whose start is "My location" first plans a stale trip.**
- Where: App.svelte:269-271 sets `to = finish` before locating, without clearing `from` or `via`.
- Scenario: with a start already typed, the planner plans typed start + old stops + the recent finish. The worker is single-threaded, so the wanted plan waits behind it. If location is denied, that stale trip stays.
- Fix: set `from = null` and `via = stops` (or nothing at all) until `locate()` resolves.
- Owner: app.

**6. Address results from an earlier query replace the current list.**
- Where: PlaceField.svelte:97-117. `findAddresses` never checks that the query is still the same. A chain of up to 5 Nominatim requests 1.1 s apart can take about 5 s.
- Scenario: the rider edits the text meanwhile and gets the old addresses under the new text.
- Fix: after the await, drop the result if `query.trim() !== searched`.
- Owner: app.

**7. Load failures in the worker and at startup are not surfaced, and some are permanent.**
- Where: plannerClient.ts:26 sets no `worker.onerror`. planner.worker.ts:31 caches a rejected `loadPlanner()` forever. geocoding.ts:126 caches a rejected place index, and App.svelte:103-109 leaves it and `meta.json` without `.catch`.
- Scenario: if the worker script fails, the spinner never stops. Map picks throw unhandled rejections. These are low risk in the APK (local files) but real on the web.
- Fix: map `onerror` to reject every pending plan with `unexpected`; reset the cached promises on rejection; catch the startup fetches.
- Owner: routing (worker, client, geocoding), app (App.svelte).

**8. Where storage is blocked, the web app crashes at import.**
- Where: savedRides.ts:74 and :84 take `storage: Storage = localStorage` as a default parameter. A default parameter is evaluated before the `try`, so the SecurityError escapes, and savedRidesState.svelte.ts:5 runs this at module load. The APK is not affected.
- Fix: resolve `localStorage` inside the `try`.
- Owner: app.

**9. Sharing a ride from "My location" tells the friend "Mi ubicación → Teruel".**
- Where: RideActions.svelte:100 uses `fromLabel`, which comes from Panel.svelte:676/695. The GPX file name has the same problem: Panel.svelte:247 produces `twisty-mi-ubicacion-…gpx`.
- Fix: name a `here` place after its town, as `savedPlace` already does (RideActions.svelte:109-112).
- Owner: app.

**10. Dead code.**
- Where: RideActions.svelte:49 (`nameOf`, unused, with 'Google Maps' hard-coded).
- Fix: delete it.
- Owner: app.

**11. The FileProvider exposes the whole external storage root.**
- Where: android/app/src/main/res/xml/file_paths.xml:3 (`<external-path path=".">`). OpenInPlugin only ever shares files from the cache (OpenInPlugin.java:78-84).
- Fix: keep only `<cache-path>`.
- Owner: app.

**12. Signing keys are not git-ignored.**
- Where: app/android/.gitignore:57-58 has `*.jks` and `*.keystore` commented out. No key file is in the repo today (I checked file names only).
- Fix: uncomment them and add a pattern for the Play service-account JSON.
- Owner: app.

**13. No tests on the release-critical state paths.**
- Missing:
  - App trip state: pickTrip with `here`, planAgain / leaveSaved, pickOnMap on a saved ride.
  - PlannerClient and worker error protocol (`failed` without an id, a crashed worker).
  - A trip whose ends snap to one node.
  - The address-search race.
- Fix: pull the App trip transitions into a pure module and test them; add a planner test for one node; add a client test with a fake Worker.
- Owner: app and routing.

**Other checks, nothing to report:**
- No bench or SPIKE hooks, debug flags or test-only paths in `src`.
- `console` is used only for errors, plus one candidates warning.
- No hard-coded UI text outside i18n.
- es.ts is typed `Messages`, so a missing key fails `npm run check`.
- Release config is sound:
  - applicationId is `com.sanchezpaco.twisty`, versionName 0.1.0, versionCode 100.
  - Signing reads local.properties or the environment.
  - Debuggable and WebView debugging follow the build type, so both are off in release.
  - Cleartext is off (targetSdk 36 default), and all tile URLs are https.
  - Permissions are INTERNET, COARSE and FINE plus Capacitor's ACCESS_NETWORK_STATE.
  - `minifyEnabled false` is acceptable here.

## What works, don't break it
- **FINE_LOCATION must stay.** Capacitor's WebView geolocation prompt (BridgeWebChromeClient.java:249-264) asks for COARSE and FINE together, and below Android 12 it grants only when the full request is granted. Without FINE, "My location" fails on the Huawei.
- **The stored-data parsers.** They set aside unreadable stores, keep and rewrite entries a newer version wrote, go read-only for a newer store, and fall back to "no trip" on bad text (savedRides.ts, savedRide.ts, tripStorage.ts, tripHistory.ts).
- **Nominatim discipline.** A 1.1 s gap reserved before waiting, a 60 s cool-down on 403/429 re-checked after the wait, a per-session memo, and the bias point rounded to 0.1° (geocoding.ts:23-35, 255-268).
- **Superseded plans are ignored.** The `latestRequest` guard in App.svelte:152-213 also clears the plan when an end is removed.
- **Google Maps waypoints.** The rider's stops go first, twisty pins share the remaining budget pinned end to end, and the URL never exceeds 9 waypoints (ride.ts:320-335).
- **Tracks are kept out of the build.** `dropTracks` removes tracks.bin; I confirmed it is absent from dist/data and android assets/public/data.
- **OpenInPlugin shares only cache files**, checked with a canonical path (OpenInPlugin.java:78-84).
- **Saved rides are self-contained.** Encoded lines, no edges, unaffected by later data changes; Plan again re-plans with the saved extra time.

## Gate results
The three gates in a heavy slot under `timeout 30m`, exit 0. Log: <scratchpad>/gates.log
- pipeline pytest: 118 passed in 0.49 s.
- app vitest: 62 files, 561 tests passed (44.5 s).
- npm run check: svelte-check 215 files, 0 errors, 0 warnings; all four tsc projects passed.

The scratch test that reproduces finding 1 is <scratchpad>/probe/samenode.test.ts. I changed no repository files.
