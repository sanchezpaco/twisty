# Plan: head-to-head with OsmAnd and Kurviger

Status: for the director's approval, nothing run, the phone not touched. Owner: `routing` (`routing-engineer`), judge:
`expert-rider`. Date: 2026-10-15. Source: maintainer, 2026-10-15 (ROADMAP Phase 4b, "Head-to-head with OsmAnd and
Kurviger").

**Aim:** not to copy their routes but to beat them in Twisty's spirit: more time on great twisty roads per extra minute,
motorways to get there fast, nothing unsafe. Where a competitor wins, find out why with a measurement, and file it.

## What is known and what is not

- Known (Fold, 2026-10-14, `plans/2026-10-14-open-in.md`): OsmAnd 5.4.10 and Kurviger 3.6.6 are installed on the
  Huawei; both take a GPX from us. OsmAnd's UI is in Spanish; its route panel offers car, bike, walk and bus, and
  "Navegar traza" for a GPX. Kurviger's import shows "Track matching" in percent.
- Known: Kurviger's "extra curvy" València → Los Santos de Maimona (CV-345, CV-363) is 150 min by Kurviger; our model puts
  the most-fun stop at 173 min for 126 fun km, and no stretch of either ride is above rating 3 (measured 2026-10-15).
- **Not known, to verify in a 30-minute dry run before the real run** (nothing below is assumed): whether Kurviger's free
  app exports a planned route as GPX or only shares a link; whether OsmAnd has a motorcycle profile enabled or has to be
  added in Settings → Profiles, and whether the offline maps of the six trips' regions are already downloaded (the free
  OsmAnd limits downloads; nothing is bought and no account is made). If either fails: the fallback in step 2.

## Trips (6, mixed)

All six are read first with our planner to confirm what they test (fastest route's motorway share, great roads within
reach); the list changes only if a trip does not test what it is for.

| # | Trip | Why |
| --- | --- | --- |
| 1 | València → Los Santos de Maimona (-0.3763, 39.4699 → -6.3818, 38.4494) | Kurviger's 150 min is already known; long, Sierra Morena |
| 2 | Madrid → Granada | the product's reference trip (4 h 37 by our model, ~4 h 10 real) |
| 3 | Jaca → Benasque | short, dense in great Pyrenean roads |
| 4 | Santander → Oviedo | Cantabria/Asturias: A-8 is the fastest, Picos de Europa and Liébana roads on the side |
| 5 | Madrid → Plasencia | Gredos: passes against a fast A-5/A-66 |
| 6 | Valencia → Alicante | fastest route is all motorway (AP-7/A-7): does anyone find CV-70, CV-35 from it? |

## Their side, on the Huawei (one holder: the director asks the other project sharing the phone first, and I drive only after it hands the phone over)

Per trip, four routes plus the anchor:

| Route | How |
| --- | --- |
| Kurviger "curvy" | route A → B in the app, curvature setting 1 of 2 |
| Kurviger "extra curvy" | same, setting 2 |
| OsmAnd motorcycle | profile "motorcycle" (added if absent), default options |
| OsmAnd motorcycle, avoid motorways | same with the avoid-motorways option on |
| Anchor: fastest | our graph's fastest route (below); Google's ETA noted from Google Maps for reference only |

- **GPX without accounts or purchases:** Kurviger: its export or share of the planned route as GPX; OsmAnd: route
  options → save the route as GPX (the exact menu names are part of the dry run). Files are pulled with `adb pull` from
  the app's storage or the share target, named `<trip>-<source>.gpx`, kept in `data/head-to-head/` (git-ignored).
- **Google as an anchor** is not exportable as GPX without an account, so the baseline of every "extra minutes" is our
  own fastest route, timed by our graph for every route alike. Google's and the apps' own ETAs are recorded in the
  table as a reference column, not used in the scores (their speed models differ: Kurviger assumes ~66 km/h where we cap
  tight roads at ~40).
- **Rules before every screencap:** `dumpsys window | grep showing=` is false and the foreground app is the one being
  driven; a locked phone means stop and ask the director; never unlock, swipe or dismiss the lock screen; screenshots
  only of the apps' route screens; OsmAnd and Kurviger are never uninstalled or cleared and the other project's app
  is never touched. Phone time estimated at 2 to 3 hours (24 routes at 3 to 5 minutes, plus the dry run).
- **If the phone UI is too fiddly** (the dry run decides, not a feeling): Kurviger's web planner in headless Chrome
  (same engine and profiles as the app, exports GPX from the page) for Kurviger, and OsmAnd stays on the phone, or its
  routes are dropped and said so. Both sources are always labelled in the table.

## Scoring (every route, theirs and ours, with our metrics)

Harness in the scratchpad (not in the repo until the study is repeated; then only the matcher, with tests):

1. **Map-match the GPX onto our graph** (a Viterbi match on the edges within 30 m of the points, breaking ties by the
   direction of travel). Report per route the matched share of its length; a route below 90 % is flagged, its
   unmatched km counted apart ("off-graph": roads our extract lacks or an OSM version difference), never scored as fun.
2. **Ours:** for each trip our `Planner.plan()` options, with the data now on main. Compared at equal cost, not only
   at the default stop: for each competitor route with extra time X, our option with the largest fun that costs at most
   X, and our default stop (+45 min).
3. **Metrics, from the graph arrays and `ride.ts`, the same code for every route:** extra minutes over our fastest
   (graph time); fun km (`edgeFunM`); fun km per extra minute; km on stretches of rating ≥ 4 (`twistyStretches`
   with the app's ratings); motorway and trunk km; unpaved or unsafe km (tracks, fords, posted ≤ 40 km/h, narrow
   edges: `edgeClass`, `edgeFords`, `edgePostedKmh`, `edgeNarrow`); and a model-free number, the heading change per
   km of the route's own geometry, so the table is not only our model grading itself.
4. **Blind judgment by `expert-rider`:** per trip the routes as A/B/C/D in a random order, a map with the line and the
   same table without source names, run twice with the order swapped (the consistency test of Slice 6); the expert
   says which he would ride, which roads he would swap, and what looks wrong or unsafe. Only then are sources revealed.

Known bias, stated in the report: our metrics are our own, so they flatter us; the model-free curvature and the blind
judgment are the check on that. Kurviger's objective is curvature in its own sense and OSM versions differ.

## Output

- A table per trip: route, extra min (graph), fun km, fun km per extra minute, km ≥ 4, motorway km, unsafe km, matched
  share, expert's pick. One summary table: wins, ties and losses of our default stop and of our equal-cost option.
- **The trips where they beat us, and why, measured:** the roads they ride that we do not, by name, with their fun
  and rating in our graph, whether our candidates list them, and the detour our planner would need to ride them (the
  least extra time of a ride through them). A cause is only written down when this run shows it.
- ROADMAP items for each measured gap (model, candidates, caps, speed), and the dry-run findings about exporting from
  each app.

## Cost and order

1. Dry run on the phone (30 min) after the director's go and the other project's hand-over; decides the fallback.
2. Our six trips planned and the matcher written and tested on our own routes (matched share ≥ 99 % expected, since the
   routes come from the graph): half a day, no phone needed; can start now.
3. The 24 exports (2 to 3 h of phone), the scoring run, the blind round (two `expert-rider` rounds).
4. The report, in `reviews/2026-10-xx-head-to-head.md` on the branch, and the ROADMAP lines.

## Needed from the director

1. Approval of the six trips and of the competitor modes above, or changes.
2. OK to build the matcher and score our own routes now (step 2: no phone).
3. The Huawei for the dry run and the run, once the plan is approved.
4. That the anchor is our own fastest route and not Google's, because Google has no GPX export without an account.
