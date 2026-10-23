# Review of the route quality bench design (2749ae8) — 2026-10-13

## Verdict: sound with changes

The design itself is good: a deterministic runner, committed trips, `dataHash`, a baseline committed in the same commit as the change, a great-road ratchet, and judge findings turned into fixed cases. The problems are in the details. The way great roads are located will produce false results. The tuning objective and the holdout leak. Strict per-trip ratchets will block legitimate work. And the bench can't see the two failures riders will hit most: Google Maps ignoring the route between pins, and one-way streets. I checked every claim in the doc against main, against `planner-speed` (Batch B, the branch the bench is built on top of) and against `app/public/data`.

## Findings

### Blocker

**B1. Great-road matching uses "label contains", so G1/G2 will report wrong results.**
- Evidence: §3.3 says "edges whose `roadNames[edgeRoad]` contains `match`". In the current `graph.bin`:
  - `CV-35` also matches `CV-350`, `CV-352` … `CV-359`, all in the same comarca, plus `CV-35 · Autovía del Turia`.
  - The seed road "Tost" also matches `Carretera de Montan de Tost`, `Carretera a Castellar de Tost` and `C-14 · Túnel de Montant de Tost`.
  - `A-1205` exists both at Jaca and at Almería.
- Snapping `from`/`to` with `NodeLocator` picks the nearest junction of *any* road. If that junction isn't on the target road, the road is reported "unlocatable" when it isn't.
- "Ridden" compares edge sets. A parallel `Carretera vella …` (also in the data) or a different carriageway counts as not ridden, even though the rider rode the road.
- Why it matters: G1 is the ratchet behind PRD principle 2, and road-scout treats a loss as a blocker. A wrong locator gives false blockers or false confidence.
- Change:
  - Match an exact ref token or the exact full label, after splitting on ` · `.
  - Snap endpoints only to nodes that touch a matching edge.
  - Judge "ridden" by geometry: route within ~50 m of the road's polyline for at least `RIDDEN_SHARE` of its length. That also survives data rebuilds.
  - Store the located polyline in the run output.

### Major

**M1. The detour-cost step can't fit the run-time budget.**
- §3.3 asks for "three searches per (trip, road) pair", applied to every trip ("any other trip whose corridor happens to qualify").
- Measured cost: 1.57 s for 18 searches ≈ 85 ms per search on the Mac, from `reviews/2026-10-13-round-1.md` §56 and doc §1.
- With 8 roads: 270 × 8 × 3 ≈ 6.5k searches ≈ 9 min on one core, before any planning. With 50 roads it's ≈ 20 min with 3 workers. The tuner repeats this up to 50 times, but the result doesn't depend on the planner at all.
- Change: per trip, run 2 one-to-many searches (from A and from B, targets = all road endpoints). Cache the result per `(dataHash, tripsHash, roadsHash)`.

**M2. The holdout leaks, and is too small to support the acceptance rule.**
- (a) Holdout roads leak through tuning trips. The split is by road id, but "demanded" pairs also come from any tuning trip whose corridor qualifies, so the tuner does see holdout roads. Change: holdout roads count only on holdout trips.
- (b) Sibling trips can land in different sets. `tracks` trips are copies of `regional` trips, and the scout trips for CV-35, CV-345 and CV-363 are all València → Los Santos, which is also a `fixed` trip and therefore always tuning. Change: give siblings their parent's `splitKey`.
- (c) The holdout great-road check has no statistical power. With 8 seed roads and 30 %, the holdout is about 2–3 roads, so §5.4 criterion 2 means almost nothing.
- (d) The redraw re-contaminates. Redrawing on road id after 5 tunings moves roads the tuner has already seen into the holdout. Change: use "roads added after the last accepted tuning" as the great-road holdout.
- (e) Optional: split generated trips by 1° cell (already computed) to cut spatial overlap.

**M3. The tuning objective is self-referential and rewards gaming the slider.**
- `J` is built from the area under curve (AUC) of the planner's own `curvyM`. That is the right yardstick for search-completeness knobs (`INITIAL_APPETITES`, `MAX_TIME_GAP_S`, `MAX_EXTRA_SEARCHES`). It is wrong for `STOP_RULES`:
  - Looser stop rules keep more frontier points, so the best `curvyM` at each budget only goes up.
  - The "optimum" then sits wherever the invented weights `W_THIN` / `W_*` happen to balance.
  - Stop granularity is a UX decision, not something the AUC can judge.
- `W_GREAT = 1` was sized for 50 roads. With the 8 seed roads, one road is worth a 13 % fun gain everywhere.
- Changes:
  - Remove `STOP_RULES` from §5.3; expert-rider and UX decide them.
  - For group A, replace J with the "oracle frontier" that §8 marked YAGNI: one dense-appetite run per `dataHash`, cached. Report each candidate as (% of oracle AUC, settled nodes per plan) and pick the cheapest config within X % of the oracle.
  - Keep G1 as a hard constraint only, not inside J.
  - Build the tuner (slice 7) only if the oracle shows real headroom. It is the lowest-value slice.

**M4. The metrics use the same constants they are meant to judge.**
- H3 imports `STOP_RULES` (a tautology).
- `twistyM`, R7 and D2-on-`twistyM` use `CURVY_EDGE_SHARE`, `MAX_TWISTY_GAP_M` and `MIN_TWISTY_LENGTH_M` from `ride.ts`. §5.1 lists these as group B tunables, wrongly: they live in the app and need no data rebuild.
- Tuning them changes the definition of "twisty km" while the bench measures with it.
- Change: `checks.ts` keeps frozen copies of its measurement thresholds and never imports planner constants. Move those three constants to group A, or leave them untuned.

**M5. Per-trip ratchets will reject almost every route-changing change.**
- §3.4 fails the run on any trip that newly violates; §5.2 rejects a tuning candidate on any new R1, R2 or R9 violation.
- Any knob or route change reshuffles discrete choices across ~190 trips, and the doc says backtracking is already common. The Q9 override would become routine, and each override silently becomes baseline.
- Change:
  - Ratchet on net counts per check (new ≤ fixed), plus a hard cap on severity (e.g. a new backtrack above 2 km fails).
  - Keep zero-tolerance only for FAIL rules and G1 losses.
  - Start every R-check in REPORT mode and promote one to RATCHET only after it has caught a real problem a human confirmed.
- R4 (`distanceM / fastest ≥ 2`) should stay REPORT, or be normalised as non-twisty km gained per twisty km gained. A 50 km trip with a 3 h budget is supposed to triple its distance.

**M6. Missing check: whether Google Maps actually follows the ride.**
- Google Maps is the product's output, and PRD §6 targets "Google follows the planned twisties ≥ 90 %". The doc checks only the waypoint count (H9), and that is a tautology: `googleMapsDirectionsUrl` already slices to `MAX_WAYPOINTS`.
- Change: a deterministic proxy. For the default stop and the max-curves stop, route appetite-0 between consecutive pins (origin → pins → destination) and report the share of the planned twisty km reproduced.
- It costs about 10 short bidirectional searches per checked option. It goes straight at ROADMAP Phase 4 "Verify Google Maps actually follows each twisty".

**M7. Blind spot: one-way roads, so no Layer 1 or Layer 2 check can catch wrong-way routes.**
- `graph.ts:15` says "Undirected road graph", `bidirectional.ts` says "The graph is undirected", and nothing in the pipeline reads `oneway`. Turn restrictions are ignored too.
- Routes, and above all GPX exports, can go the wrong way down motorway carriageways, slip roads and one-way village streets. Going out and back on opposite carriageways also escapes R1, because they are different edges.
- §1's list of tags the graph lacks names surface, access and maxspeed, but not this.
- Change:
  - State it as a known blind spot in §1.
  - Add a ROADMAP item for the pipeline to export a oneway bit, then add a FAIL check.
  - Meanwhile add a "regress km" metric (km travelled while distance to B increases, per twisty km gained), which also catches backtracking along parallel roads.

**M8. Dead-end great roads can't satisfy G1 without failing R1.**
- `Carretera de la Mare de Déu del Mont` (in the seed list, present in the graph) ends at the sanctuary; Santa Engràcia most likely ends at the village too.
- An A→B planner can't ride them without backtracking, which R1 penalises. The `great` trip generator (A and B on opposite sides of the road's midpoint) assumes a through road.
- Change: add a `deadEnd` field. Exclude those roads from G1 until there's a product decision on out-and-back spurs, or ask the scout for through roads only.

**M9. A pipeline worktree may build from a different OSM snapshot.**
- The Makefile downloads `spain-latest.osm.pbf` only when `data/raw/` lacks it. `data/` is git-ignored, so a fresh pipeline worktree running `make data` gets a newer extract.
- Its diff against the baseline then mixes OSM edits with the code change. Group B and Next up 1 depend on exactly this comparison.
- Change: worktrees symlink `data/raw`, or pass `SPAIN_PBF=`. Record the pbf's sha256 and OSM replication timestamp in `meta.json` and in the baseline header, and fail the diff if they differ. Also hash `places.json` and `twisties.json` into the generator's identity.

**M10. The Layer 2 gate is too noisy to accept or reject anything.**
- §5.4.4 says "wins ≥ losses" over ≤ 25 trips, read by one ~100–200 k-token run. Many trips will be identical or near-identical. There is position bias, and on small local roads the judge may be relying on half-remembered road facts.
- Changes:
  - Only A/B trips that actually differ; the 5 random ones get a single-version absolute review.
  - Allow ties.
  - Run in chunks of 5–8 trips.
  - On the first round, run twice with X/Y swapped and measure how often the preference flips. If it flips a lot, keep the judge as a findings source, not a gate.
  - Drop GPX from the judge's inputs; an LLM can't read thousands of points.
  - Add what the text card needs to judge road choice: the top-rated `twisties.json` roads near the corridor that no stop rides, with detour cost, and distance-to-B at each road change.
  - A judge's "skips road X" becomes a `mustRide` only after the road is located and road-scout or the maintainer confirms it.

**M11. Acceptance statistics are too weak.**
- "Holdout J > 0 and ≥ half the tuning gain" can be driven by one trip when most trips don't change; half of a 0.005 gain is noise.
- Change: decide on counts of improved vs worsened trips (D2 categories), e.g. improved ≥ 2× worsened with a sign test or a paired bootstrap over trips, plus no G1 loss.

### Minor

- **m1. Route identity hashes the presentation too.** D1 and `--expect identical` hash `JSON.stringify(option)`. On `planner-speed`, b05716c re-recorded every gate hash only because a `rating` field was added to segments. Key "same route" on the `edges` hash plus the scalar fields, and keep the full hash only as a "presentation changed" flag.
- **m2. Two recordings will drift.** `planner.gate.json` (identified by `generatedAt`) and `baseline.jsonl` (identified by `dataHash`) record the same five trips. After slice 4, have the gate read its five trips from `baseline.jsonl`, or retire the gate JSON. `generatedAt` changes on every rebuild even when the data doesn't.
- **m3. "Searches per plan" is no longer a cost measure after Batch B.**
  - Bidirectional and lazy weights make searches very unequal in size.
  - `bidirectionalEdges` is a module function, which can't be wrapped from outside a bundle.
  - Use a settled-node counter in `ShortestPaths` (one increment) and base the constraint "≤ 1.25 × baseline" on it.
- **m4. Stale facts after Batch B.** On `planner-speed`, `INITIAL_APPETITES = [1,2,3,4,5,6,8]` with a separate `FASTEST_APPETITE = 0`, and `setWeights` became `EdgeWeights.use`. The §1 description and the §5.3 candidates that include 0 need updating. `places.json` is `{ places: [...] }`, not a bare array. The heavy-job wrapper always exports `VITEST_MAX_WORKERS=3`, so "7 under `HEAVY_EXCLUSIVE`" needs `BENCH_WORKERS` set explicitly.
- **m5. Tautological checks.** H2, H4, H5, H6 and H9 hold by construction (`distanceM` is defined as the sum; the URL slices to the limit), and H3 duplicates `sliderStops`. Keep them as unit tests, not as bench rules.
- **m6. The app's track code path isn't covered.** Once tracks are loaded, the app plans `includeTracks:false` on the stacked graph (`planner.worker.ts`). The bench uses a separate roads-only planner. Run a few non-track trips on the stacked graph and assert identical routes. Load the stacked graph (`tracks.bin` is 125 MB) lazily in one worker only, not in all 7.
- **m7. Village crawl is only half covered.** R6 sees only towns tagged at ≤ 50 km/h, and slip roads (always fun 0, 50 km/h) inflate it. Villages without maxspeed tags, the PRD 5.2 problem, are invisible to it. Add a "towns crossed vs fastest" count using the card's places-within-2-km logic.
- **m8. The default slider stop gets no special weight.** `App.svelte:75` picks the last stop with `extraS ≤ 45 min`, which is what riders see first. Report its checks separately, and anchor Layer 2 on it.
- **m9. Generation depends on the data.** It snaps, tags mountains and reads places from the current data, so "byte-identical `trips.json`" (slice 3) only holds for the same data. Put the generation `dataHash` in the `trips.json` header.
- **m10. The vite SSR build may not emit the worker.** A single `vite build --ssr bench/run.ts` entry won't produce a separate worker file. Use one entry that branches on `isMainThread` and runs `new Worker(fileURLToPath(import.meta.url))`.
- **m11. Concurrent branches will conflict on the baseline.** Each route-changing branch must rebase and re-run the bench before landing, because both branches rewrite `baseline.jsonl`. Say so in §3.5.
- **m12. Ratchet overrides can launder regressions.** Have the ratchet and baseline record list accepted violations with their reason, so they stay greppable instead of living only in commit bodies.

### Smallest slice with most of the value
1. Slice 1 without the tautological checks.
2. Slice 2 with B1 and M1 fixed.
3. Slice 4 limited to D2, D3 and G1–G4.
4. About 60–80 trips: the fixed trips, the `great` trips, and the mountain `regional` stratum.
5. All R-checks in REPORT mode, plus the Google pin-fidelity check (M6).

Add the other strata when the run time is known. Do blind A/B after the consistency test (M10). Do the tuner only if the oracle shows headroom.

## Open questions
1. **`RideOption.edges`:** accept it as `number[]`; a separate entry point is more code for no gain. The worker message grows by a few tens of KB, which is negligible. Re-record the gate once, and key route identity on the `edges` hash (m1).
2. **What must be found:** some stop, with demanded cost ≤ 90 min (ratcheted, net and per road); max-curves and 90–180 min stay REPORT. Exclude dead-ends (M8). Use geometric "ridden" (B1).
3. **Unnamed roads:** named or ref'd roads only for now, with exact matching. Later, the scout supplies a dense polyline (points ≤ 2 km apart) and "ridden" is purely geometric, so no name is needed.
4. **Data identity:** yes, pin the extract. Worktrees share or symlink `data/raw`. Record pbf sha256 and OSM timestamp in `meta.json` and the baseline header. Refresh only in a deliberate rebaseline commit (M9).
5. **Anchor lists:** fine as named constants. Resolve them by name in `places.json` at generation time and fail loudly when one is missing. They only matter at generation, since trips are frozen.
6. **Fun yardstick for pipeline changes:** start with great roads, D3 roads gained/lost and the judges. Add "model recall" (rated ≥ 4 `twisties.json` roads with low detour cost that no stop rides) as REPORT. Build a frozen geometric measure only when a group B tuning round is actually scheduled.
7. **Phone parity:** run it once, don't build infrastructure. Reuse the "bench hook" pattern already on the `bench-base`/`bench-new` branches (6954ff2): log the gate trips' hashes in a dev build, read them with `make logs`, and compare. Repeat after Batch B lands and after WebView major updates.
8. **Reference times:** prefer the rider's own recorded rides, from the Phase 4 calibration. Google and Kurviger times are car or other-model times, biased as a motorcycle yardstick, and have licensing questions. If used, keep them few and rounded with a source note, and ask `data-policy-reviewer`.
9. **Ratchet override:** with net ratchets (M5) overrides become rare. The director may override R-checks with the trip ids and reason in the commit body and an accepted list in the baseline. A G1 loss is never overridden by the director; it goes to the maintainer.

## What's good and must stay
- Deterministic Layer 1 with the trip set and baseline committed, and the baseline updated in the same commit as the route change, with the diff summary in the commit body.
- `dataHash` rather than `generatedAt`; per-trip seeded PRNG; an append-only trip set.
- D2's budget curve, which doesn't depend on how many stops there are, and D3's roads gained/lost by name.
- The great-road ratchet as the PRD principle-2 gate, and every judge finding becoming a fixed case with machine-checkable `expect`.
- Speed model fitted on recorded rides, not on the bench objective; no CI, no database, YAGNI on map shots.
- `--expect identical` for speed work, building on the Batch B gate.
- Splitting `great` trips by road id: right idea, it just needs M2's fixes.

