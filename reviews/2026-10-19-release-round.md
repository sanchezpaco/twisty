# Release review round: one ranked list (main 5b9590d, 2026-10-19)

Step 1 of the release order (ROADMAP Phase 8). Eight reviewers on main 5b9590d (data 3311fa55967b0a48): code-reviewer,
data-policy-reviewer, expert-rider, road-scout, rider-safety, ux-designer, weekend-rider, cartographer. Inputs: the
bench on this build (127 trips, 5 via trips, 0 failures, identical to the committed baseline), 116 shots at Huawei,
Fold cover and Fold open sizes, EN and ES (`data/review-2026-10-19/`, git-ignored), tester APK
`dist/twisty-tester-5b9590d.apk`. Gates green: pytest 118, vitest 561, `npm run check` 0 errors. Full reports:
`reviews/2026-10-19-release-<role>.md`.

"Release" below means before anyone but the maintainer installs it from Play (internal testing included, because
ODbL counts testers as the public).

## Blockers

| # | Finding | Source | Owner |
|---|---|---|---|
| B1 | **ODbL share-alike unmet.** graph.bin, candidates.bin, the overlay tiles and places.json ship with no notice and no public copy. Need: `LICENSE.txt` and licence fields in `meta.json` written by the pipeline; a free download of exactly the shipped files per data version (public repo release); a "Twisty's road data" section in Credits linking to it; README line. | data-policy B1 | routing (notice, meta), app (credits), director (public repo) |
| B2 | **OSM attribution folded away at load** (`MapView.svelte:333-339`). Decided: a permanent one-line credit at the map foot in every style ("© OpenStreetMap · © OpenMapTiles · OpenFreeMap" or the shortest form data-policy accepts), joined to the imagery pill on Satellite; the full text stays behind the "i". | data-policy B2, cartographer 1, ux | app |
| B3 | **No privacy policy** in the app or online. Draft (EN) in the data-policy report. Public page EN/ES; "Credits · Privacy" link in the intro foot and a Credits section. | data-policy B3 | director (page), app (links: in progress on `safety-notice`) |
| B4 | **No general safety or legal notice.** Approved by the maintainer 2026-10-19: first launch line, ride summary sentence, GPX one-way line in Open in…, "Use at your own risk" in Credits; ux placement notes applied. | rider-safety 1 | app (in progress on `safety-notice`) |

## Major: fix before release

Routing:

| # | Finding | Source |
|---|---|---|
| R1 | A trip whose ends (or all points) snap to one graph node crashes ("Something went wrong"): `ride.ts:311` on an empty leg. Answer a `sameSpot` planning error with "Change finish"; planner test. Reproduced (two close long-presses; Cadaqués → Cap de Creus). | code 1, rider-safety 11 |
| R2 | A coverage stop's "great" road has no minimum length and may be a town street: Madrid → Granada's default is headed "+ Added A-6026 3.2 km", a village crossing; the Bonaigua stop is headed by the Esterri street. Minimum length (~8 km), no town crossings or streets, label by the road ridden most. | expert M1 |
| R3 | Chained twisty labels hide the roads and overstate km ("AV-901 120 km" with 35 km of AV-901; "JF-7038 89 km" for a 42.6 km road; "Carretera sin nombre" over named roads). List the roads in order or split at road changes; never more km than the road has; never prefer the unnamed road. | expert M2, road-scout 5 |
| R4 | Roads closed part of the year are routed with no notice (Formentor Ma-2210, Favàritx Cf-1, Lagos de Covadonga CO-4). Export a flag; chip "Closed part of the year" and note (copy F). | rider-safety 3 |
| R5 | `access=destination` lanes used as a through route (Camino de Ronda a Setenil). Heavy cost unless near a trip end or stop. | rider-safety 4 |
| R6 | Untagged lanes whose continuation is a track stay tarmac; vía pecuaria names; surface is a blacklist (`cobblestone`, `tierra`, `ripio`, mixed `;` values count as paved). Whitelist and the continuation rule; measured on the bench, baseline re-recorded in the branch. | rider-safety 5, 6 |
| R7 | Fords outside the twisties are never mentioned (41 stops, 17 trips, incl. CV-345 on València → Los Santos). Count over all edges; note (copy G). | rider-safety 7 |
| R8 | Nominatim at public scale: the limit is per app; one search sends up to 5 requests. Cap the chain at 2; User-Agent with version and contact URL. | data-policy M3, m2 |
| R9 | A "My location" start goes into the Google Maps URL, the share text and the GPX at 5 decimals. Omit `origin` when the start is "My location" (Google uses the device location). PRD 5.3 reworded by the director. | data-policy M2 |
| R10 | `make bundle` can ship without `candidates.bin` or with one from another graph (the phone then builds it on the first plan). Fail the bundle unless it exists and parses against graph.bin. | code 4 (Makefile with app) |

App:

| # | Finding | Source |
|---|---|---|
| A1 | A loop from "My location" stores the exact position as the finish, labelled "My location" (`Panel.svelte:219`); next day it routes back to yesterday's hotel. Carry `here`; handle both ends `here` in `pickTrip`. | code 2 |
| A2 | "Add stop here" on an open saved ride does nothing, or mixes in the previous trip's stops; a full saved ride is offered a 4th stop. | code 3 |
| A3 | A/B pins split the start or finish town's label ("Va●ia") on nearly every town trip, and will be in the store shots. A symbol layer that takes part in label placement. | cartographer 3, ux M3 |
| A4 | Dark style: base roads and water invisible in sunlight (primary 1.38:1, water 1.04:1). Cartographer's colours in `theme.ts`. | cartographer 2 |
| A5 | Fold open: the town-search list is narrower than the panel and the intro shows through on its right; "Search streets…" pushed out of view. | ux M2 |
| A6 | Google Maps messages contradict each other (ride note vs slider note vs the unconditional "we recommend GPX apps", which names none). Show the GPX recommendation when stretches are really skipped, name the apps. | weekend 2 |
| A7 | "Motorway / Autovía 78 km" on Jaca → Benasque counts trunk (the N-260). Rename the box to cover both, or split. | weekend 1 |
| A8 | Android Auto Backup copies trips, saved rides and the 2 h restore slot to the rider's Google backup (`allowBackup="true"`). Maintainer's choice: keep and say so in the policy, or turn off with `dataExtractionRules`. | data-policy M1 |
| A9 | FileProvider exposes the whole external storage root (`file_paths.xml:3`); only the cache is used. Signing keys and the service-account JSON are not git-ignored (`app/android/.gitignore:57`). | code 11, 12 |
| A10 | The slider's bar chart has no caption: height, colour and a grey stub on València → Los Santos are unexplained. One quiet caption, ux-designer's call on clutter. | weekend 3 |

Director:

| # | Item |
|---|---|
| D1 | Canary Islands are promised (PRD) but not in the data: the Geofabrik Spain extract leaves them out. Maintainer's call: add `africa/canary-islands` to the pipeline, or launch as "Península y Baleares". |
| D2 | Public host for B1 and B3 (a public repo, e.g. `twisty-data` with GitHub Pages, or GitHub Pro) and the policy's contact email. |
| D3 | Device check on the Huawei in step 3: plan 10 trips in a row and confirm the camera flies to the route each time (headless left about half on the Spain view, likely swiftshader). |
| D4 | Play Data safety answers (data-policy table) in step 5; store credits line and safety line E in the listing (step 4). |
| D5 | PRD: 5.3 reworded (R9), the risk row on tiles and geocoding rewritten as trigger volumes (data-policy m4). |

## Major: filed, not release blockers

- Validation set holes: 9 regions with no road, holdout recall 7 of 22 against 75 of 109 tuning. Add road-scout's 15
  roads as holdout, re-record the baseline in that branch, make holdout recall the headline (road-scout 4, 7). Owner:
  routing, early in step 2 so the fixes above are measured on it.
- Misses a rider would notice: A-1702 on Alcañiz → Cantavieja, N-502 Puerto del Pico at 15 min, CA-280 Palombera,
  N-260 Coll de Fadas, A-7000 only at +105 (road-scout 2, 3, 6). Fun-model work.
- Pyrenees showcase defaults skip Cotefablo and the Bonaigua for lanes; max curves picks council lanes over AS-260,
  AS-265, Puerto del Pico; defaults that buy short lanes (Ávila → Plasencia, Santander → Potes, the loop); the long
  trip's default (+31 for 8.7 km on València → Los Santos) (expert M3, M4, M6; weekend 4). Fun model.
- Google Maps follows 28 % of Madrid → Granada's default and a median 61 % at max curves (expert M5): ROADMAP 20.
- Character word diluted on long chains (Bonaigua and Somiedo "Flowing"): "Stable character per road section".
- The GPX rides town one-way streets the wrong way on 91 of 127 defaults (rider-safety 2): copy C now; "Town streets
  in the graph" later.

## Minor (filed)

Code: stale plan on a recent "My location" trip (5); address results from an earlier query (6); worker and startup load
errors not surfaced or cached forever (7); `localStorage` default parameter outside the `try` (8); share text and GPX
file name say "My location" (9); dead `nameOf` (10); tests for App trip state and the worker protocol (13).
Data policy: "online" in the address-search row and a Nominatim credit under results (m1); credits in the listing (m3);
OSM copyright in the GPX metadata (m5); Cloudflare NEL reports (m6, unverified).
Rider safety: R10 false positives on autovías (8); `bad-roads.json` empty (9); directional access tags (10); gates
without access tags (12).
Expert: coverage stops crowding the slider (m1); city exits optimistic (m2); twisty roads timed slow, publishable
(m3); 20 km/h limit chips (m4).
Road scout: U-turn on a dual carriageway at Reinosa (8); CV-345 Alpuente–Titaguas not a twisty (9); A-4050 and LU-651
graph splits (10); "found at the default stop" line in D4 (11).
UX: share toast over the Google Maps note (m1); trade chip in the error red (m2); badges colliding (m3); sheets
showing cut content behind them, no dimming in the side panel (m4); via stop not named on the ride card (m5, also
weekend 8); no brand on the phone's first launch (m6); one name for bilingual settlements and Latin names abroad
(m7, cartographer 4, weekend 11); leg-error frame (cartographer 5); labels through the satellite credit (cartographer
6, weekend 10).
Weekend rider: numbered circles and list order (5); "+ Añadida" only in a hover title (6); legend names only two
ratings (7); place subtitles without a province (9); "Always use this app" with no way back (12); "deslizador" and
"GPX" jargon (13); Twisty's times against Google's (14).

## Dismissed

- The style strip staying open after a pick: by design (ux).
- "5329" without a separator in Spanish: correct (RAE).
