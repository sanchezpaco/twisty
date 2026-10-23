# Route quality bench

Status: **slices 1–4 built** (runner, `make bench`, H1, H7, H8, H10, H11, great roads G1–G6, the generator, the committed baseline and the diff, the report-only checks R1–R14); the rest is design. This is the living reference;
change it when the design changes. `app/bench/trips.json` still holds the 48 trips of the Batch B gate (5 fixed, 40
`cross`, 3 `tracks`), recorded before the strata above were decided; `run.js generate` appends the great-road
trips and the 35 mountain trips (91 in all).

Slice 3: `make bench` diffs against `app/bench/baseline.jsonl` and `--expect identical` (`make bench BENCH_ARGS="--expect identical"`) fails on
any changed route; `make bench-baseline` re-records it. The 48 trips tagged `gate` in `trips.json` are the gate: `planner.gate.test.ts` plans
them and compares each option's `presentation` (everything but the edge ids) with the baseline, so `planner.gate.json` is gone.

Slice 4: every R-check reports; their numbers are stored per trip in `results.jsonl` (`checks`) and the thresholds in
`checks.ts` are applied when the report is written, so changing one needs no new run. Ratios with nothing to divide by
are stored as 999 (JSON has no infinity). R11 has no reference times yet (the design asks for the rider's own rides).
`bad-roads.json` is empty until rider-safety fills it; H11 is built and tested. R13 uses the fastest road between the
origin, the pins and the destination as Google Maps's route, which has not been compared with the test ride yet. G6
takes a twisty's time from the fastest road between its ends.

Slice 2 decisions: detour costs are not cached yet (two one-to-many searches per trip add about a second to a run); a
road is matched by ref alone when the graph splits it across labels (CV-35, CV-345, CV-363, JV-7032); a road the
graph splits at a junction is two entries (`cv-345-villar-alpuente`, `cv-345-alpuente-titaguas`). `road-scout`'s review
(`reviews/2026-10-13-road-scout-seeds.md`) corrected the extents of CV-35 (split at Titaguas), CV-345 (from Villar) and
CV-363 (to the end of the road) and added 18 through roads with a scout trip each; the old ids are reported by D4 as no
longer in the list.
Roadmap: Phase 4b in `ROADMAP.md`. Product rule it enforces: *Never miss a great road* (`PRD.md` §2).
Revised after the independent review `reviews/2026-10-13-bench-design-review.md` (verdict: sound with changes).

The bench is how Twisty tests many routes automatically, scores them, catches failures and, if it pays, tunes the
planner. It has two layers:

- **Layer 1**: deterministic, no LLM, free. Runs the real planner on the real Spain data for a fixed set of trips
  and checks every slider option with objective rules. Runs on every planner or pipeline change.
- **Layer 2**: judges with taste (`expert-rider`, `road-scout`), only on a small sample, only when it pays.

Tuning comes last, and only if measurement shows there is something to gain (§5).

KISS: no server, no CI, no database. Files in the repo, one Node script, the machine's cores through its heavy-job slots.

## 1. What the planner outputs (the thing we measure)

The bench is built on top of Batch B (branch `planner-speed`), so this describes that planner.
`Planner.plan(from, to, settings)` (`app/src/lib/routing/planner.ts`) returns `RideOption[]` (`ride.ts`), sorted by
time:

1. The fastest route (`FASTEST_APPETITE = 0`), then one search per appetite in `INITIAL_APPETITES = [1, 2, 3, 4, 5,
   6, 8]`. Edge cost `edgeTimeS * exp(-appetite * funShare)`, worked out lazily by `EdgeWeights`; tracks closed unless
   `includeTracks`. Searches run from both ends (`bidirectionalEdges`).
2. Refinement: up to `MAX_EXTRA_SEARCHES = 10` extra appetites where neighbours differ by more than
   `MAX_TIME_GAP_S = 10 min`.
3. Partial rides: every run of consecutive twisties of every route (`twistyStretches`), reached and left the fastest
   way.
4. Candidates within `maxExtraS` (3 h, `DEFAULT_PLAN_SETTINGS`) → `paretoFrontier` on (time, fun score) →
   `sliderStops` with `STOP_RULES = { maxStops: 9, minTimeStepS: 180, minScoreGain: 3000, minScoreGainRatio: 1.15 }`.
5. `buildRideOption` per stop.

The app selects by default the last stop with `extraS ≤ 45 min` (`DEFAULT_EXTRA_S`, `App.svelte`). That stop is
what riders see first, so the bench reports it separately.

Fields of a `RideOption` the bench uses:

| Field | Meaning |
| --- | --- |
| `timeS`, `extraS` | Model travel time; extra over the fastest option |
| `distanceM` | Total length; by definition `twistyM + motorwayM + trackM + otherM` |
| `curvyM` | Sum of `edgeFunM`: fun-weighted metres, the planner's own score |
| `twistyM` | Real km inside highlighted twisties (uses `ride.ts` constants; the bench measures its own, §3.4) |
| `motorwayM`, `trackM`, `otherM` | Motorway + trunk, unpaved (`RoadClass.Track`), everything else |
| `twisties[]` | `{ label, lengthM, rating, line }`; `label` is `"REF · name"` from `graph.roadNames`, `rating` 1–5 |
| `segments[]`, `googleMapsUrl` | Drawing and hand-off (waypoints sliced to `MAX_WAYPOINTS = 9`) |

Per edge the graph (`app/src/lib/data/graph.ts`) gives `edgeTimeS`, `edgeLengthM`, `edgeFunM`, `edgeRoad`, `edgeClass`.

**Known blind spots of the data, so of the bench:**

- No surface, access or maxspeed tags. The pipeline applies them (`roads.py`: `is_paved`, `is_accessible`,
  `fun_weight`, `travel_speed_kmh`), so Layer 1 checks safety only against curated lists.
- **No one-way roads and no turn restrictions.** The graph is undirected (`graph.ts`: "Undirected road graph";
  `bidirectional.ts`: "The graph is undirected") and nothing in the pipeline reads `oneway`. Routes, and GPX exports
  above all, can go the wrong way down a motorway carriageway, a slip road or a one-way village street. An out-and-back
  on opposite carriageways uses different edges, so it escapes the backtrack check. No Layer 1 or Layer 2 check can
  see this until the pipeline exports a oneway bit (ROADMAP Phase 4). Then the bench gets a FAIL check. Meanwhile
  R12 (`regressKm`) catches some of the symptoms.

**Planner changes the bench needs** (all tiny, none changes a route):

- `RideOption` gains `edges: number[]`, the ids `buildRideOption` already receives. Needed for backtracking,
  connectivity, geometry and route identity. The worker message grows by a few tens of KB. The gate is re-recorded
  once, in the same commit, with proof that every other field is unchanged.
- `ShortestPaths` counts settled nodes (one increment). After Batch B, searches vary too much in size for "searches
  per plan" to measure cost, and `bidirectionalEdges` is a module function that cannot be wrapped from outside the
  bundle.

Measured on the Mac on 2026-10-13 (`planner.spain.test.ts` on main, before Batch B, one heavy slot):
Madrid → Granada 1.57 s, València → Los Santos 0.50 s, Huesca → Jaca 0.39 s. On the Huawei the first two took
7.4 s and 1.7 s (`reviews/2026-10-13-round-1.md`), so the phone is roughly 3.5–5× slower.

## 2. Layout

```
app/bench/
  trips.json          committed  the fixed trip set, with its tuning/holdout split and generation identity
  great-roads.json    committed  known great roads (road-scout), Layer 1 data
  bad-roads.json      committed  known unsafe roads wrongly in the tarmac graph (rider-safety), Layer 1 data
  baseline.jsonl      committed  results of main on the pinned data, one trip per line, plus accepted violations
  generate.ts                    trip generator (seeded)
  run.ts                         one entry: CLI (run | diff | card | oracle) on the main thread, planner on workers
  checks.ts                      pure metric functions; frozen measurement thresholds at the top
  roads.ts                       locate great/bad roads, one-to-many detour costs
  diff.ts                        baseline comparison and report
  *.test.ts                      unit tests on graphFixture graphs
  out/                git-ignored  results.jsonl, report.md, summary.json per run; cache/ for detour costs and the oracle
```

The bench lives in `app/` because it imports the real planner, the graph parser and `googleMaps.ts`. `bench/` is
added to a tsconfig so `npm run check` covers it, and its unit tests run with `npm test`.

**Why a script and not vitest:** vitest runs files in parallel, not trips, and we want a work queue over trips and
full control of the output. The script is bundled with the Vite we already have and run by plain Node. A single
`--ssr` entry does not emit a separate worker file, so `run.ts` is one entry that branches on `isMainThread` and
starts its workers with `new Worker(fileURLToPath(import.meta.url))`:

```bash
cd app && npx vite build --ssr bench/run.ts --outDir bench/.build && node bench/.build/run.js run
```

`make bench` wraps that. Engineers run it under the machine-wide heavy-job slots (`make bench` through the wrapper,
label `twisty:bench`), which export `VITEST_MAX_WORKERS=3` unless the caller set it. The bench reads `BENCH_WORKERS`,
which defaults to that. A run that takes the whole machine (`HEAVY_EXCLUSIVE=1`) must set `BENCH_WORKERS=7` explicitly.

## 3. Layer 1

### 3.1 Trip generator

`generate.ts` reads `places.json` (`{ "places": [[name, kind, lon, lat, context], …] }`), `twisties.json` (kept in `data/interim`, not shipped; `TWISTY_INTERIM` overrides),
`great-roads.json`, the graph, and a seed. It writes `trips.json`.

**Pool:** places of kind `city`, `town`, `village` (hamlets and suburbs are noise for trip ends).

**Randomness:** one `mulberry32` PRNG per trip, seeded with `fnv1a(SEED + ":" + tripId)`, so adding trips never
changes existing ones. `SEED = 20261013`.

**Strata.** The first set is the reviewer's "smallest slice with most of the value", about 60–80 trips. The other
strata come once its run time is known.

| Kind | Count | How | When |
| --- | --- | --- | --- |
| `fixed` | hand | The Batch B gate trips, the Phase 4 test ride (València → Los Santos), and every confirmed judge case (§4.3) | first |
| `great` | ≤ 2 per road | For each through road in `great-roads.json`: the scout's trip, unless it is within 1 km of an existing trip's ends (then that trip is reused), plus one generated trip (`-ends`) with A and B beyond the two ends of the road, 20–60 km from each end along the line out of the road (± 30°), so the road lies between them | first |
| `regional` mountain | 35 | A drawn per 1° cell, B at 50–150 km, with ≥ `MOUNTAIN_TWISTY_KM = 40` km of rating ≥ 3 twisties within 15 km of the straight A–B line | first |
| `regional` other | 35 | Same sampling, below that threshold | later |
| `cross` | 90 | A per 1° cell (so dense Catalonia does not dominate), B at 50–150 / 150–300 / 300–600 km, 30 each | later |
| `urban` | 30 | One end at the centre of `METROS` (Madrid, Barcelona, València, Sevilla, Zaragoza, Málaga, Bilbao, Murcia), the other 50–200 km away; half leave, half enter | later |
| `coast` | 30 | Both ends from `COASTAL_TOWNS` (~25 names: Costa Brava, Valencia, Andalusia, Cantabrian coast, Galicia), 50–300 km | later |
| `island` | 12 | Mallorca, Tenerife, Gran Canaria, 4 each, 25–80 km (the islands are too small for 50 km) | later |
| `tracks` | 10 | Copies of 5 mountain and 5 other `regional` trips with `includeTracks: true` | later |

`METROS` and `COASTAL_TOWNS` are named constants, resolved by exact name in `places.json` at generation time.
Generation fails loudly when a name is missing. They only matter at generation, since trips are frozen.

**Validation at generation:** a pair is kept only if both ends snap (`NodeLocator`, else `PlanningError('tooFar')`)
and the fastest route exists (`noConnection`); otherwise resample.

**Storage:** `app/bench/trips.json`, committed, one trip per line for readable diffs:

```json
{ "seed": 20261013, "generatedOn": { "dataHash": "…", "placesHash": "…", "twistiesHash": "…" }, "trips": [
{ "id": "regional-031", "kind": "regional", "tags": ["mountain"], "splitKey": "cell:-1:42", "set": "tuning", "from": [-0.4087, 42.1401], "fromName": "Huesca", "to": [-0.5498, 42.5705], "toName": "Jaca", "includeTracks": false },
{ "id": "fixed-valencia-los-santos", "kind": "fixed", "set": "tuning", "from": [-0.3763, 39.4699], "to": [-1.28005, 40.10779], "includeTracks": false, "roads": ["cv-35-…", "cv-345-…", "cv-363-…"] }
] }
```

Generation depends on the data (snapping, mountain tags, places), so "re-running gives a byte-identical file" holds
only for the same `generatedOn` identity, which is recorded in the header. Optional trip fields: `tags`, `roads`
(great roads this trip is the scout's trip for), `referenceTimeS` (§3.4, R11), `expect` (§4.3), `note`. The generator
is append-only and never rewrites existing ids. A full regeneration (new seed) is a deliberate, separate commit.

**Split** (written into the file so it never shifts silently; the tuner reads only `tuning` trips):

- Generated trips: `splitKey` is the 1° cell of A, so held-out trips are spatially apart from tuning trips.
  `set = "holdout"` when `fnv1a(splitKey) % 100 < HOLDOUT_PERCENT = 30`.
- Siblings inherit their parent's `splitKey`: a `tracks` trip that of its `regional` trip, and a reused scout trip
  that of the trip it reuses.
- `fixed` trips are always `tuning`.
- **Great-road holdout = roads added after the last accepted tuning** (`tunedThrough` date in the header of
  `great-roads.json`). Their `great` trips are `holdout`. Holdout roads count in G1 **only on holdout trips**, so the
  tuner never sees them through a tuning trip whose corridor happens to qualify. When a tuning is accepted,
  `tunedThrough` advances and those roads join tuning: the acceptance decision has looked at them. This replaces any
  periodic redraw, which would move roads the tuner has seen into the holdout.

### 3.2 Runner

`run.ts run [--set tuning|holdout|all] [--only <ids>] [--out <dir>] [--expect identical]`.

- **Data:** `app/public/data/` (`TWISTY_DATA` overrides it for a pipeline worktree's own build). The run records
  `dataHash`, the sha256 of `graph.bin` + `tracks.bin`, and the extract identity from `meta.json` once the pipeline
  writes it (§3.5, M9). `generatedAt` changes on every rebuild even when the data does not, so it is not used.
- **Parallelism:** `BENCH_WORKERS` workers, each parsing `graph.bin` once (43 MB). The stacked graph (`tracks.bin`
  is 125 MB) is loaded lazily, in one worker only, which takes every `includeTracks` trip and the stacked-graph parity
  trips (H12). The main thread hands out trip ids from a queue. Results are written sorted by trip id, so the file
  does not depend on scheduling.
- **Cost measure:** settled nodes per plan (§1), identical on every machine; Mac ms reported beside it.
- **Time budget:** the first set (60–80 trips) should take about a minute with 3 workers. The full set (~270) has a
  hard budget of **5 minutes in one heavy slot**. Over budget means profiling, never dropping trips.
- **Output:** `app/bench/out/<label>/` with `label = <short sha>[-dirty]` (or `--out`, which read-only agents point
  at their scratchpad): `results.jsonl`, `summary.json`, `report.md`. Exit code 1 when a FAIL rule fires.

One line of `results.jsonl` per trip:

```json
{ "id": "regional-031", "ms": 388, "settled": 812345, "dataHash": "9f2c…", "defaultStop": 2,
  "options": [
    { "timeS": 3060.2, "extraS": 0, "distanceM": 66012, "curvyM": 1043, "twistyM": 0, "benchTwistyM": 0,
      "motorwayM": 63100, "trackM": 0, "otherM": 2912, "twisties": [], "pins": 0,
      "routeId": "a41f09c2d7e3b815", "presentation": "195abdb58474ecc9" }
  ],
  "greatRoads": { "a-1205-jaca": { "located": true, "deadEnd": false, "costS": 1260, "foundAt": 3, "lastRides": true } },
  "checks": { "backtrackM": [0, 0], "regressKmPerTwistyKm": [0, 0.4], "pinFidelity": { "2": 0.94 } } }
```

`twisties` are `[label, lengthM, rating]`.

- **Route identity:** `routeId` is the first 16 hex of the sha256 of the edge ids plus the scalar fields (`timeS`,
  `distanceM`, `curvyM`). It changes only when the route changes.
- **Presentation flag:** `presentation` hashes `JSON.stringify(option)`, the gate's definition. A different
  `presentation` with the same `routeId` means only the display changed. On `planner-speed`, b05716c re-recorded
  every gate hash just because segments gained a `rating` field.
- **No edge lists stored:** full edge lists and geometry are not stored. The planner is deterministic, so
  `run.ts card <id>` re-plans a trip when they are needed.
- **Comparability:** edge ids change with every data build, so `routeId` only compares within one `dataHash`.

### 3.3 Known roads: locating, ridden, detour cost

`great-roads.json` (road-scout) and `bad-roads.json` (rider-safety) share one schema:

```json
{ "tunedThrough": null, "roads": [
{ "id": "a-1205-jaca", "ref": "A-1205", "name": "Carretera de Jaca a Santa María", "region": "Pyrenees",
  "from": [-0.55, 42.57], "to": [-0.62, 42.63], "via": [], "why": "…", "trip": { "from": […], "to": […] },
  "addedBy": "road-scout", "addedOn": "2026-10-13" }
] }
```

(Coordinates are illustrative; road-scout supplies the real ones. A bad road adds `"reason": "gravel" | "closed" |
"private" | "seasonal"` and has no `trip`.)

**Exact matching.** "Label contains" is wrong in today's `graph.bin`:

- `CV-35` also matches `CV-350`, `CV-352`… `CV-359`, `CV-3531` and `CV-35 · Autovia del Túria`.
- "Tost" also matches `Carretera de Montan de Tost`, `Carretera a Castellar de Tost` and
  `C-14 · Túnel de Montant de Tost`.
- `A-1205` exists both at Jaca and at Pulpí (Almería).

The new rule:

- A label is split on ` · ` into `ref` and `name` (a label with one part is either). An edge matches an entry when its
  ref equals the entry's `ref` exactly, or its name equals the entry's `name` exactly. With both given, both must match.
- Only named or ref'd roads are accepted for now. Same-ref roads elsewhere (A-1205 at Pulpí) are excluded by the
  points: the road is the matching path between them.

**Locate** (`roads.ts`):

- Snap `from`, `via…`, `to` only to nodes that touch a matching edge, within `SNAP_MAX_M = 500`.
- Join consecutive points with a Dijkstra restricted to matching edges.
- If no such node or path exists, the road is **unlocatable** (wrong points, or a renamed, split or dropped road), and
  the run says which.
- The located polyline is stored in `out/` for the report, the cards and the next run.

**Dead ends.** A located road is `deadEnd: true` when, leaving out the road's own edges, its start or its end reaches
fewer than `DEAD_END_REACH_NODES` (1,000) nodes: a village or a sanctuary pocket, not the network. It is computed, and
the scout may set it. Degree 1 is not enough: a through road cut off by a dropped way (Vidrà, whose link to BV-5227 is
`highway=residential`) ends at a degree-2 node and still leads nowhere in this graph, so the report says dead end until
the pipeline keeps the link. An A→B planner cannot ride a dead end without backtracking. Three of the eight seed roads are
dead ends in today's graph:

- `Carretera de la Mare de Déu del Mont` ends at the sanctuary.
- `Carretera de Santa Engràcia` ends at the village.
- `Carretera de Tost` ends at Tost.

Dead-end roads are **excluded from G1** (the maintainer decided on 2026-10-14: the planner does not offer out-and-back spurs, so the list holds through roads). They
are reported on their own, and the generator makes no `great` trips for them.

**Ridden, by geometry:** the road's polyline, resampled every 50 m, lies within `RIDDEN_TOLERANCE_M = 50` of the
option's geometry for ≥ `RIDDEN_SHARE = 0.8` of its length. That counts the other carriageway as ridden, survives
data rebuilds and is direction-agnostic. Edge geometry is simplified at 15 m (`GEOMETRY_TOLERANCE_M`), well inside
the tolerance.

**Detour cost**, one-to-many and cached:

- Per trip, the candidate roads are those whose straight-line lower bound fits the budget:
  `(gc(A, mid) + gc(mid, B) − gc(A, B)) / 115 km/h ≤ 90 min`.
- Two time-only searches run, one from A and one from B (the graph is undirected), each targeting every endpoint of
  every candidate road.
- `costS = min over both directions of t(A → roadStart) + roadTimeS + t(roadEnd → B) − fastestS`.
- That is 2 searches per trip instead of 3 per (trip, road) pair. The result does not depend on the planner, so it is
  cached in `out/cache/` per `(dataHash, tripsHash, roadsHash)`. The oracle and any tuning reuse it.

**Demanded:** a (trip, road) pair is demanded when the road is located, is not a dead end, `costS ≤
GREAT_ROAD_DEMAND_S = 90 min`, and the trip is in the road's set. Decided by the maintainer on 2026-10-14 (§9, question 1).

### 3.4 Checks

Modes:

- **FAIL**: fails the run whenever it fires. Only bugs, safety, and the loss of a great road.
- **RATCHET**: net per check. The run fails when the check's new violations outnumber its fixed ones, or when any
  single new violation exceeds the check's severity cap.
- **REPORT**: listed, never fails.

**Every R-check starts in REPORT.** It is promoted to RATCHET only after it has caught a real problem that a human
confirmed (the promotion is a one-line change in `checks.ts`, with the case in the commit body). Strict per-trip
ratchets would block nearly every route-changing change: any change reshuffles discrete choices across many trips.

**Frozen measurement.** `checks.ts` never imports planner or `ride.ts` constants. It keeps its own frozen copies
(`MEASURE_CURVY_EDGE_SHARE = 0.4`, `MEASURE_TWISTY_GAP_M = 1000`, `MEASURE_MIN_TWISTY_M = 3000`) and computes
`benchTwistyM` from the edges itself. Changing how the app defines a twisty therefore never changes what the bench
measures.

Checks that hold by construction are unit tests, not bench rules:

- `options[0].extraS === 0`.
- `extraS` within the budget.
- Stop count ≤ `maxStops`.
- km adding up.
- Waypoints ≤ 9 (`googleMapsDirectionsUrl` slices).
- Monotonic stops (`sliderStops`).

They live in `pareto.test.ts`, `planner.test.ts` and `googleMaps.test.ts`.

**Hard checks (FAIL)**

| Id | Rule |
| --- | --- |
| H1 `plans` | `plan()` returns options without throwing (every trip was validated at generation) |
| H7 `connected` | `edges` form one walk from the snapped start node to the snapped end node |
| H8 `noTracksWhenOff` | With `includeTracks: false`: no edge of `RoadClass.Track`, `trackM === 0` |
| H10 `deterministic` | Each worker re-plans its first trip at the end of the run; `routeId`s must match (guards reused search buffers and lazy weights) |
| H11 `noBadRoads` | No option rides (geometrically, as above) ≥ `BAD_ROAD_MIN_M = 300` of a road in `bad-roads.json` |
| H14 `noCarriagewayUTurn` | No option turns ≥ 170° from a one-way edge onto another one-way edge: a U-turn from one carriageway onto the other where a road divides (the pipeline splits plain divides; this catches the rest) |
| H13 `oneWay` | No option rides a one-way edge (`edgeOneway`) against its direction: metres ridden that way = 0 |
| H12 `stackedParity` | A few non-track trips planned on the stacked graph with `includeTracks: false` give the same `routeId`s as on the roads-only graph. The app does exactly this once tracks are loaded (`planner.worker.ts` keeps one stacked planner for both modes). The risk: snapping onto a track-only node |
| G1 loss | A demanded pair found in the baseline and missed now (below). Never overridden by the director; it goes to the maintainer |

**Great roads**

| Id | Metric | Mode |
| --- | --- | --- |
| G1 `found` | A demanded pair is found when **some** option rides the road (PRD §6). Recall per set, region and kind | Losses FAIL; recall reported |
| G2 `located` | Locatable in the graph; also whether a `twisties.json` twisty overlaps it (overlay coverage), and the graph's own fun share along the road (`edgeFunM / edgeLengthM`): the overlay can rate a road the planner finds dull | Located → unlocatable FAILs (a pipeline change dropped or renamed a great road); else REPORT |
| G3 `lastRides` | The max-curves option rides it | REPORT |
| G4 `costRatio` | `extraS` of the first option riding it ÷ `costS`; > 2 means the planner pays twice what the road needs | REPORT |
| G5 `deadEnds` | Dead-end great roads: located, and ridden as a spur by any stop | REPORT |
| G6 `modelRecall` | `twisties.json` roads rated ≥ 4 whose detour cost (same one-to-many machinery) is ≤ 30 min but that no stop rides: the model's own idea of a missed road | REPORT |

**Route sanity**, per option unless said otherwise. All start in REPORT, and each lists the default stop separately.

| Id | Metric (exact) | Threshold | Severity cap if promoted |
| --- | --- | --- | --- |
| R1 `backtrackM` | Σ `edgeLengthM` over repeated traversals of the same edge (an edge used k times counts k−1 times) | > 500 m | 2 km |
| R2 `loops` | Nodes visited more than once in the walk | > 0 | — |
| R3 `fastestDetour` | `options[0].distanceM / greatCircle(from, to)` | > 1.8 | — |
| R4 `transitPerTwisty` | Non-twisty km gained over the fastest option ÷ `benchTwistyM` gained (a 50 km trip with a 3 h budget is *meant* to triple its distance; what matters is what the extra km buy) | > 3 | — |
| R5 `fastestSpeed` | `options[0].distanceM / timeS` in km/h, trips ≥ 100 km | outside [45, 110] | — |
| R6 `slowDullExtraM` | `slowDullM(option) − slowDullM(options[0])`. `slowDullM` sums `edgeLengthM` of edges that are not `Track` or `Link` (slip roads are always fun 0 at 50 km/h), have `edgeFunM = 0` and speed ≤ 50 km/h. Sees towns tagged `maxspeed ≤ 50`, not untagged villages | > 8 km | 20 km |
| R6b `townsCrossed` | `city`/`town`/`village` places within 2 km of the route, minus those of the fastest option. Covers the untagged villages R6 misses (PRD 5.2) | > 5 | — |
| R7 `thinStops` | Option i ≥ 1 where Δ`benchTwistyM` < 2 km or Δ minutes ÷ Δ twisty km > 5 (a twisty km takes ~1.5 min at 40 km/h; 5 means the step buys mostly transit) | any | — |
| R8 `sameRoads` | Option i ≥ 1 whose twisty labels are a subset of option i−1's: more time, no new named road | any | — |
| R9 `emptySlider` | Trips ≥ 50 km with ≤ 2 options although the trip has a demanded great road or is tagged `mountain` | any | — |
| R10 `suspiciousNames` | km on tarmac edges whose label matches `/\b(camí\|camino\|pista\|forestal\|senda\|vereda\|cañada)\b/i` (`is_paved` only catches a `pista ` prefix and `forestal`/`basobidea`). New ones first: rider-safety's queue | ≥ 1 km | — |
| R11 `timeError` | `\|timeS − referenceTimeS\| / referenceTimeS` against the rider's own recorded rides (Phase 4 calibration) | > 0.15 | — |
| R12 `regressKm` | Km travelled while the straight-line distance to B increases (route geometry sampled every 200 m), minus the fastest option's, ÷ `benchTwistyM` gained. Catches backtracking along parallel roads and opposite carriageways that R1 cannot see | > 1 | — |
| R13 `pinFidelity` | For the default stop and the max-curves stop: route appetite 0 from origin through the URL's pins to the destination, and measure the share of the option's twisty km (geometric, 50 m) reproduced. A proxy for "Google Maps follows the ride" (PRD §6: ≥ 90 %; ROADMAP Phase 4 "Verify Google Maps actually follows each twisty"). Google's speeds are not ours, so the proxy is checked against the test ride's notes on where Google left the route | < 0.9 | — |
| R18 `sharpTurn` | Turns from one road onto another (`edgeRoad` changes) that double back ≥ 150°, headings read 15 m from the node. Legal hairpins at a junction on one road are left out; acute Y junctions between two roads are not, so it only reports | > 0 | — |
| R19 `townWrongWay` | Metres of a town's one-way streets (`OneWay.InTown`, ridden both ways because the graph lacks most town streets) ridden against their direction | > 0 | — |
| R20 `townWrongWaypoint` | Google Maps waypoints within 10 m of such a stretch: Google would be sent the wrong way down the street. Should stay at 0 | > 0 | — |
| R14 `straightInTwisty` | The longest run of edges that are not curvy (a track, or under 40 % fun) inside a twisty as the app draws and counts it: it calls the app's `twistyStretches`, not the bench's frozen copy. Catches the app joining runs of one road across a straight (a 121 km "twisty" with 101 km of dull road inside) | > 5 km | — |

Absolute times are not tuned by the bench. The speed model (`BASE_SPEED_KMH`, `CURVE_SPEED_KMH`,
`CURVE_SPEED_HALVING_TWIST`) is fitted to recorded rides by the Phase 4 calibration script. The bench only checks the
consequences (R5, R11, roads gained or lost).

### 3.5 Baseline and diff

`app/bench/baseline.jsonl` is main's `results.jsonl`, committed. Its first line is a header:

```json
{ "commit", "dataHash", "extract": { "sha256", "osmTimestamp" }, "tripsHash", "roadsHash", "createdAt",
  "accepted": [{ "check": "R1", "trip": "…", "reason": "…", "commit": "…" }] }
```

At about 270 trips × 2–3 KB it stays under 1 MB, and git shows changes trip by trip. `accepted` lists every
violation the director let through with its reason, so overrides stay greppable instead of living only in commit
bodies.

**Rules**

- A change that alters results commits the new baseline **in the same commit**, with the diff summary in the commit
  body.
- Each route-changing branch rebases on main and re-runs the bench before landing. Two branches both rewrite
  `baseline.jsonl`, and the second must be measured against the first.
- **Pinned extract (decided by the maintainer on 2026-10-14, §9 question 3):**
  - Proposal: worktrees symlink `data/raw/` from the main checkout, so every build uses the same
    `spain-latest.osm.pbf`. The Makefile only downloads it when it is missing, and a fresh worktree would otherwise
    fetch a newer one and mix OSM edits into a code diff.
  - The pipeline writes the pbf's sha256 and OSM replication timestamp into `meta.json`, and the diff fails when the
    extract differs from the baseline's.
  - A newer extract arrives only through a deliberate `chore(bench): rebaseline on <date> extract` commit. Its diff is
    worth reading: OSM edits can lose great roads too.
- A run whose `dataHash` differs from the baseline cannot use `--expect identical`, and `curvyM` comparisons are
  shown but not judged (the fun yardstick moved).

`run.ts diff` (also run automatically at the end of `run`) writes `report.md`:

| Section | Content |
| --- | --- |
| D1 Identical | Trips whose every `routeId` matches; presentation-only changes listed apart. With `--expect identical`, any `routeId` mismatch FAILs |
| D2 Better / worse | Per trip, the **budget curve**: for `BUDGET_POINTS_MIN = [0, 15, 30, 45, 60, 90, 120, 180]`, the best `curvyM` (same data only) and `benchTwistyM` among options with `extraS ≤ B`. *Improved* when some point gains ≥ max(1 km, 5 %) and none loses that much; *worsened* the other way round; *mixed* when both. Counts per set, with a sign test over the changed trips |
| D3 Roads gained / lost | Per trip, the union of twisty labels across options; aggregated by name: trips gained, trips lost, km. Great roads marked |
| D4 Great roads | G1–G6 per set: recall, newly found, lost (FAIL), unlocatable, dead ends, model recall, and the ids of the baseline that the list no longer has (their pairs cannot be compared) |
| D5 Checks | Per check: violations now, new, fixed, mode; the default stop apart |
| D6 Cost | Settled nodes per plan (mean, p95) and Mac ms (median, p95), against the baseline |
| Worst trips | The 10 worst by D2 and the 10 with most violations, with their option tables |

**Relationship to the Batch B gate.** `planner.gate.test.ts` + `planner.gate.json` (branch `planner-speed`) record
five real trips and require every option to be identical before and after speed work. It is the bench's first brick:

- The bench reuses its record shape and its idea of a recording from a reference commit.
- It widens the check from 5 trips to the whole set (`--expect identical`).
- It keys route identity on `routeId` rather than the presentation hash, and data identity on `dataHash` rather than
  `generatedAt`.

Once the baseline exists (slice 3), the gate's five trips are `fixed` trips. `planner.gate.test.ts` reads their
records from `baseline.jsonl` and `planner.gate.json` is retired, so there is one recording, not two that drift. The
gate stays in `npm test` as the fast, always-on subset.

### 3.6 When Layer 1 runs

On every change to `app/src/lib/routing/`, `app/src/lib/data/` or `pipeline/twisty_pipeline/`, the engineer runs
`make bench` (through the heavy-job slots) before hand-back, as with `make test`, and puts the report's summary in the
hand-back. Speed and refactor work runs with `--expect identical`. Pipeline work runs against its worktree's own data
build (`TWISTY_DATA`), from the pinned extract. There is no CI: the director checks the summary before landing.

## 4. Layer 2: judges with taste

### 4.1 `expert-rider` rounds

**When** (and only then):

- A quality change is up for acceptance.
- A pipeline change alters fun or speeds.
- A diff shows worsened trips or lost roads that Layer 1 cannot explain.
- Before a release.

Never for `--expect identical` changes.

**Sample**, at most 25 trips:

- Up to 10 most changed by D2.
- Up to 10 worst by Layer 1.
- 5 drawn at random (seeded by the round) to catch what the metrics do not see.
- Every open judge case (§4.3), until it is resolved.

**Blind A/B only where versions differ.** Trips whose options differ get both versions, labelled X and Y in a seeded
random order. The key stays out of the judge's folder. The 5 random trips get a single-version absolute review.
Ties ("same") are allowed.

**Consistency first.** The first round runs twice with X and Y swapped. If the preference flips on more than
`MAX_FLIP_RATE = 25 %` of the trips, the judge is a source of findings only, never a gate (§5.4), until a later round
shows it consistent.

**Chunks.** One agent run per 5–8 trips, not one long run over all of them.

**What the judge receives**, in the director's scratchpad, from `run.ts card <ids> --ab <baseline-results> --out
<dir>`. One Markdown **trip card** per trip, and for each version, every slider stop:

- minutes, extra minutes, km, and motorway / twisty / other km; the default stop marked;
- the **itinerary**: roads in riding order (consecutive edges grouped by label, roads ≥ 2 km, with km, the
  character word of each twisty, and the distance to B at each road change), and the towns passed (nearest
  `city`/`town`/`village` within 2 km, every 10 km).

Per trip the card also lists the **roads not taken**: the top-rated `twisties.json` roads near the corridor that no
stop rides, with their detour cost (G6). A judge can only say "you should have taken X" if it sees X was available.

No GPX (an LLM cannot read thousands of points) and no map shots. Map shots need the app to load a trip from a URL,
and they wait until judges report that text is not enough.

**What the judge returns**: its normal report (`expert-rider.md`: scores, findings, what works) plus one JSON block:

```json
[{ "trip": "regional-031", "prefer": "X | Y | same", "scores": { "X": { "roadChoice": 7, "flow": 8, "slider": 6, "times": 7, "trust": 7 },
   "Y": { "roadChoice": 6, "flow": 8, "slider": 5, "times": 7, "trust": 6 } },
   "findings": [{ "severity": "major", "version": "Y", "stop": 3, "roads": ["A-1205"],
   "text": "Skips the A-1205 climb to Jaca for a slower valley road", "fix": "…" }] }]
```

The director un-blinds it, keeps it in the run's `out/` folder and writes the round up in `reviews/` (score averages
per rubric line, wins / losses / ties, flip rate, findings).

### 4.2 `road-scout` grows the great-roads list

The scout covers one region per round: Pyrenees, Gredos, Alpujarras, Cantabria, Picos de Europa, Maestrazgo and
Teruel, Valencia interior, Garrotxa and Montseny, Sierra de Grazalema, Jerte and Hurdes, Ribeira Sacra, Mallorca,
Tenerife…

- **Seed list:** ROADMAP Next up 1 and 2: Carretera de Vidrà a Sant Privat d'en Bas, Mare de Déu del Mont, Tost, Santa
  Engràcia, JV-7032 Segura de la Sierra, CV-35, CV-345, CV-363. Three of them are dead ends (§3.3).
- **Entries:** named or ref'd roads only, with exact `ref`/`name` and endpoints on the road itself. Through roads are
  preferred, since a dead-end road is not demanded.
- **Committing:** the scout returns entries in the §3.3 schema (it is read-only); the routing session commits them.
- **Unlocatable entries** go back to the scout (wrong `ref`/`name` or points) or to the GIS engineer (the pipeline
  dropped or renamed the road).
- **Removal:** a road is never removed because Twisty misses it, only when riders agree it is not great.
- **Corrections of a seed** are for demand defects, never for tuning, and each one is recorded here:
  - 2026-10-14, `as-227-somiedo`: the demanded stretch is the Pigüeña gorge and the Puerto de Somiedo, not the whole road
    (the lower valley and the part into León are not what makes it great). Endpoints
    (-6.195, 43.350) → (-6.236, 43.048) became (-6.280, 43.188) → (-6.227, 43.023): road-scout's La Riera point
    (-6.286, 43.183) is 735 m from the nearest node of the graph and the locator wants one within 500 m, so the first
    point is that node. Re-baselined: the only result that moved is `cross-002` (found at the last stop, ratio 1.77).
  - 2026-10-14, `great-n-260-port-del-canto-gen` retired (listed under `retired` in `trips.json`, so `generate` does not
    make it again): on that trip N-260 costs 86 of the 90 minutes allowed, which is not "passing nearby". N-260 is still
    demanded and found at stop 0 on the scout's own trip, la Pobla de Segur → la Seu d'Urgell.
  - 2026-10-16, the 24 other `-gen` trips retired (reason in `trips.json`) and replaced by `-ends` trips whose A and B
    lie 20–60 km beyond the two ends of the road (maintainer, 2026-10-14: the old ones sat 30–150 km from its middle and
    often did not pass the road at all). `great-n-260-port-del-canto-ends` is the new generated trip of that road.

`rider-safety` maintains `bad-roads.json` the same way, from R10's queue and its own surveys.

### 4.3 Every confirmed judge failure becomes a fixed case

Each `blocker` or `major` finding becomes a `fixed` trip in `trips.json`, with a machine-checkable `expect` where
possible:

```json
{ "id": "fixed-huesca-jaca-a1205", "kind": "fixed", "set": "tuning", "from": [...], "to": [...],
  "expect": { "mustRide": ["a-1205-jaca"], "maxBacktrackM": 0 }, "note": "expert-rider 2026-10-20: skips the A-1205 climb" }
```

`expect` supports:

- `mustRide`: great-road ids. A judge's "skips road X" becomes a `mustRide` only after the road is located and
  road-scout or the maintainer confirms it is great: judges may half-remember small local roads.
- `mustAvoid`: bad-road ids.
- `maxBacktrackM`.

A broken `expect` is reported like an R-check and follows the same promotion rule. Findings that cannot be expressed
this way stay **open judge cases**, and their trips go into every Layer 2 sample until the judge says they are fixed.

### 4.4 Cost control

- Model and effort are the agents' own (`claude-opus-5-5`, effort `high`); no override.
- Chunks of 5–8 trips with ~1–2 k tokens per version: roughly 150–250 k tokens per expert round across its chunks.
  The first round costs about double (the consistency run).
- At most one expert round per accepted quality change, typically weekly or less. One road-scout region per round.
- Layer 1 does the filtering: judges only see changed or worst trips, plus 5 random ones.

## 5. Measuring headroom, then tuning (if it pays)

### 5.1 What could be tuned

| Group | Constants (file) | How |
| --- | --- | --- |
| A. Search completeness | `INITIAL_APPETITES`, `MAX_TIME_GAP_S`, `MAX_EXTRA_SEARCHES` (`planner.ts`); `FASTEST_APPETITE` stays 0 | Against the oracle frontier (§5.2), with no data rebuild |
| B. Fun model | `FUN_CURVE_DEG_PER_KM = (40, 150, 500)`, `FUN_CURVE_VALUE = (0, 0.55, 1)`, `WINDOW_M`, `DENOISE_TOLERANCE_M` (`curvature.py`); `PACE_SPEED_KMH = (40, 60)`, `TRACK_FUN_WEIGHT = 0.5`, `URBAN_MAXSPEED_KMH` (`roads.py`) | A few hand-picked candidates per round (≤ 5), each a data rebuild + run from the pinned extract; judged on G1, D3, G6 and the judges. `curvyM` is not used (§5.3) |
| C. Speed model | `BASE_SPEED_KMH`, `CURVE_SPEED_KMH = 100`, `CURVE_SPEED_HALVING_TWIST = 250`, `MIN_SPEED_KMH` (`roads.py`) | Fitted on recorded rides by the Phase 4 calibration script, never by the bench |
| Not tuned | `STOP_RULES`: stop granularity is a UX decision for `expert-rider` and `ux-designer`, and looser rules only ever raise the best fun per budget. `CURVY_EDGE_SHARE`, `MAX_TWISTY_GAP_M`, `MIN_TWISTY_LENGTH_M` (`ride.ts`): they define what a "twisty" is on screen; the bench measures with frozen copies. `maxExtraS`, `maxStops`, `MAX_WAYPOINTS`, the rating thresholds, the overlay constants | — |

### 5.2 The oracle frontier (group A)

For each `dataHash`, `run.ts oracle` plans every tuning and holdout trip with a dense appetite list
(`ORACLE_APPETITES`, 0 to 12 in steps of 0.25), no refinement limit and the same partial rides. It caches the
resulting Pareto frontier in `out/cache/`. That frontier is the best the current fun model allows. Every planner
configuration is then reported as:

- **% of oracle AUC**: the trip's budget curve on `curvyM` (D2), summed over `BUDGET_POINTS_MIN`, as a share of the
  oracle's, averaged over trips;
- **settled nodes per plan**.

This answers two questions at once:

- Is the current planner leaving fun on the table (headroom)?
- How many searches can Batch B's "under 2 s on the Huawei" plan cut before routes get worse?

The rule: pick the cheapest configuration within `ORACLE_GAP_MAX = 2 %` of the oracle, with no G1 loss. `curvyM` is
a fair yardstick here because the data is fixed.

### 5.3 The tuner, only if there is headroom

Build `tune.ts` (slice 8) only if the current configuration is below `100 % − ORACLE_GAP_MAX` of the oracle on the
tuning set. Otherwise there is nothing to tune, and the oracle report goes in the commit. If it is built:

- **Search:** coordinate descent over group A, each knob over a short candidate list:
  - `INITIAL_APPETITES`: `[1,2,3,4,5,6,8]` (now), `[0.5,1,2,3,4,6,8]`, `[1,2,3,4,6,8,10]`, `[1,2,4,6,8,12]`;
  - `MAX_TIME_GAP_S`: 5, 10, 15 min;
  - `MAX_EXTRA_SEARCHES`: 5, 10, 15.
- **Moves:** take a candidate when it raises % of oracle by ≥ 0.5 points without raising settled nodes by more than
  25 %, and G1 holds on the tuning set as a hard constraint (not a term in a score).
- **Budget:** at most 3 passes, about 30 evaluations of the tuning trips under `HEAVY_EXCLUSIVE=1` with
  `BENCH_WORKERS=7`. The detour costs and the oracle are read from cache.
- **Overrides:** `Planner` takes an optional `tuning` argument whose default holds exactly today's constants; the app
  never passes it.

For **pipeline** (group B) changes, `curvyM` itself moves, so any AUC would reward inflating fun. There the evidence
is G1 (both sets), D3 roads gained and lost, G6 model recall, and the judges. A frozen geometric fun measure gets
built only when a group B round is actually scheduled.

### 5.4 Acceptance of a route-changing change

Applies to tuning results and to any change meant to alter routes. All of these must hold:

1. **Counts, not averages.** On the holdout, D2 improved ≥ 2 × worsened, and a sign test over the changed trips
   gives p < 0.05. With most trips unchanged, an average gain can be one trip.
2. No G1 loss on either set, and holdout great roads (added since the last tuning) not lower in recall.
3. Every FAIL rule passes. No promoted check exceeds its net ratchet or severity cap.
4. If the judge passed the consistency test (§4.1): on the A/B trips, wins ≥ losses (ties don't count) and no new
   `blocker`. If it did not, its findings are read but do not gate.
5. If settled nodes per plan went up, `mobile-performance-engineer` measures the reference trips on the Huawei.

The change lands as source edits (not as a `tuning` argument), with the new baseline and the diff summary in the
commit. An accepted tuning advances `tunedThrough` in `great-roads.json`.

## 6. The Huawei

The bench runs only on the Mac. It makes no claim about phone speed beyond two signals:

- settled nodes per plan, which is machine-independent;
- Mac milliseconds, read with the rough ratio from review round 1 (phone ≈ 3.5–5× the Mac). A Mac p95 over ~0.5 s
  per plan warns that the phone will miss its 2 s budget (`PRD.md` §5.3).

Device numbers stay with `mobile-performance-engineer`, measured on the Huawei per review round on the reference
trips (Madrid → Granada, València → Los Santos, tracks on).

**Phone parity** is checked once, without building infrastructure:

- Reuse the bench-hook pattern on the `bench-base` / `bench-new` branches (6954ff2, not for landing): a dev build logs
  the gate trips' `routeId`s, read with `make logs` and compared with the Mac's.
- Repeat after Batch B lands and after a major WebView update.

## 7. Owners

| Piece | Owner |
| --- | --- |
| Runner, checks, diff, cards, oracle, tuner, `RideOption.edges`, settled-node counter | Routing session (`routing-engineer`), after Batch B lands |
| Trip generator and `trips.json` | Routing session |
| `great-roads.json` content | `road-scout` proposes, routing session commits |
| `bad-roads.json` content, R10 queue | `rider-safety` proposes, routing session commits |
| Extract identity in `meta.json`, data builds in pipeline worktrees, unlocatable-road fixes, group B candidates | GIS session (`gis-data-engineer`) |
| One-way roads in the graph and planner (ROADMAP Phase 4), then the bench's FAIL check | `gis-data-engineer` + `routing-engineer` |
| Layer 2 rounds, promotions to RATCHET, acceptance, `reviews/` write-ups | Director, with `expert-rider` |
| Phone timings and the parity check | `mobile-performance-engineer` |

## 8. Build order

Each slice is one small branch, landed before the next starts. Slices 1–4 are **the smallest bench with most of the
value**: about 70 trips, every R-check in REPORT, and the pin-fidelity check.

| # | Slice | Done when |
| --- | --- | --- |
| 0 | Batch B gate (in progress) | `planner.gate.test.ts` on main |
| 1 | **Runner**: `RideOption.edges` (gate re-recorded), settled-node counter, `run.ts` (one entry, workers), `results.jsonl` with `routeId`, `report.md`, H1, H7, H8, H10, `make bench`, `fixed` trips | `make bench` (in a heavy slot) plans the fixed trips, writes the report, exits 0; checks unit-tested on `graphFixture` graphs |
| 2 | **Great roads**: `great-roads.json` seeded with the Next up 1–2 roads; exact matching, snapping to matching edges, geometric ridden, dead ends, one-to-many cached detour cost; G1–G5; `great` trips and the 35 mountain `regional` trips | Report shows every seed road as located / dead end / found / missed with its cost; today's misses written down. Ticks ROADMAP Next up 2; Next up 1 is then measured before and after |
| 3 | **Baseline and diff**: `baseline.jsonl`, D1–D4, `--expect identical`; the gate reads its trips from the baseline | A no-op change reports all trips identical; a deliberate planner tweak shows trips improved / worsened and roads gained / lost by name |
| 4 | **REPORT checks** R1–R13 including pin fidelity, G6, the default stop apart, `bad-roads.json` + H11 | Report lists today's violations per check and for the default stop |
| 5 | **Full trip set and data identity**: the remaining strata, H12 stacked parity, extract identity in `meta.json` (with the GIS session) and the diff's extract check | ~270 trips in ≤ 5 min in one heavy slot; a run on a different extract is refused |
| 6 | **Trip cards and the first expert round**, with the consistency test | `run.ts card` writes A/B cards with roads not taken; the round and its flip rate are written up in `reviews/`; confirmed findings are fixed cases |
| 7 | **Oracle frontier** | Report shows % of oracle and settled nodes for the current planner, as input to Batch B's appetite questions |
| 8 | **Tuner**, only if slice 7 shows headroom | One pass over group A ends in an accepted change or a recorded "no gain" |

R-checks are promoted to RATCHET one at a time, as they catch confirmed problems; that is not a slice. Not planned
(YAGNI until something needs it): map shots in cards, CI, a results database.

## 9. Open questions

**Decided by the maintainer (2026-10-14):**

1. **What must be found.** Decided: some slider stop rides every great road whose detour costs ≤ 90 min (losses
   FAIL); the max-curves stop and roads costing 90–180 min are report-only. The PRD says "some stop"; the roadmap's
   older wording said "the max-curves option rides every listed road within the detour budget".
2. **Dead-end great roads and out-and-back spurs.** Mare de Déu del Mont, Santa Engràcia and Tost end in the graph
   (degree-1 nodes). Decided: Twisty does not offer out-and-back spurs (option A), the list holds through roads, and
   the three are excluded from G1 and reported apart. They return as "Also nearby" chips (ROADMAP Phase 4).
3. **Pinning the OSM extract.** Decided: worktrees share `data/raw/`; `meta.json` records the pbf's sha256 and OSM
   timestamp; the diff refuses a different extract; refreshes only in a deliberate rebaseline commit.

**Decided (defaults from the review; reopen if wrong):**

4. `RideOption.edges` as `number[]`, gate re-recorded once, route identity on `routeId`.
5. Unnamed roads: not accepted for now. Later the scout may supply a dense polyline (points ≤ 2 km apart) and
   "ridden" stays purely geometric.
6. `METROS` and `COASTAL_TOWNS` as named constants, resolved by name at generation, failing loudly.
7. Fun yardstick for pipeline changes: great roads, D3, G6 and the judges; a frozen geometric measure only when a
   group B round is scheduled.
8. Phone parity: the one-off bench-hook check of §6, no infrastructure.
9. Reference times: the rider's own recorded rides. Google or Kurviger times only if few, rounded, with a source note
   and `data-policy-reviewer`'s agreement.
10. Overrides: the director may accept R-check violations, with trip ids and the reason in the commit body and in the
    baseline's `accepted` list. A G1 loss is never overridden by the director; it goes to the maintainer.
