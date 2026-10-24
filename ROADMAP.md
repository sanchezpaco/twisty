# Roadmap

Legend: `[x]` done · `[ ]` pending

## Next up

1. [x] **Same-road merge gap.** The app joined two curvy runs of one road across any straight, so València → Los
   Santos de Maimona showed "N-322, 121 km, Suave" (20 km curvy, up to 101 km of straight inside), pinned and counted
   as twisty km. Joins now stop at `MAX_SAME_ROAD_GAP_M`; bench check R14 `straightInTwisty` guards it.
2. [x] **Bench data and fixes** (`reviews/2026-10-13-road-scout-seeds.md`): apply the seed corrections and the 18 new
   through-roads to `great-roads.json`, fix `addedOn`, dead-end detection by reachability, G2 report with the graph's
   fun share next to the overlay, report ids that disappear. Owner: routing session.
3. [x] **Pipeline fun model** (`gis-data-engineer`), each step measured on the bench (D3/D4, great roads, G6) and on
   graph and APK size, with before/after for Mare de Déu del Mont, GIV-5221, C-462, BV-5114, Vidrà and JV-7032:
   - [x] A posted limit ≤ 50 km/h zeroes the fun outside towns (`roads.py` `fun_weight` against its own comment on
     `PACE_SPEED_KMH`): treat low limits as urban only inside built-up areas. Blocker. With the `rider-safety`
     guards (one-way, barrier and gate nodes, conditional closures, destination-only, fords, rough surface, service
     ways, street names) and the narrow / posted-limit export (`graph.bin` TWG3) for the app's chips.
   - [x] `highway=residential` is dropped, which leaves false dead ends like Vidrà: keep residential as no-fun
     low-speed connectors, at least those joining kept components; mind graph size on the Huawei. Blocker.
   - [x] Win back the local roads the pace factor lost: about 400–500 good roads mapped as `unclassified` dropped to a
     quarter of their fun (Carretera de Vidrà a Sant Privat d'en Bas, Mare de Déu del Mont, Tost, Santa Engràcia,
     JV-7032 Segura de la Sierra…). Treat `unclassified` with a `ref` or a road-like name (Carretera, Estrada,
     Errepidea, Carreterín) as tertiary; keep farm lanes and unnamed lanes at a quarter. The village lanes this
     promotes (new reds around Sort and Tremp) are accepted: good curves count (maintainer, 2026-10-15).
   - Landed with few-stops on 2026-10-15 (f735f8e): baseline re-recorded, 0 G1 losses, recall 44 of 125, settled
     nodes +9.4 %.
4. [x] **Route quality bench, slices 1–2** (Phase 4b, `docs/route-quality-bench.md`): the runner, then the first
   validation set of known great roads: the ones above plus the rider's classics (CV-35, CV-345, CV-363…). Measurable
   rule: for a trip that passes nearby, a slider stop rides every listed through road within 90 min of detour, and a
   road found once is never lost (rule and dead-end roads decided 2026-10-14, see Phase 4b). Owner: routing session after
   Batch B; `road-scout` supplies the roads.
5. [ ] **Test ride and calibration** (weekend): see "Test ride València → Los Santos" and the calibration script
   in Phase 4.
   First ride done 2026-10-17 (`data/eval/2026-10-17-ride/wikiloc.gpx`, git-ignored; a brisk but ordinary rider): it matches the +35 min stop at 97%. Moving time is 0.77 of predicted on
   open roads (motorway 0.78), 0.58 on the twistiest (CM-2251 predicted 35 km/h, ridden 60), and towns are slower
   than predicted (1.16-1.50). An upper reference, not a tuning target: look first at the curve cap on twisty
   primaries and at town crossings.
6. [x] **Setup finds a modern Python.** `make setup` uses `python3` by default, which on macOS is the system 3.9
   while the pipeline requires >=3.12 (`pipeline/pyproject.toml`), so a fresh setup fails. Make the Makefile find a
   Python >=3.12 (or fail with a clear message) and say so in the README. Owner: routing session
   (`gis-data-engineer`).
7. [x] **Twisty overlay as vector tiles** (`plans/2026-10-14-overlay-load.md`). The overlay was 4,951 lines serialised
   into MapLibre's worker after `load` (1.28 s freeze, 8 s to appear on the Huawei). `make overlay` cuts z0–12 tiles
   with geojson-vt; the app reads the count from `meta.json` and `twisties.json` no longer ships. Device pass 2026-10-14
   (Huawei, median of 5 cold starts): first overlay tile 1.9 s (was 8.1 s), longest main task 330 ms (was 1.28 s).

8. [x] **Route defects** (`reviews/2026-10-16-blind-eval-v1.md`, maintainer 2026-10-16): no out-and-back on the same
   road, no route across a city centre when a ring road is there, no side loop off a good road that adds minutes and
   little fun. Each one measured by a bench check, then the kit judged again against v1. Owner: routing session.
   Landed 2026-10-16 (e4efc56, 00a34ac): out-and-back 46 stops -> 0; dominated loops were already 0 (80 low-return
   loops listed for 9); a 30 km/h town cap lost two G1 and did not move the city crossings (R16 stays a report: the
   crossing is the cheaper way by minutes). Judged blind: one more miss won, sample unchanged beyond judge drift.
9. [x] **The value of a road, judged blind**: village-dense lanes valued too high, wide fast passes (Lunada, Puerto del
   Pico, La Hermida) too low. New signals (junctions and houses along the road, relief), weights fitted with
   cross-validation and judged by the kit, not by the great-roads list. After 8.
   Relief (local climb, floor 0.8) fitted and read once on the held-out set: no change, not landed (branch
   `road-value` keeps the DEM step, relief and the kit's `--trips`; the 25 fresh trips are unspent). The held-out read
   shows today's value runs against road worth (Spearman about -0.11; classics 0.39 against lanes 0.69): flowing
   classics get little curve fun. Next signal is the maintainer's product choice (`reviews/2026-10-16-road-value-relief.md`).
   Flowing fun (`plans/2026-10-16-flowing-fun.md`), the maintainer's choice: step 1, curve fun along the road instead
   of per OSM way, landed (judged blind modestly better; G1 8 lost / 6 gained, reshuffles, accepted by the maintainer).
   Town crossings' corners no longer feed the road around them (E), landed with 2 G1 reshuffles accepted (C-462
   Tuixent, CV-345 Alpuente-Titaguas). Step 2, the speed-scaled heading change (k = 2), closed with no change: it
   failed the bench (G1 19 lost / 4 gained, recall 62 -> 48 of 110) because one appetite route per slot lets a raised
   fast pass take a tight road's slot (branch `flowing-fun-k2-exp` kept). The next lever is the stop rules (Next up 10).
10. [x] **Orienteering planner** (`plans/2026-10-16-orienteering-planner.md`): one objective instead of the stop rules,
   chains of great roads. After 9, because it optimises the value harder.
   Steps 1-3 landed 2026-10-19: the slider's stops as one set, chains of twisty roads over a directed 20-min leg table
   (candidates.bin 0.25 -> 2.43 MB). Recall tuning 60 -> 75 of 109, holdout 7 -> 7 of 22; expert blind read a draw;
   Huawei Madrid -> Granada 4.1 -> 2.5 s warm. The maintainer accepted 3 G1 trades: C-462 Tuixent - La Seu on two
   trips, CA-9104 on the A-397 trip. Later lever: pay a great road as the rider knows it, only on stops that ride its
   great member (branch `orienteering-great-runs`, rejected as is by the blind read).
11. [x] **CV-712 Pego - la Vall d'Ebo is cut in the graph**: two runs of the ref end about 30 m apart in la Vall d'Ebo and
   are not joined (shortest link a 20 km detour by the CV-700), so the climb from Pego is a dead end for the planner.
   Find the cause (dropped street, barrier node, cut) and whether other refs break the same way. Owner: routing
   (`gis-data-engineer`), after the flowing-fun work.
   First finding (2026-10-17, not yet confirmed in the code): the two runs end at OSM nodes 252039342 and 2127069749,
   8.5 m apart, joined in OSM only through the residential way 23287384 "Avinguda de la Marina Alta", which
   `osm.read_connectors` does not keep. Paused for Next up 13.
   Landed 2026-10-18 (`plans/2026-10-17-cv712-connectors.md`): a dead end left unjoined by the whole-street search is
   joined through the middle of a street. Pego -> la Vall d'Ebo 39 -> 23 min, all CV-712. Bench: no G1 loss, recall
   unchanged, 245 km of residential links added, 374 m dropped. Open: cross-020 reshuffles 5 stops by up to 17 min
   without riding a changed piece; renumbered candidate ties are the likely cause, not proven.
12. [x] **The locate button next to the start field does nothing**: `Panel.svelte` passes the click event to
   `onlocate`, and `locate()` in `App.svelte` takes it as its `then` callback since the recent-trips change (268caa2), so
   the position never fills the start field and no error shows. Found by the maintainer on the Fold, 2026-10-17. Also
   check that "My location" in the list shows the location error when the fix times out. Owner: app
   (`frontend-engineer`), with a test.
13. [x] **Blocker: impossible sharp turn in a route.** València -> Los Santos, the +17 min stop (Fold build b1bd3c6,
   2026-10-17): near the Quart de Poblet / Manises interchange the route runs out along one road and turns back at an
   acute angle onto another, where the real road goes round the grey curve to the right (screenshot
   `data/eval/2026-10-17-valencia-sharp-turn.jpg`, git-ignored). Find the edge pair and why the graph allows it (OSM turn
   restriction ignored, a U-turn at a dual-carriageway node, a crossing that shares a node, a contracted shortcut), fix
   the cause, and add a bench check that no route turns sharper than a legal turn outside roundabouts and turning
   circles. Owner: routing, before anything else.
   Huawei baseline before the fix (main 2e0580f, 2026-10-17, plan() alone, median of 7): Jaca -> Benasque 459 ms
   cold / 255 warm, Madrid -> Granada 3,250 / 2,991, València -> Los Santos 807 / 570 (`data/device-pass/`, script
   `plantime.mjs` there). The one-way build is measured the same way before a tester APK.
   Landed 2026-10-17 with one-way roads (branches `oneway` and `oneway-speed`). The maintainer accepted the four G1
   losses: BV-5114 santa-fe-ends (a correction), BV-5114 santa-fe, A-337 La Ragua and CA-9104 regional-033 (stop
   rules). R20 (Google pins on town one-ways ridden the wrong way) is at 0 since branch `town-pins`. Still open before
   a tester APK: the Huawei pass of the speed-up (Mac x1.29 of main).
   Confirmed on the Fold by the maintainer (tester build 61ef806, 2026-10-18): the impossible turn is gone.
14. [x] **Street search misses real addresses**: a street typed as "avenida escultor <name>" returns "no addresses
   found" even with the search button. Check the query sent to Nominatim (bilingual names such as "Avinguda de
   l'Escultor <name>", the street type, the town bias, the viewbox) and fix it with tests on Spanish and
   Valencian/Catalan/Galician street names. Owner: routing (with the Nominatim headers and memoise item).
15. [x] **Map styles**: besides the dark style, a satellite view and a normal light map, chosen by the rider, so they
   can see the roads they will take. Needs a free source cleared by `data-policy-reviewer` (e.g. IGN PNOA orthophotos
   for Spain), the twisty overlay and route legible on each, and a plan from app with ux-designer and cartographer.
   Plan `plans/2026-10-17-map-styles.md` reviewed (ux, cartographer, data policy): PNOA is usable with a visible
   dated credit; slice 1 (Light and the switch) may be built; slice 2 (satellite) after the credit and the Huawei check.
   No email to CNIG (maintainer, 2026-10-17): the visible credit is the only condition; ask only before offline packs.
   Slice 1 landed (Light map and the style switch, approved by the maintainer on shots, 2026-10-17).
   Slice 2 landed 2026-10-18 (satellite, IGN PNOA, approved by the maintainer on shots). Huawei: 3-5 s to a full view,
   pans like Dark, 3D settles in 3.5 s, peak PSS 500 MB in 3D (`data/device-pass/2026-10-18-satellite/`). Fold
   2026-10-19: status bar legible on bright photos, folded and open; Nominatim sends the Twisty user agent.

16. [x] **Stops in the trip (via points)**: the rider adds intermediate places, as in Google Maps, to chain a ride
   (e.g. València -> Teruel -> Segorbe -> València, a loop). The planner plans each leg with its own twisty detours and
   the slider applies to the whole trip; the Google Maps URL keeps the rider's stops and stays within 9 waypoints
   (drop or merge detour pins first, never a rider's stop); GPX carries them too. Needs a plan from routing (legs, the
   slider over several legs, the waypoint budget, loops back to the start) and app (adding, reordering and removing
   stops on the mobile sheet and the desktop panel), with ux-designer. Asked by the maintainer, 2026-10-17.
   Next for app and routing, with 18 (maintainer, 2026-10-18).
   Planner half landed 2026-10-19 (`plans/2026-10-18-via-points-planner.md`); the expert-rider's read of the via set
   (`make bench-via`) found two problems that are fixed before stops reach the maintainer (director, 2026-10-19), planned
   in `plans/2026-10-19-via-quality.md`. Owner: routing.
   - The default buys filler, not the leg with the best road: moved to the fun model item (director, 2026-10-19), where
     the measurements are.
   - [x] **A leg passes its own end or comes back to its start** (loop option 9 past Segorbe to Soneja and back; Jaca
     option 9 back into Jaca): 2 of 99 legs of the via set, 11 of 1,028 options of the two-point bench. Fixed
     2026-10-19 (branch `via-quality`): such a ride is left out; 0 of 99 legs, no G1 loss, twisty km per budget within
     0.1 %, three great-road trips change routes.
17. [x] **Share button** next to "Open in...": shares the planned ride through the system share sheet. Built from
   ux-designer's note: text only (summary, known roads, the Google Maps link last), GPX stays in Open in...; clipboard
   fallback with a toast. Asked by the maintainer, 2026-10-17. Still to check on the Fold: WhatsApp and Telegram.

18. [x] **Saved rides in folders**: the rider saves a ride they like and files it in folders they create, rename and
   delete (e.g. "Pirineo", "Domingos"). Stored on the device only (no accounts), next to the recent trips. A saved ride
   keeps the ride itself (its Google Maps waypoints, GPX and summary), so a data update never changes it; re-planning
   it is a separate action. Plan by app with ux-designer; it builds on the share button and the via points (a saved
   ride carries its stops). Asked by the maintainer, 2026-10-17.
   Landed 2026-10-18 (`plans/2026-10-18-saved-rides.md`; ux-designer and code-reviewer rounds, Huawei check: 41 rides
   open in 0.24 s, the save sheet clears the keyboard). Still to measure: scroll smoothness of a long list on the Huawei.

19. [ ] **Advanced mode: edit a stretch**: the rider marks two points on the planned ride (e.g. km 20 to 60) and that
   stretch opens with its own slider of alternatives, spliced back into the ride; repeat to chain great roads by hand.
   Later "avoid this road" on a tapped stretch, and dragging the route. Hidden behind an advanced mode: the default
   stays "start, finish, slider, ride". Designed together with the via points (a stretch is a leg between two stops)
   and with the orienteering planner in mind. Asked by the maintainer, 2026-10-17. First test case: València -> Los
   Santos, whose default ride opens with a motorway stretch; mark it and see what twisty links exist for it. Prove it
   makes sense on real trips before building the UI.
   Waits for a good routing baseline (maintainer, 2026-10-18): after the orienteering planner settles.
20. [ ] **Fewer Google Maps waypoints (optimisation, later)**: measure how few pins Google Maps (and the GPX apps) need
   to keep the ride on our roads, instead of pinning every twisty; when a ride still needs more than 9, say so in the
   app and offer the GPX path instead of dropping roads silently. After 16 and 19 make long rides common.

21. [ ] **Route geometry drifts off the road at close zoom**: over the satellite photo at z15 the drawn route visibly
   leaves the real road (Alpujarra, `data/map-theme-shots/satellite/p-alpujarra-z15.png`), from the simplified edge
   geometry. Measure the drift (metres off the OSM way) and simplify with a tolerance that holds at z15-16, minding
   graph.bin size and the Huawei. Found by app on the satellite build, 2026-10-17. Owner: routing.
   Cartographer: edges are Douglas-Peucker at `GEOMETRY_TOLERANCE_M = 15` (`graph.py`), ~20-29 m off at the Alpujarra
   hairpins (10-15 CSS px at z15, invisible below z14). First fix: draw a ride's twisty stretches from the twisty's own
   4 m geometry, already shipped (no graph.bin cost); then measure a lower edge tolerance.

22. [ ] **Street search, the misses 14 leaves** (`plans/2026-10-17-street-search.md`, known limits):
   - "<street> valencia" also matches the province, whose namesake streets fill the list before València city's
     (calle colon, pintor sorolla, marques de sotelo, blasco ibañez). Read a trailing town against the offline
     place index and send a structured `city=` query.
   - A Spanish street type on a Catalan-only name ("paseo de gracia" for "Passeig de Gràcia") and spellings across
     languages ("diputacion" / "Diputació").
   - A wrong but non-empty first answer stops the fallbacks ("calle del franco santiago" finds a León street).
   Measure on the 22-query set of 14. Owner: routing.
23. [x] **Travel time depends on where a road is cut**: `graph.py` `add_way` caps speed by the twist density of each
   junction-to-junction stretch, and the cap is not linear, so a new junction re-times the road it cuts (CA-520 split
   in two: +7.7 s; a 20 m N-611 edge 4.8 -> 0.7 s when a bend's deflection lands in the next piece). A few seconds
   flip the appetite sweep at a threshold: cross-020 changed 7 of 9 stops after CV-712 without riding a new street.
   Compute the density independently of the junctions and check that splitting a stretch keeps its time. Owner:
   routing, plan first.
   Landed 2026-10-18 (`plans/2026-10-18-junction-free-times.md`): time integrated along the way, roundabouts 24.8 ->
   20.6 km/h. G1 0 lost, 1 gained; holdout recall 6 -> 7 of 22. D2 slightly down (best twisty km per budget -0.4 to
   -2.3%) because bends at junctions now cost time. Follow-up: read the time window along the chain, as the fun does,
   so way ends stop clipping it (no plan yet).
24. [x] **Tracks off until a dedicated off-road update**: hide the "Include tracks" switch and stop shipping
   `tracks.bin` (133 MB of the 180 MB debug APK). The pipeline and planner code stay on main for Phase "Off-road".
   Maintainer's call, 2026-10-18. Owner: app. Landed 2026-10-18 (`plans/2026-10-18-tracks-off.md`): debug APK 119 -> 39 MB.
25. [ ] **Narrow roads without a centre line** (test ride València -> Los Santos, 2026-10-17; filed only, no
   change for now): some curvy stretches were too narrow to ride relaxed, with no centre line. Today `is_narrow`
   feeds only the chip, and Spain's minor roads rarely carry `width` or `lane_markings`, so a fun penalty needs a
   proxy (class, ref family, maxspeed) measured against the validation set first, without sinking the great narrow
   mountain roads (AS-227, CV-712). Pairs with the `is_narrow` over-flag item below.
26. [ ] **Plan time after one-way roads, on the Huawei** (2026-10-18, plan() alone, median of 7, cold/warm ms;
   `data/device-pass/2026-10-18-satellite/plantime-roads.log`): Jaca -> Benasque 508/263, Madrid -> Granada
   4,421/4,174, València -> Los Santos 906/671, against main before one-way 459/255, 3,250/2,991, 807/570. The Mac's
   x1.29 speed-up shows as x1.06 on the phone. Long trips miss the 2 s target by far. Profile on the phone before
   any change; correctness stays. Owner: routing.
28. [ ] **3D barely shows at trip zoom** (maintainer, 2026-10-19: "it only tilts"): terrain is on (exaggeration 1.5),
   relief is clear at z11-13 on Satellite but hard to see at z7-9, and Dark is near black in the mountains
   (`data/device-pass/2026-10-19-fold/`). Proposals: a closer camera when 3D turns on below z10; exaggeration by zoom
   (cost on the Huawei); a stronger hillshade in Dark 3D (cartographer). Owner: app.
   Maintainer, 2026-10-19: unsure; zooming in may be dizzying. If anything, zoom only as part of turning 3D on, never
   by default when a trip opens. Low priority.
30. [x] **App icon from the Twisty logo**: the Android launcher icon (adaptive, with its round and themed variants)
   and the splash use the logo the app shows, not Capacitor's default. Asked by the maintainer, 2026-10-19. Owner:
   app, ux-designer on the result; shown to the maintainer on the Fold's home screen before landing.
   Landed 2026-10-19 with the current logo, its background lifted at the rim for dark wallpapers. Six alternatives
   were drawn (`data/logo-alternatives/`); the maintainer kept the current one.
31. [x] **Slider dots after orienteering** (maintainer, 2026-10-19: "why are there dots over some bars?"): the dot marks
   a forced stop (coverageRoad). Before orienteering 1 of 963 stops had one, now 217 of 1,063 (108 of 127 trips, up
   to 5 per trip), so it no longer stands out and nothing explains it. 7 of 217 mark a road another stop also rides,
   and 46 name a road that is not among the stop's own twisties (e.g. B-124 named, BP-1241 listed), so the summary
   promotes nothing for them. Maintainer, 2026-10-19: remove the dot (confusing); keep the "+ Added" label in the
   summary. Dot removed 2026-10-19. Label fixed 2026-10-19 (branch `coverage-label`): a forced stop names, and points
   at by index, its own twisty that rides most of the added road, so "+ Added" is on the right twisty even when two
   twisties share a label; on the bench 0 of 217 forced stops name a road missing from their twisties (46 before).
   Owners: routing (labels), app (the dot).
32. [x] **Say that Google Maps may change the ride** (maintainer, 2026-10-19): in "Open in…", a short line in the
   spirit of "Google Maps may change your route; we recommend apps that read the GPX directly", and the GPX apps
   marked as following the exact line. Stronger when not every twisty is pinned. No pop-up. Owner: app, with
   ux-designer; ships with the via points.
   Landed 2026-10-19 with the via points UI.
29. [ ] **Pins cut at the edges on the Fold cover** (Cuenca -> Teruel, 475 px wide): the fit margin keeps the route
   inside but not the A/B pins' radius. Owner: app.
   Orienteering branch c769f70 on the Huawei (2026-10-18, n=5 vs 4, `data/device-pass/2026-10-18-orienteering/`): warm
   Madrid -> Granada 2,464 vs main 4,147 ms, València -> Los Santos 531 vs 680, Jaca -> Benasque 326 vs 311; load
   40-300 ms slower; PSS the same.

## Phase 0 — Foundations

- [x] Repository, `CLAUDE.md`, `ROADMAP.md`, conventional commits
- [x] Stack decisions (see `CLAUDE.md`)
- [x] Agent team and hierarchy (see "The team" in `CLAUDE.md`)

## Phase 1 — Data pipeline (Spain)

- [x] Download Spain OSM extract (Geofabrik) and pre-filter drivable roads with `osmium-tool`
- [x] Twistiness metric: total heading change per km on de-noised geometry
- [x] Twisty segment extraction: merge ways into roads (by ref/name), find long curvy runs, score them
- [x] Contracted routing graph (junction nodes only) with per-edge travel time and road class
- [x] Compact exports: `graph.bin` (binary) and `twisties.json` (encoded polylines)
- [x] Unit tests for geometry, twistiness and segment extraction

## Phase 2 — Planner (on-device)

- [x] Load graph into typed arrays (CSR adjacency)
- [x] Bounded Dijkstra with reusable buffers
- [x] ~~Candidate twisty selection + Pareto DP over discrete twisties~~ (replaced, see below)
- [x] Continuous fun score per edge; one search per curve appetite, refined where routes jump in time
- [x] Slider stops: thin the Pareto frontier into meaningful options
- [x] Partial rides: in-between options riding only some consecutive twisties of a curvy route
- [x] Route reconstruction (geometry + stats: time, curvy km, motorway km)
- [x] Google Maps URL with waypoints that pin each twisty
- [x] Run the planner in a Web Worker
- [x] Unit tests for heap, Dijkstra, Pareto and URL builder; smoke test on Spain data
- [x] Unit tests for the planner on a synthetic graph

## Phase 3 — Web prototype UI

- [x] Custom dark map style with hillshade and optional 3D terrain
- [x] Spain-wide twisty overlay coloured by rating
- [x] Place search: instant offline towns/villages, Nominatim for streets on request; "my location", long-press to set A/B
- [x] Route slider with live redraw and animated transitions
- [x] Stats, twisty list and "Open in Google Maps" call-to-action
- [x] Mobile bottom sheet + desktop floating panel
- [x] English and Spanish UI, from the device language, switchable and remembered
- [x] Trip history instead of the restored trip: launch opens clean, "Recent trips" on the start screen (5, at most
  one never handed over), the handed ride restored only within 2 h (maintainer, 2026-10-15;
  `plans/2026-10-15-trip-history.md`)
- [x] Trip history on the phone: confirm the Android WebView fires `visibilitychange`/`pagehide` when the app goes to
  the background (plan a trip, Home, reopen: it is in the list). Z Fold device pass 2026-10-16, all items pass
  (`data/device-pass-2026-10-16/`)
- [x] Side panel, English: the Curves card ellipsises "mostly windi…", and the pins note overlaps a faded twisty row
  at the end of the curvy-roads list (`data/trip-history/real/foldopen-en-3-restored.png`)

## Phase 4 — Route quality

- [ ] Validation set of known great roads per region (Pyrenees, Gredos, Alpujarras, Cantabria…), as a test that
  fails when one stops being found; it also gates every size optimisation in Phase 7. Built as the bench's
  great-roads list (Phase 4b)
- [ ] Tune twistiness thresholds and speed model against real ride times (estimates are conservative: Madrid→Granada 4h37 vs ~4h10)
  - Curve speeds look too slow: Kurviger's "extra curvy" València → Los Santos (CV-345, CV-363) is 150 min by
    Kurviger, 180 min by our model; we cap tight roads at ~40 km/h where Kurviger assumes ~66
  - [ ] Test ride València → Los Santos with a route planned in Twisty: note the chosen slider stop and Google's
    estimate, navigate with Google Maps (note where it leaves the route), record a GPX with Wikiloc
  - [ ] Calibration script: match a recorded GPX to the graph, drop stops (< 5 km/h), compare moving speed per road
    with the model and fit the curve speed constants (straights stay capped by the legal limit)
- [x] Count fast sweepers, not only tight bends (fun curve: 40°/km → 0, 150°/km → 0.55, 500°/km → 1)
- [x] Treat `maxspeed ≤ 50` stretches as urban (no fun)
- [x] Curves only count at pace: fun scales with the road class cruising speed (unclassified lanes keep 25%)
- [ ] Refine pace with narrowness (`lanes=1`, `width`): today a narrow road keeps its fun and the app warns (chips)
- [x] Never route over unpaved roads by default (surface, tracktype, smoothness and name heuristics)
- [ ] Penalise villages without a speed limit tag (landuse, junction density, traffic signals). Measured 2026-10-15
  (stack data): `fun_weight` zeroes a built-up way only when its posted limit is 50 km/h or less. Of the eligible roads
  (trunk to unclassified), 25,726 km are built-up without a `maxspeed` tag and 19,917 km of them keep their fun (11,679
  km with a limit of 50 or less are zeroed). Street-named ways (Calle, Avenida, Carrer, Paseo, Rúa…) cover 22,864 km, of
  which 8,133 km are zeroed. They rarely make a twisty (4 km of consecutive curves): 36 twisties, 220 km of the 45,873
  km (0.5 %), rating 2 to 5, carry a street name, and the rating 4-5 ones are numbered roads that leave a town. Small for
  the overlay and the bench; the cost is in the fun counted inside towns on a route, not yet measured
- [ ] Verify Google Maps actually follows each twisty (waypoint placement heuristics), measured by the bench's
  pin-fidelity check (Phase 4b)
- [x] Respect one-way roads: the graph knows directions (Next up 13, `plans/2026-10-17-one-way-roads.md`), the bench
  fails a ride against one (H13) and a U-turn from one carriageway onto the other (H14). A town's one-way streets are
  still ridden both ways (R19 reports it), see the next two items.
- [ ] **Turn restrictions and U-turns in the search**: a turn-aware (edge-based) search with costs for OSM turn
  restrictions and U-turns. Spain has about 142,000 restriction relations: only_straight_on 45,470, no_u_turn 43,044,
  no_left_turn 31,961, no_right_turn 8,056, only_right_turn 7,192, only_left_turn 4,674, about 1,100 via a way; the bench
  stops broke about 4,000 of them before one-way roads (approximate geometric match,
  `.claude/handoffs/routing-scripts/restrictions.py` and `wrong_way.ts`). Risk: an edge-based search has about twice the
  states, so planning time on the Huawei must be measured before it is taken on. Owner: `routing-engineer` +
  `gis-data-engineer`
  Part done 2026-10-18 (branch `split-end-uturn`): no turning back from one carriageway onto the other where a split
  road ends (from 120 deg; OSM forbids 5,119 of the 13,341 turns it bans and allows 37). Found by H14 in Málaga and A
  Vila, both against an only_straight_on.
- [ ] **Town streets in the graph**: the residential streets of built-up areas, so that a town's one-way streets can be
  ridden one way only. Without them a place can be legal to leave only by a long loop (Montellano: 37 min to the A-361
  2 km away; before the town streets were made two-way, 428 of 8,654 towns had a road nearby 5 min or more dearer legal
  than two-way, 55 of them 20 min or more). Mind graph.bin size on the Huawei. Later.
- [ ] Avoid legs that backtrack along an already ridden twisty
- [ ] Built-up masking per sample: a way is built up or not as a whole, judged by its middle, so a long way that
  starts in a village or crosses hamlets (LU-P-1901, AS-233, AS-352) is judged by one point. Mask the fun per profile
  sample within the radius instead (`rider-safety` finding 9)
- [ ] A ring road reads as a twisty: "N-322 · Carretera de Circunvalación" (30 km, 27 km of curvy edges) rides a
  Jaén bypass as if it were a mountain road. Check whether the fun model or the chain merge makes a bypass curvy, and
  whether a name like Circunvalación/Ronda should score as urban (València → Los Santos de Maimona, cartography review
  finding 8)
- [x] Trip generation against the great-road rule: generated trips ride near a road without demanding it (road-scout
  finding 7). Decided 2026-10-14: great-road trips start and end 20–60 km beyond each end of the road (not 170–340 km
  apart). Branch `bench-trips`, after the fun-model stack and few-stops land, with a new baseline
  Landed 2026-10-16 (2a76c43): 25 `-ends` trips replace the 24 `-gen` ones; the named road is demanded in 24 of 25 and
  found in 18 (was 4 of 17); the 102 other trips are unchanged
- [x] Own-road misses of the `-ends` trips (`reviews/2026-10-16-own-road-misses.md`): no planner bug. Causes: the
  planner's cap min(90 min, half the fastest) is below the bench's 90 min demand (CV-70 Confrides; 37 of 132
  demanded pairs, 24 of them not found); candidates split at short zero-fun junction edges so 80 % of the road is
  unreachable (N-502 Pico 77 m, GIV-5221 128 m, C-462); dominance otherwise (N-502, GIV-5221, JV-7032); C-462's best
  piece is great rank 35, outside MAX_GREAT_CANDIDATES (20); CV-345 is not a candidate (43 % curvy)
- [x] Detour cap: 90 min on any trip, the slider picks how much (maintainer, 2026-10-16). Branch `detour-cap`: the
  half-trip share is gone (`detourCapS = min(maxExtraS, 90 min)`) and `MAX_GREAT_CANDIDATES` is 30, because with the
  cap off far great roads push two found ones out of the top 20 (C-462 great rank 9 -> 27 of 301, CA-9104 26 of 150).
  Bench on the Mac: 12 trips change, recall tuning 58 -> 61 of 110, holdout 8 -> 8 of 22, no G1 loss; only 3 of the 24
  unfound demands are found (the others are bound by dominance and splits, not by the cap); settled nodes mean
  1,305k -> 1,351k. The default stop is unchanged (45 min). Huawei (8 alternating cold launches, plan() apart from fetch
  and parse): the 4-min urban trip 0.11 -> 0.22 s, a 28-min trip 0.08 -> 0.12 s, Madrid -> Granada 2.8 s both. The
  4-min urban trip's slider goes from 1 to 6 stops (up to +172 min), and Ripoll -> Olot loses C-153 on its last stop
  to Vidrà - Sant Privat, which is dominating it now that it is in reach: both are for the maintainer to see
- [ ] Quality over quantity in the ride score (maintainer, 2026-10-16): at equal time, 18 km of a very good road beats
  44 km of an ordinary one. Measured (`reviews/2026-10-16-quality-score.md`): a quality weight on the fun km (f^p, p 1.5-4,
  or per band) loses recall and 3-8 G1 on every setting and fixes none of CV-70, N-502, GIV-5221, JV-7032; family 2 of the
  speed-aware fun alone (max of today's curve and the lateral load) keeps and lifts the sweepers but loses 4 G1 great
  tertiary roads in the slider's stop thinning and adds 16 % twisties to the overlay. Maintainer's call (2026-10-16):
  first a stop thinning that keeps great roads that are on the frontier, then family 2 again on top of it
- [x] Stop thinning that keeps great roads on the frontier (`reviews/2026-10-16-thinning-great-rides.md`, branch
  `thin-great`): the first frontier point that rides a rated 4-5 candidate no stop rides becomes a stop (3 minutes, more
  score, 2 km more twisty km), the stops after it step up from it by the slider's rules or give way to it, and it may
  take the place of the stop within a step before it. Today's data: 0 G1 lost, 1 more demanded pair found (BV-5114), 12
  trips change, 4 default stops move, no more near-equal neighbours. Family 2 data: CA-9104 and CV-363 come back; CV-345
  (not a candidate) and Vidrà (dominated, no frontier point rides it) stay lost
- [x] Candidates merged across junctions under ~150 m of zero-fun edges (`reviews/2026-10-16-junction-merge.md`): the splits
  are a changed name along one ref; a ref merge reaches 97-100 % of one candidate on N-502, GIV-5221 and C-462 but finds
  no road newly and loses one G1 (the great 14 km piece of C-462 dissolves into a 63 km candidate of rating 3). No change;
  measure again after the detour cap decision
- [ ] Few slider stops on short trips (road-scout finding 8): decide whether a short trip with little to gain should
  show fewer stops or a wider budget; three of the four posted-limit G1 losses point at it. Includes the trips with no
  curvy option at all (València → Marines, Serra de Calderona; `reviews/2026-10-14-round-2.md`)
- [ ] Google Maps shows coordinates for the origin and the destination: send the place name when it comes from the place
  index, with the town centroid snapped to a routable road (round 2)
- [ ] Place search: "Guadal" does not find Guadalest, and the "near X" anchor reads wrong (Chelva "near Utiel", Morella
  "near Cantavieja"): it should be the comarca capital or the nearest larger town of the same province (round 2)
- [x] Coverage stops (maintainer, 2026-10-14; `plans/2026-10-14-few-stops.md`): when a great road near the trip rides
  in no slider stop, up to 2 middle stops become rides that add it (never the fastest, the stop after it or the
  max-curves); the ride summary lists the added road first. Owner: routing, then app for the label. Planner side
  landed with few-stops (f735f8e); the "+ Added" label landed in db5bb98, with the safety chips (signed limit,
  narrow, ford) in c5935cc
- [x] Fun model calibration, step (d) of the fun-model stack, before it lands (maintainer, 2026-10-14; road-scout):
  hairpin stacks score like one bend (fun capped at 500°/km), fast sweepers score near straight, chains break at
  passes (N-260 in 6 pieces). Calibrated on a labelled set held out from the bench; AS-227 Somiedo must come back
  through the model. Bench fixes approved with it: AS-227 demands only the gorge and the pass, N-260's -gen trip
  (86 min detour) is retired or regenerated. Owner: routing (gis-data-engineer)
- [ ] Fun model: a new signal for "mixed" roads. Step 2 of the calibration (2026-10-15) found no curve-density change
  that beats the baseline: flowing passes (Belagua, Belate, Comiols) score low and busy-but-ordinary ones (Nansa,
  Piedrasluengas) high. Try gradient/altitude, width or surface; the held-out calibration set (`data/calibration/`, test
  half still unread) is the yardstick. AS-227 Somiedo is found only as a by-product until then. The rating colour
  has the same blind spot: it is the stretch's fun fraction (Epic ≥ 0.92), so how continuously the curves chain, not
  how good they are; a great road with straights or a village shows orange while a 3 km village lane shows red
  (2026-10-15: no red on València → Los Santos on the Fold). Measured on that ride: the best stretches
  (CV-429 0.800, A-3001 Adamuz–Obejo 0.792 over 61 km, N-322 0.792) are curvy end to end with no straight, village
  or pace loss; their bends score 0.65–0.92 each under the curve fun mapping (150°/km → 0.55, 500°/km → 1)
- [x] Slider thumb stops over the middle of the bar it selects (maintainer, on a phone; a40fde6)
- [ ] `is_narrow` over-flags (measured in the head-to-head, 2026-10-15): `lanes=1` on a 5 m trunk (N-260, N-430: 30 km
  on the fastest València → Los Santos) and every `lanes=1` roundabout count as narrow; it feeds the narrow chip, not
  the fun. Narrow should need a small width, or `lanes=1` without `oneway` on a minor road, never a roundabout
- [ ] "km on rating ≥ 4" in the ride depends on how runs merge across gaps ≤ 1 km (València → Alicante: 0 km in the
  planner, 103 km from the same ride matched from its GPX); the head-to-head uses a stretch-free share (5 km around)
- [ ] "Surface unverified" chip per twisty row, after the fun-model stack lands: roads promoted by name without a
  surface tag (`Way.promoted_unverified`) need TWG4 (+1 byte per edge) and a per-twisty share in the ride. Copy
  approved: chip "Firme sin verificar" / "Surface unverified"; note "Alguna carretera de esta ruta no indica su firme en
  OpenStreetMap: puede no estar asfaltada." / "Some road on this ride has no surface recorded in OpenStreetMap, so it
  may not be paved." Owner: routing (export), then app
- [ ] Later: "Also nearby: <road> (+min)" chips under the slider to route through a road by hand (option 2 of the
  coverage decision, kept for later). It is also where the three dead-end great roads (Mare de Déu del Mont, Tost,
  Santa Engràcia) come back: the planner does not ride out-and-back spurs, so a chip is the way to offer them
- [ ] Review the tarmac the bench names like a track (R10: 31 trips ride ≥ 1 km of camino/pista/…): `rider-safety`
  triages the queue into `bad-roads.json` or into the `is_paved` heuristics
- [ ] "Fewer km, tighter curves" alternative shown next to the slider when a stop was skipped for having fewer twisty km
- [ ] Stable character per road section (the same road can read differently depending on the part a route rides)
- [ ] Arrival time and a "best value" stop on the slider
- [ ] Fuel warning on long twisty legs without petrol stations
- [ ] Round trips (loops back to the start)
- [ ] Advanced settings, kept out of the main flow (start, finish, slider, ride)
- [ ] Smarter Google Maps pins: rides with more than 4 highlighted twisties only pin the best 4
- [x] GPX export for apps that follow a line (Wikiloc, OsmAnd, Garmin), via the system share sheet
- [x] "Open in…" instead of "Open in Google Maps" (maintainer, 2026-10-14): pick the navigation app, tick "always
  use this app" to make it the default; Google Maps by URL, line-following apps (OsmAnd, Kurviger, Calimoto…) by
  GPX, "Other app (GPX)" via the share sheet; no Waze (destination only). Landed 2026-10-15 (`plans/2026-10-14-open-in.md`)
- [x] Side panel: the four ride stat cards overflow on a ride with tracks (seen on the unfolded Fold); two by two now
- [x] Side panel: the ride summary ends clear of the pinned actions bar (it only covers content still to scroll)
- [ ] Open in…: drive the unfolded side panel on the real Fold (needs the maintainer to unfold it, lock-screen rule)

## Phase 4b — Route quality bench

Automated testing and scoring of routes; design in `docs/route-quality-bench.md` (revised after
`reviews/2026-10-13-bench-design-review.md`). Layer 1 is deterministic and runs on every planner or pipeline change;
Layer 2 (`expert-rider`, `road-scout`) judges a small sample only when it pays; tuning only if measurement shows
headroom. Owner: routing session, after Batch B (review round 1). Slices 1–4 are the smallest useful bench (~70 trips,
every sanity check report-only, Google pin fidelity).

- [x] Batch B's bit-identical gate on main (`planner.gate.test.ts`): the first brick
- [x] Slice 1 — Runner: `RideOption.edges`, a settled-node counter, `app/bench/run.ts` in parallel workers, route ids,
  hard checks (connected, no tracks when off, deterministic), `make bench`, fixed trips
- [x] Slice 2 — Great roads: seed list from Next up 1–2, exact ref/name matching, geometric "ridden", dead ends,
  cached one-to-many detour costs, found / lost per road; great-road trips and the mountain regional trips
- [x] Slice 3 — Committed baseline from main and diff report: trips improved / worsened, roads gained / lost by name,
  `--expect identical` for speed work; the gate reads its trips from the baseline
- [x] Slice 4 — Report-only checks (backtracking, loops, detours, urban crawl, towns crossed, thin stops, suspicious
  names, time error, regress km, Google pin fidelity), the default stop apart, `bad-roads.json` from `rider-safety`
- [ ] Slice 5 — Full trip set (~270: cross, urban, coast, islands, tracks), stacked-graph parity, pinned OSM extract
  identity in `meta.json` (with the GIS session)
- [ ] Slice 6 — Blind A/B trip cards with "roads not taken", and the first `expert-rider` round with a consistency
  test (X/Y swapped); confirmed findings become fixed cases
- [x] Head-to-head with OsmAnd and Kurviger (maintainer, 2026-10-15; `reviews/2026-10-15-head-to-head.md`): 30 of
  their routes (Kurviger on the Huawei, OsmAnd's web planner) scored on our graph. Blind expert mean rank: our
  most-fun stop 1.6, our default 3.4, theirs 4.1–5.1; our fun km per extra minute ≥ theirs in 25 of 27. They win
  Jaca → Benasque and Santander → Oviedo. Follow-ups:
  - [x] Connectors that chain two or more residential streets (`connectors.py`, ≤ 600 m in all) between a labelled
    road's dead end and the network; measure reachable dead ends and graph growth first. Test case: La Roda AB-705
    (194 m apart, 32 km by our graph); 15 such gaps in 9 places in the study
    Landed 2026-10-16 (067a0c0): every old connector kept, 1,301 more dead ends reached, graph +186 KB, recall 43 of
    125. One accepted G1 loss (maintainer): CV-363 on great-cv-345-alpuente-titaguas-gen, whose max-curves stop now
    takes VF-TE-05, reachable through the new streets
  - [x] Santander → Oviedo: LLN-7, AS-340 and AS-343 are not missed. Each one alone is dominated by a faster option
    with as much fun (0.37–0.51 fun km per minute against 0.7–0.8 on the frontier); the cap is 67 min (half the trip
    binds, not 90). Kurviger rides them by chaining several roads; combining candidates would be a planner feature
  - [x] Speed-aware curve fun (maintainer, 2026-10-16; `reviews/2026-10-16-speed-aware-fun-step1.md`): no change.
    Lateral load at class speed helps the classics-vs-lanes order but stays inverted and costs the mixed class; a
    flow factor that flips the order also sinks the tight great tertiary roads (Vidrà, Tost, Mare de Déu del Mont: 15
    of 16 bench great roads lose > 0.15 fun). A lane and a Vidrà share class, tags, load and speed. The fresh held-out
    set (`data/calibration/speed-fun-holdout.json`) stays unread for the next try
  - [ ] Next fun signal, a product choice: something that tells a council lane from a Vidrà (how the road connects
    to the network, e.g. a lane ending at a farm; drawn width where tagged; surface roughness; or a hand-kept list)
  - [ ] Later, after speed-aware fun: one ride that chains several candidate roads (what Kurviger does on Santander →
    Oviedo). Today a stop is an appetite route or one candidate; chaining is a combinatorial search on the phone and,
    on the current fun scale, would chase council lanes. Measure the gain on the head-to-head trips before building
  - [ ] `ridesThrough` drops a candidate ride whose approach uses an edge of the road itself (AS-340, AS-343 on
    Santander → Oviedo: 1–3 edges ridden twice); harmless there, but it can drop a road whose fastest approach runs
    along part of it
  - [x] Fun model, two-sided (`reviews/2026-10-16-two-sided-survey.md`): no tag separates council lanes from great
    tertiary roads, and a flow bonus on trunk/primary/secondary does not beat the calibration baseline, so no change.
    The held-out diagnostic (20 roads, two blind raters) shows the model ranks them the wrong way round: all 9 lanes
    (fun 0.85–0.98) above all 7 classics (0.16–0.79); fast sweepers (N-111 Iregua, A-367 Ronda–Ardales) score as
    almost straight. What "fun" should include beyond the curve (speed, flow, width, context) is a product decision
  - [ ] Candidates miss short curvy runs (188.6 km over the 30 routes under the 3 km minimum): test merging runs
    across a village or a short gap
  - [ ] The default stop should not trade signed-slow km for nothing (Jaca → Benasque: 26 km signed ≤ 40 km/h and four
    council lanes for +38 min; the expert's bottom pick)
  - [ ] Unverified refs the expert flagged: "PENVA" (t1), "Pl-11" next to "PI-11", "HF" roads that may be forest
    tracks, "GR 48" that may be the hiking trail; on the via set (2026-10-19) "GR-238.7" (a hiking-trail code on
    València -> Los Santos), a 14.6 km "unnamed road" (València -> Titaguas -> Teruel) and "Camino San Antonio" out of
    Alcañiz. Owner: gis-data-engineer
  - [ ] Slider options that a cheaper one beats on rated km, and higher options that leave a classic for lanes (via set,
    expert-rider 2026-10-19: loop options 7 and 9 against 8, Titaguas 7-9 against 6, Maestrazgo 3 against 2 and 5
    against 6; Titaguas by Requena the long way round): the fun score counts rating-2 metres almost as rating-4 ones
    (the loop's last leg: CV-218 + CV-310, 25.1 fun km and 9 km rated 4, beat CV-25, 23.4 fun km and 25 km rated 4).
    Part of what fun should include
  - [ ] After R2 (great roads measured on their twisty, 2026-10-19), expert-rider's watch list: cross-031's default went
    from +21 for 74 km to +40 for 62 km; great-n-502-puerto-del-pico-ends trades two clean Gredos roads for six pieces
    and a vague "Carretera de Ávila" chip; on great-ou-0508-sil-ends stops 3-5 are coverage stops that all lose to stop 6.
    Part of what fun should include
  - [ ] The default buys filler on trips with stops (via set, expert-rider 2026-10-19): the loop València -> Teruel ->
    Segorbe -> València defaults to +28 on A-2521, CV-2391 and CV-218 (4 km rated 4-5) while CV-25 on the last leg
    alone (+38, 25 km rated 4) is never offered; the slider rides it only at +156. Measured: the great-road term pays a
    road once wherever it sits, and on its own leg CV-25 is not on the frontier (CV-218 + CV-310, 25.1 fun km and 9 km
    rated 4, beat it with 23.4 fun km and 25 rated). Tried and parked (branch `via-quality-reach`): paying a great road
    by the share of budgets that reach it. At weight 0.06 the loop defaults to CV-25 alone at +37, but tuning recall
    falls to 73 of 109 (main 75) with two G1 losses; at the fitted 0.09 recall is 74 of 109, holdout 8 of 22 (main 7),
    the loop still defaults to filler (+32 on CV-2093, A-2521, CV-2391; CV-25 at +75), and two G1 pairs are traded:
    ca-643-lunada on cross-020 (main's +154 stop for CA-256 gives way to CA-501 at +19; U 76.73 against 74.52) and
    a-397-ronda-san-pedro on regional-028 (A-397 at +16 and A-366 at +23 give way to A-7078 at +24 and A-372 at +41;
    U 90.24 against 89.68; twisty km at 30 minutes -2.2 %). The root is the fun score: rating-2 metres beat a rated road
    at low budgets. Owner: routing, with the fun model
  - [ ] Near-duplicate slider options (Jaca -> Panticosa -> Benasque options 1 and 2: the same corridor, 0.2 km apart,
    +15 min). Minor
  - [ ] A merged twisty run is named after its first or dominant road and overstates it: "CV-363, 60 km" on
    Alpuente → Titaguas is A-1514 23 km + CV-350 + CV-355 + CV-363 33 km (same-road merge across a junction); name
    the run by its roads or split the label
  - [ ] Re-run the study after these fixes (scripts in `data/head-to-head/`, git-ignored)
- [ ] Slice 7 — Oracle frontier: % of the best reachable fun and settled nodes per planner configuration (input to
  Batch B's search cuts)
- [ ] Slice 8 — Tuner over the appetite constants, only if slice 7 shows headroom; accepted on the held-out set
- [x] Maintainer decisions (2026-10-14): great-road rule = some stop within 90 min of detour; dead-end great roads
  stay out of G1 demand; the OSM extract stays pinned. The bench docs drop the "pending" wording in `bench-trips`

## Phase 5 — Off-road mode

- [x] Tracks layer: `highway=track` plus unpaved roads, stacked on the road graph and downloaded on first use
- [x] Leave out tracks closed in OSM (`no`, `private`, `agricultural`, `forestry`, `permit`) or impassable
- [x] "Include tracks" switch (off by default), dashed track stretches and a warning on every ride with tracks
- [ ] Max grade setting (`tracktype`, `smoothness`)
- [ ] Per-region legal notes (where motor vehicles on forest tracks are banned)
- [ ] Verify the tracks layer download and memory on a mid-range Android phone

## Phase 6 — Mobile apps

- [x] Capacitor Android project with the data bundled (no server needed), location permissions
- [x] `Makefile` targets: `apk`, `install`, `run`, `logs`
- [ ] First APK build and install on a real phone (needs JDK 21 + Android SDK; not available on the prototype machine)
- [ ] Verify on device: "Open in Google Maps" hands off to the Maps app, geolocation prompt, safe areas
- [ ] App icon and splash screen
- [ ] Native share/intent to Google Maps, geolocation permission flow
- [ ] Performance pass on mid-range Android (graph size 43 MB, worker memory)
- [x] Device pass script (`app/scripts/device-pass.mjs`): cold start, idle frames, memory, trip editor with the real
  keyboard, first 3D toggle. First run 2026-10-14 on the Huawei and the Z Fold (folded and unfolded): all pass
- [ ] First 3D toggle still stalls ~480 ms on the Huawei (shader compile); the single DEM source saves no measurable
  GL memory on the phone. Try pre-compiling terrain off-screen, or accept. The first ride shows the same kind of
  stall: headless at 6x CPU, MapLibre's program compile (`Program` constructor) is the main-thread blocker (tasks of
  260-640 ms right after the ride appears); try warming the route layers' shaders while the graph loads, measured on
  the Huawei (software GL in headless cannot say how long it lasts on the phone)
- [x] Z Fold unfolded: after a trip completes in the side panel the keyboard stays up with B focused and hides the
  ride stats; blur B when the trip completes
- [x] B came back after × while a restored long trip replanned: clearing an end did not invalidate the plan in flight,
  so its ride appeared under the empty field (reproduced headless at 6x CPU, fixed in `App.svelte`)
- [ ] A restored long trip (922 km) swallows taps for ~10 s while it replans on the Huawei: the main thread is the
  blocker (long tasks, see the shader warm-up above); the length is only measurable on the phone
- [ ] Few-stops plans +14 % slower than the fun-model stack on the Huawei (Madrid → Granada cold 3.47 → 3.95 s,
  6 alternating rounds, 2026-10-15; load phase unchanged), accepted over the +10 % budget for recall 38 → 44 with no
  G1 loss. After the stack lands, profile `plan()` on the Huawei; adopt a cut only if recall and G1 stay identical
- [ ] Live fold/unfold with the app open, "Change finish" and a long trip on the editor: manual, by the maintainer
- [ ] Code-split MapLibre to shrink the initial bundle
- [ ] iOS build and App Store (maintainer, 2026-10-22: the paid Apple account is ready; Xcode 26.6 is on this Mac).
  After Play internal testing: the Capacitor iOS project, an iOS side for `OpenInPlugin` (GPX to another app via the
  share sheet), location strings, the App Store listing under `stores/ios/` and the privacy labels. Plan first.
  - [x] Branch `ios` landed (1b5ded4, 2026-10-23): Capacitor iOS project, plist strings EN/ES, "Open in…" offers
    Google Maps and the share sheet, icon and launch screen, simulator and iPhone 13 mini pass. Plans 131-665 ms on the 13 mini; the slider stays full
    (p95 18 ms). Found on the device and fixed on the branch: the page asked for location through WebKit too
    ("localhost wants to use your location", again on every load), now read natively on iOS; the search list runs
    under the keyboard (València 4th, hidden). Wikiloc does get the GPX from the share sheet, under "More" (the
    maintainer, 2026-10-23); iOS orders that row by use and favourites, not by us. Open: WebContent memory grows with use (480 MB idle, 740 MB after
    several plans); one black screen at launch while Instruments and the inspector overlapped, not reproduced.
  - [x] WebContent memory before submission (8c67a75, 2026-10-24): it grew about 15 MB a trip with no plateau (peak
    1.46 GB, idle 1.15 GB after 24 trips on the 13 mini). Attribution runs found MapLibre's workers: each keeps its own
    tile and route data. One map worker on iOS: idle after 24 trips 1060 -> 834 MB on Release, plan, pan, zoom and
    style switch no slower; Android keeps the default. A fresh routing worker per plan made WebContent die at about
    1.0 GB, so the kill risk is real. Still open: each long plan spikes WebContent +250-350 MB for a few seconds
    (peak about 1.4 GB); bounding it is a separate item, measure first.
- [x] Start over (a7faf96, 2026-10-23): a × beside the trip row on phones, "Start over" in the side panel, Undo for
  5 s, the cleared ride kept in Recent trips. Camera to the start (3246e95): a start set alone eases to zoom 9 (on a
  phone once the map shows); "My location" shows a locating state and accepts a fix up to 2 min old (a fresh fix took
  5-6 s on the Fold, once timed out at 10 s). Open: on the Fold folded the B pin can sit under the map-style button.
- [ ] Quality-of-life round (ux-designer review, `data/ux-qol-review/report.md`, 2026-10-23; the maintainer approved
  all 15). Owner: app, one branch per batch:
  - [x] qol-map (1e967c8, 2026-10-23): "Show whole ride" and "Locate me" with a position dot, one bottom-right map
    cluster; Android back walks the views and starts over from a ride; back on a bare start screen exits again (broken
    since 4c02e22). Checked on the Fold and the iPhone; on the Huawei (2026-10-24) no long frame falls at the button
    change, the long frames are the phone's ordinary pan redraws.
  - [x] qol-places (1f01c1a, 2026-10-24): a failed "My location" says why under the start (denied or unavailable)
    with Try again, and Recent trips stay; empty fields offer recent places and, on phones, "Choose on the map" with a
    crosshair. Native asks for the permission before the timed fix, so the timeout never runs behind the prompt.
    Checked on the Huawei (denied and location off).
  - [ ] qol-map-edit: drag A and B, tap a stop to remove it or make it the finish; map taps on badges and twisties
    scroll the list; Undo for clearing Recent trips.
  - [ ] qol-polish: an offline notice; the "here" end as an icon in the trip card; 44 px long-press rows; map controls
    fade under the full sheet.
  - [ ] qol-extras: a haptic tick per slider stop; a collapsible side panel; first launch on the rider's region from a
    recent fix.
- [ ] Place search: "valen" puts two Valenzuela hamlets above València when the map sits over Andalucía; a large
  town matching the prefix should outrank nearby hamlets. Owner: routing.

## Phase 7 — Data distribution and going global

No backend: data lives as static files on a CDN (e.g. Cloudflare R2, no egress fees), the app downloads only
what a trip needs and caches it for offline use.
Satellite tiles (IGN WMTS) are never prefetched for offline packs without CNIG's answer; prefer the CNIG download
centre (`data/map-styles-spike/reviews/data-policy.md`, finding 7).

**Never miss a great road** (see `PRD.md`, product principles): every size or speed saving must keep route
quality. Run each change against the route quality bench and its known great roads (Phase 4b) before and after; if a
saving drops good roads or worsens the slider options, look for an alternative instead of accepting the loss.

Step 1 — Shrink Spain (no architecture change, measure every saving):

- [ ] Quantised coordinates relative to a local origin instead of float32
- [ ] Compact edge fields: time as u16, fun share as u8
- [ ] Drop `unclassified` lanes that neither connect anything nor carry worthwhile curves (~⅓ of road km today),
  only if the validation set shows no lost roads
- [ ] Drawing geometry in a separate file, fetched only for the chosen route
- [ ] Brotli on the CDN; target ~8–12 MB for Spain

Step 2 — Tiles for Spain, Portugal and France:

- [ ] Fixed ~1° tiles; edges crossing a border appear in both tiles with shared node ids, stitched on load
- [ ] Two levels: a light motorway/trunk level for the fastest route and the size of the corridor, detailed
  tiles only inside the corridor (ellipse A–B plus the detour budget)
- [ ] Planner loads corridor tiles on demand and keeps them cached; memory stays bounded by the corridor
- [ ] Twisty overlay as PMTiles (one static file, range requests read by MapLibre)
- [ ] Place index per tile/region; online search (Photon/Nominatim) outside downloaded areas
- [ ] Tracks as a separate tile layer, only fetched with "Include tracks"
- [ ] Region packs the rider downloads, as in OsmAnd (maintainer, 2026-10-17): on first run the app offers the pack
  of the rider's area, and a "Maps" menu lists regions to download, update and delete, with their size. Packs give
  offline planning; when online, a trip that leaves the downloaded packs fetches the missing corridor tiles itself
  (and offers to keep them), so a cross-border trip never fails for a missing pack. One region = a set of the
  ~1° tiles above, so packs and on-demand tiles share one format and cache

Per country, before its data ships (findings of 2026-10-16; the planner, connectors, safety guards and the app work
anywhere OSM does):

- [ ] Road-like names for promotion by name: today Spanish, Galician, Basque and Asturian ("Carretera de", "Estrada",
  "Errepidea", "Carreterín"); add each language ("Route de", "Strada", "Straße"…) and check the false positives
- [ ] Class speeds and pace per country: tagging differs (French departmental roads as secondary, British
  "unclassified" gems, mph limits); measure against that country's rides, not Spain's constants
- [ ] A great-roads list and a calibration set per country (`road-scout`), so the bench and the fun model are judged
  there: Route des Grandes Alpes, Stelvio, the Pyrenean cols on the French side…
- [ ] Place index per country (today Spanish towns only)

Step 3 — Europe, then the world:

- [ ] Pipeline per Geofabrik region, in parallel with overlapping borders; move the heavy steps to a compiled
  tool or osmium's on-disk index (Spain alone needs 7.4 GB of RAM today)
- [ ] Scheduled monthly rebuild on a rented machine, publishing versioned tiles
- [ ] Update check and background refresh of cached tiles

## Phase 8 — Publishing

- [x] Product requirements document (`PRD.md`)
- [ ] ODbL compliance: attribution and share-alike for derived data
  - Scope includes the DEM-derived relief in `graph.bin` once the road-value work lands: publish the derived data
    under ODbL with the Copernicus EU-DEM / USGS / NOAA credits (`reviews/2026-10-16-dem-data-policy.md`).
- [ ] Privacy policy: no tracking; map images come from OpenFreeMap (via Cloudflare), Terrain Tiles (Amazon Web
  Services) and, only in the satellite view, the Instituto Geográfico Nacional (via Amazon CloudFront), which see the IP
  and the map area in view; nothing else leaves the phone except what the rider sends to Nominatim or Google Maps
  (an address search adds an area around the rider rounded to 0.1 degree and possibly the nearest town; say it in EN
  and ES)
- [x] DEM credits: the map's Terrain Tiles credit names EU-DEM (Copernicus), SRTM/GMTED (USGS), ETOPO1 (NOAA), and a
  static credits view (EN/ES) carries the full text incl. the modified relief values; README too. Needed already for the
  hillshade (`reviews/2026-10-16-dem-data-policy.md`, finding 1). Owner: app session. Landed 2026-10-16 (e25a75e):
  credits sheet from the intro and the attribution control; the road-relief line is added when road-value lands.
- [x] Nominatim: verify the WebView sends an identifying Referer/User-Agent and memoise results per query for the
  session (`reviews/2026-10-16-dem-data-policy.md`, finding 5). Owner: routing session.
- [x] Nominatim cool-down: on a 429 or 403, address search fails without a request for about 60 s, so a second tap
  does not resend the whole chain (data-policy review of street-search-2, 2026-10-18). Owner: routing. Built on
  branch `nominatim-cooldown`: 60 s, and a request queued behind the refused one is not sent either.
- [x] Nominatim switch: decided 2026-10-19 (maintainer): no remote config for the Spain launch; if Nominatim asks,
  we ship an update that changes or turns off the address search. Revisit before a wider release.
- [x] In-app credit says address searches send the text and an approximate area when location is allowed (EN/ES,
  README too). Owner: app.
- [ ] Store listings (Google Play, App Store). Play Console app created 2026-10-19 on the maintainer's `sanchezpaco`
  developer account (sanchezpacodev@gmail.com): name "Twisty: la ruta con más curvas", package
  `com.sanchezpaco.twisty`, default es-ES (English listing too), free, Spain first. Landed 2026-10-22 under
  `stores/android/` (fastlane supply layout): texts EN/ES, 8 phone shots, the feature graphic and the icon; the copy is
  being rewritten (maintainer: it sounds like AI). Listing uploaded to Play Console on 2026-10-22 (texts and images,
  EN/ES, nothing submitted) with `stores/src/play-listing.rb`: `fastlane supply` needs a release first. Still to do: data safety, content rating, target audience (adults),
  category Maps & Navigation, optional Fold tablet shots; forms are shown to the maintainer before submitting.
- [x] Code licence: PolyForm Noncommercial 1.0.0 (`LICENSE.md`, maintainer 2026-10-22: anyone may read and clone it,
  nobody may use it commercially); the road data stays ODbL.
- [ ] CI: GitHub Actions runs the three gates on push and pull requests (branch `ci-gates`, routing). Release
  automation (bundle, data release, Pages) later, with the upload key as a secret.
- [ ] Website (maintainer, 2026-10-22): an informative landing page on GitHub Pages next to the privacy page
  (marketing, with senior-designer). The planner on the web later: the app already runs in a browser, but each visit
  downloads about 55 MB of data, GitHub Pages allows about 100 GB a month, and Nominatim's limit is per app, so it
  needs a hosting decision first.
  Landing page built 2026-10-22 (`docs/index.html`, EN/ES, self-hosted, no third-party requests; reviewed by
  ux-designer, data-policy and weekend-rider; approved by the maintainer). It goes live with Pages when the repo is public.
- [x] README and docs refreshed with the new screenshots and what landed in Phase 8 (marketing). Desktop and Fold
  shots from `stores/src/capture.mjs` (readme-*), the phone shots from the store listing; reviewed by data-policy and
  weekend-rider (2026-10-22). A rider still cannot get the app from the README until it is on Google Play.
- [ ] Ride copy from the README's cold read (weekend-rider, 2026-10-22): the badge "+26 km of curves" reads as a total
  next to the Curves box (78 km) on the same ride (app: say it is extra); the ride list shows internal refs
  (SC-22130-02), repeats a road across entries (AS-322 → AS-360, then AS-360) and cuts a "Signed 40 km/h" chip at the
  list's fade (routing for names, app for the chip). Also an in-app copy pass: the intro paragraph sounds machine-written. The Open in…
  note "Each twisty is pinned…" uses "twisty" as a noun in English; "Oviedo / Uviéu" truncates in the trip bar.
- [x] Slider scrub jank on the Huawei (release pass, 2026-10-22): p95 67 ms, max 100-167 ms while scrubbing; one map
  redraw costs about 33 ms on that phone. Landed as an adaptive slider (slider-adaptive, 2026-10-23, maintainer's call):
  a drag runs in full (reveal and camera on every option) and goes light (instant swap, camera at the release) once it
  measures 3 frames over 50 ms; the phone remembers it after 2 such drags, until the next build. Fold 10/10 drags full,
  p95 8 ms; Huawei light from its first drag, p95 67 ms.
- [ ] Release order (maintainer, 2026-10-19): (1) full review round on main with every reviewer, one ranked list;
  (2) fix the blockers; (3) release build and a pass on both phones (Huawei plan times incl. the València loop, Fold
  folded and open); (4) listing and shots; (5) Play forms; (6) internal testing (`make bundle`,
  `make publish-internal`); (7) closed testing if the account requires it (12 testers, 14 days: check); (8) production.
  The privacy policy goes on a public page (GitHub Pages, EN/ES), and the ODbL derived data as a download linked from
  the credits.
  - [x] Step 1 done 2026-10-19 on main 5b9590d: `reviews/2026-10-19-release-round.md`, one ranked list from the eight
    reviewers. Blockers B1-B4 (ODbL notice and download, OSM credit visible at load, privacy policy, safety notice);
    majors to fix before release R1-R10 (routing), A1-A10 (app), D1-D5 (director); the rest filed there.
  - [ ] Step 2: B1-B4, R1-R10, A1-A10. Landed: R1-R10, B1's notice, B2, B4 and the Privacy link, A1-A7, A9, the
    holdout set (with the U-turn margin), the closure and ford chips, the closure note naming the roads (c4e690c) and
    the Canary Islands box (6a359a9). B1's download and B3's page went live with the public repo on 2026-10-23:
    Pages from `docs/` (https://sanchezpaco.github.io/twisty/privacy/) and the `data-v2-20261019` release (the
    `make data-release` zip). Left: the privacy URL in Play and App Store Connect. Maintainer, 2026-10-19: Android backup stays on (the policy
    says so); A10 dropped on the ux-designer's call. Maintainer, 2026-10-22: the repo goes public only when the project
    is ready, so before step 6 (testers count as the public under ODbL); contact email sanchezpacodev@gmail.com.
  - [x] A shared ride that ends at "My location" carries the rider's position: a loop with Back to the start, or a
    trip turned round, writes the exact finish into the Google Maps link of the shared text and the GPX, and a saved
    ride keeps the position so Plan again uses it as an ordinary point (data-policy review of the privacy page,
    2026-10-22). The privacy page says so. Maintainer, 2026-10-22: the rider's call, so Share warns before it shares a
    ride that ends at the rider's location and shares if they go on. Landed as share-here-warning (19ad7be, 2026-10-23):
    a sheet with the approved EN/ES text, Cancel focused; the privacy page says so in 3d. Shots on the Huawei and the
    Fold with the map hidden.
  - [ ] Align the in-app address-search credit with the privacy page (`en.ts:100`, `es.ts:94`, README). Owner: app.
  - [x] Canary Islands: promised in the PRD, missing from the data. Maintainer, 2026-10-19: add them. Landed with
    safety-flags (8ec0d2f): Geofabrik's canary-islands merged with Spain; TF-436 and TF-24 are holdout roads.
  - [ ] An untagged lane that only leads to tracks is a track: Camí de les Farreres (cross-007,
    great-bv-5114-santa-fe-ends) and pas de Barberà (regional-017) stay on default rides after safety-flags, because
    their continuations are tracks with another name or none. Rule to try: an untagged `unclassified` way whose ends,
    beyond junctions with other untagged lanes, meet only tracks becomes a track; measured on the bench (named defaults,
    km of untagged unclassified on default stops, G1), baseline re-recorded in its branch. From rider-safety finding 5.
    Owner: gis-data-engineer.
  - [ ] A motorcycle exemption overrides a general closure (rides with the next data rebuild): `motorcycle:conditional`
    decides alone when present, otherwise `motorcycle=yes|permissive|designated` exempts the way from a general or
    conditional closure; psv, bus and bicycle never do. Measured: 0.24 km of conditional closures on roads and 9.9 km
    of wholly closed roads (Bus-VAO links, 1.6 km of AP-9) change. Formentor is right as is: motorcycles are not
    exempt (Consell de Mallorca, BOE-A-2026-1255). Owner: gis-data-engineer.
  - [ ] A road closed part of the year scores no fun (`FUN_BLOCKERS`), so Formentor (Ma-2210, closed 15 May-18 Oct
    10:00-22:00) shows "Curves 0.0 km" and a single slider option. Now that the ride names the closure, decide whether a
    time-window closure keeps its fun (Pollença -> Cap de Formentor as the test). Owner: routing, rider-safety on it.
  - [ ] GC-200 into the validation set: north of La Aldea the graph has it in five pieces between the GC-2 tunnels, and
    the La Aldea-Mogán piece reads as a dead end at (-15.8115, 27.9965). road-scout places the entry's ends on a through
    stretch, GIS checks whether the dead end is the map or the graph, then it goes in as a holdout road.
  - [ ] Validation set: road-scout's 15 roads as holdout, holdout recall as the headline number
    (`reviews/2026-10-19-release-road-scout.md`). Owner: routing.
