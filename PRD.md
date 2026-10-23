# Twisty — Product Requirements Document

| | |
|---|---|
| **Status** | Working prototype (web), Android app next |
| **Scope** | Spain (mainland, Balearic and Canary Islands) |
| **Last updated** | 2026-10-18 |

## 1. Problem

Riders who want to get from A to B *and enjoy the ride* have no good tool for it.

- **"Avoid motorways" is all or nothing.** Google Maps and friends either take the motorway everywhere or never.
  With motorways off, the route crawls out of the city on urban roads and through every village on the way,
  even when a 20-minute motorway stretch would drop you right at the start of a great mountain road.
- **Curvy-road apps penalise motorways globally.** They make the whole route curvier, but they do not reason
  about *where* the good roads are and how much time each one is worth.
- **Riders end up planning by hand**: hunting for passes on the map, adding waypoints one by one and hoping the
  navigation app follows them.

## 2. Vision

> Tell Twisty where you start and where you are going. It finds the best curvy roads on the way, uses the
> motorway when that gets you to them faster, and lets you choose, with one slider, how much extra time you
> want to spend on curves. Then it sends the route to the navigation app you already use.

Product principles, in priority order:

1. **Start, finish, slider, ride.** The main flow needs no configuration. Tweaking lives in advanced settings.
2. **Never miss a great road.** Route quality comes before app size, speed or convenience. An optimisation that
   loses good roads is not acceptable: find another way to get the saving (and prove it on the validation set).

## 3. Users

- **Primary: road and dual-sport motorcyclists in Spain** who ride for pleasure on weekends and trips,
  know the feeling of a good road, and navigate with Google Maps on a phone mounted on the bars.
- **Secondary: adventure riders** (e.g. a Husqvarna 701 Enduro) who would happily take a well-graded gravel
  track if it makes the ride better.

## 4. Core user stories

1. *As a rider*, I pick a start and a finish and immediately see a route that is better than the fastest one,
   without configuring anything.
2. *As a rider*, I slide between "fastest" and "max curves" and see the route, travel time, extra minutes and
   km of curves update instantly.
3. *As a rider*, I see which roads make the ride special (names, length, how twisty they are) before I go.
4. *As a rider*, I open the chosen route in my navigation app (Google Maps, or one that follows a GPX line) with one
   tap, and it actually rides those roads. I pick the app once and can make it the default.
5. *As a rider*, I find my start and finish quickly: towns as I type, streets when I need them, or a long press
   on the map.
6. *As a rider* exploring, I see at a glance where the twisty roads are across the whole country.
7. *As an adventure rider* (Phase "Off-road"; tracks are off in the app until then), I can include unpaved tracks, knowing some may be closed or rough, and take the
   ride to an app that follows a GPX line (Wikiloc, OsmAnd, Garmin…). Later: up to a grade I choose.

## 5. Requirements

### 5.1 Functional — prototype (done)

| Area | Requirement |
|---|---|
| Twistiness | Every road stretch gets a *fun share* (0–1) from its heading change per km: straights 0, fast sweepers ≈0.55, tight mountain roads 1. Motorways and urban stretches (≤ 50 km/h) score 0. Unpaved roads (`highway=track`, unpaved surface, `tracktype` ≥ grade2, very bad `smoothness`, "Pista …"/"forestal" names) are tracks: never routed unless the rider opts in, and then worth half the fun of tarmac. Fun scales with the pace the road class allows (cruising 40 km/h → 0, 60 km/h → full), so slow unclassified lanes keep a quarter. |
| Planner | One route per *curve appetite*; refines where options jump in time; adds *partial rides* (only some consecutive twisties of a curvy route, fastest way to and from them) so the slider has in-between options; keeps the Pareto frontier of time vs. curves; up to 9 slider stops within a 3-hour detour budget, each adding time, curve score and km of twisties. |
| Ride summary | Total time and km; extra time with the km of curves it buys; real km of twisties (with their dominant character), motorway, tracks and other roads that add up to the total; a mix bar previewing the twisties in riding order; highlighted twisties with ref, name, km and character word (Gentle, Flowing, Winding, Very winding, Epic). No internal score is shown: quality is told by colour and words. Slider bars are stacked by character colour. |
| Output | One "Open in…" call-to-action, not tied to Google: the rider picks the navigation app and can tick "always use this app", after which the button names it and opens it directly (changeable from the same list). Google Maps gets a directions URL with up to 9 waypoints pinning the best twisties (entry, exit, interior pins on long ones). Apps that follow a line (OsmAnd, Kurviger, Calimoto, Garmin, Wikiloc…) get the GPX track of the whole ride; installed ones are listed by name, plus "Other app (GPX)" through the system share sheet (downloaded on desktop). Waze is not offered: it takes only a destination and would not ride the twisties. |
| Tracks | Off in the app until the off-road update (maintainer, 2026-10-18): no switch is offered, a trip saved with tracks is planned on roads, and `tracks.bin` is not shipped (debug APK 39 MB instead of 119 MB). The pipeline still builds the layer and the planner keeps it for that update: "Include tracks" switch, off by default. Tracks closed in OSM (`no`, `private`, `agricultural`, `forestry`, `permit`) or impassable are never used. A ride with tracks shows their km, draws them dashed, warns that some may be closed or rough and that Google Maps will probably not follow them, and makes GPX the main call-to-action. The tracks layer (`tracks.bin`) is only downloaded the first time the switch is turned on. |
| Place search | Instant offline search over ~68k towns, villages and hamlets, ranked by match quality, then proximity; street and address search via Nominatim on explicit request. |
| Map | Dark cinematic style, hillshade, optional 3D terrain, Spain-wide twisty heat overlay, animated route drawing. |
| Trips | The app opens on the start screen. The trips handed to a navigation app, and the last ride left on screen, are kept on the device (up to 5, no coordinates for "My location") and listed as "Recent trips": one tap plans a trip again on the slider stop the rider had chosen. A ride handed to another app is restored if Android closes Twisty within 2 hours. |
| Layouts | Desktop floating panel; mobile bottom sheet that folds to trip, slider, time and call-to-action. |
| Languages | English and Spanish, picked from the device language (Catalan, Basque and Galician devices get Spanish), switchable from the start screen and remembered; numbers use the language's separators; address search answers in the same language. |

### 5.2 Functional — next (see `ROADMAP.md`)

- Android app (Capacitor), then iOS.
- Off-road update: bring tracks back, with `tracks.bin` downloaded on demand instead of shipped in the app, then a maximum track grade and per-region legal notes.
- Better quality: penalise villages without speed-limit tags, calibrate the speed model on real rides.
- Map styles: satellite and a normal light map next to the dark style, so riders can see the roads they will take.
- Stops in the trip: intermediate places, including loops back to the start, each leg with its own twisty detours.
- Share a planned ride through the system share sheet.
- Saved rides in folders the rider creates, kept on the device; a saved ride does not change when the data does.
- Advanced mode for preparing a ride the day before: edit a stretch of the planned ride and pick its alternatives.
  The default stays the ultra-fast "start, finish, slider, ride".

- Advanced settings for riders who want to tweak (detour budget, curve character preference). The default
  experience stays "start, finish, slider, ride".

### 5.3 Non-functional

- **No backend.** Routing and town search run on the device. No accounts, no API keys, no tracking.
  Location never leaves the phone, except the map area requested from the tile servers and what the rider sends to
  Nominatim or Google Maps; an address search sends its text and, when location is already allowed, an area of about
  2 degrees around the rider's position rounded to 0.1 degree, and possibly the nearest town's name. The exact position
  and the trip history never leave the phone. Satellite imagery stays free (IGN terms).
- **Fast.** Planning a trip across Spain takes under one second on a laptop; target under two seconds on a
  mid-range Android phone. Town suggestions appear in under 100 ms.
- **Beautiful.** The route is the hero. Smooth animations, no jank, dark theme, mobile first.
- **Works with spotty coverage.** Routing and town search work offline; only map tiles, address search and
  Google Maps need a connection.
- **Small enough to ship.** Data today: 43 MB routing graph, 3.6 MB twisties, 3.6 MB places (uncompressed). The debug APK is 39 MB with all the data; the tracks layer (140 MB) is not shipped while tracks are off.

## 6. Success metrics

- A rider plans a trip and opens it in Google Maps in **under 30 seconds** from launch.
- For known great roads on a trip's corridor, at least one slider stop rides them (validated against a curated
  list per region).
- Riders choose a non-fastest slider stop in the majority of trips (the product is doing its job).
- Google Maps follows the planned twisties end to end in at least 90 % of opened routes.

## 7. Non-goals

- Turn-by-turn navigation. Twisty plans; Google Maps (or another navigation app) navigates.
- Social features, ride sharing, accounts or cloud sync.
- Coverage outside Spain in the first release.
- Live traffic, weather or road-closure data.

## 8. Constraints and risks

| Risk | Impact | Mitigation |
|---|---|---|
| Google Maps accepts at most 9 waypoints | Rides with more than 4 highlighted twisties are only partly pinned | Pin the best twisties first; GPX export for unlimited waypoints |
| OSM data quality (missing surface, speed limits, names) | Wrong fun scores, unpaved roads treated as paved | Conservative defaults, name heuristics ("Pista …"), validation set per region |
| Speed model is conservative | Travel times longer than reality (e.g. Madrid → Granada 4 h 37 vs. ~4 h 10) | Calibrate on real rides |
| Public tile and geocoding services have fair-use limits | Degraded map or address search at scale | Self-host tiles and geocoder, or a paid plan, before a public launch |
| Off-road access law differs per region | Legal exposure | Tracks off in the app until the off-road update; then off by default, tracks closed in OSM excluded, warning on every ride with tracks (most tracks carry no access tag at all) |
| ODbL share-alike on derived data | Licensing obligations when distributing | Attribute OSM and publish derived datasets under ODbL |

## 9. Release plan

| Milestone | Content |
|---|---|
| **M1 — Web prototype** ✅ | Pipeline, on-device planner, fun score, slider, Google Maps output, offline town search, mobile layout |
| **M2 — Personal Android app** | Capacitor APK sideloaded on the author's phone; geolocation; performance pass |
| **M3 — Ride quality** | Validation set, speed calibration, village penalty, GPX export |
| **M4 — Off-road mode** | Tracks with grade limit and legal filters |
| **M5 — Public release** | Data distribution via CDN, store listings, privacy policy, ODbL compliance |

## 10. Open questions

- Final product name ("Twisty" is a working title).
- Free, one-off purchase or donation-based once public?
- Should the default slider stop be smarter than "twistiest within +45 min" (e.g. learn from the rider's choices)?
