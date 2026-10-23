# Plan: Madrid → Granada under 2 s on the Huawei, without losing a road

Status: for the director's approval, nothing built. Owner: `routing`. Date: 2026-10-13.

## Where we are

Madrid → Granada, all options, on the Mac (node, warm, median of 5):

| Step | Mac | Huawei (review round 1: 7.4 s at the start) |
| --- | --- | --- |
| `main` at 95c5bb3 | 1,425 ms | 7.4 s |
| Batch B on `planner-speed` (bidirectional search, lazy weights, typed buffers) | ~870 ms | to measure |

The Huawei has run 5.1× slower than the Mac so far, so under 2 s needs about **390 ms on the Mac**. The fastest ride
reaches the UI after one search (~60 ms Mac, ~0.3 s Huawei) since the `fastest` message, so what is left is the time to
the full slider.

Where the 870 ms go: ~18 searches of ~35 ms (each settles ~160k of 644k nodes), ~140 ms for the two one-to-many
searches behind the partial rides, the rest is building the options.

## What we must not do (measured)

Refinement searches are slider stops. On 40 random trips of 80–600 km, stopping the bisection when the appetite
interval gets narrower than a floor changes the options of many trips, even for a floor of 0.02 (the finest we reach
is ~0.001):

| Floor | Searches (40 trips) | Trips with different options |
| --- | --- | --- |
| none (today) | 702 | 0 |
| 0.02 | 694 | 21 |
| 0.1 | 670 | 29 |
| 0.25 | 505 | 31 |
| 0.5 | 397 | 35 |

So every search stays; the saving has to come from each search being cheaper, or from running them side by side.

## The plan, in order of return

Each step is a branch, gated by `planner.gate.*` (identical options on the recorded trips) and measured on the Mac
first, then on the Huawei. A step that does not pay on the Huawei is dropped, not kept "because it is cleaner".

### 1. Number nodes and edges along a space-filling curve (pipeline) — expected −30 %

Measured by renumbering nodes by Hilbert order in a script, and edges by their lowest node: the same 9 options (same
times), 870 → 600 ms on the Mac. Morton order gives 630 ms. The Huawei is more memory-bound than the Mac (smaller
caches), so it should gain at least as much.

- `gis-data-engineer`: renumber in `export.py` (numpy `argsort` of the curve key); `tracks.bin` refers to road nodes
  by id, so the same mapping applies to it. The binary format does not change. Needs `make data` (heavy, 7.4 GB RAM).
- Risk: node ids decide ties between paths of exactly equal float cost (they break by arrival order). Equal costs of
  different paths are essentially impossible with float travel times, but the gate is the proof: it must stay green on
  the extended trip set below, not only on the five trips.

### 2. Pack the hot data the search reads together — expected −10–20 %

Each relaxation reads `adjacencyNode[i]`, `adjacencyEdge[i]`, then `edgeTimeS[e]`, `funShare[e]`, `edgeClass[e]`,
`values[e]`, `workedOutIn[e]`: seven arrays, four of them at a random edge index. Store time, fun share and class in
half-edge order (indexed by `i`, next to the neighbour) so one relaxation touches one or two cache lines. Same values,
so the same results. Costs 2 × 4 B per half-edge more memory in the search structure (the weights are no longer
needed per edge): to be offset in step 5.

### 3. A cheaper heap — expected −5–10 %

A 4-ary heap with the key and node interleaved. Ties between equal keys may pop in another order: same gate and the
same argument as in step 1.

### 4. The partial-ride searches (~140 ms on the Mac)

They are two one-to-many Dijkstras that settle ~275k nodes each (every twisty entry and exit has to be reached). Two
options, to be decided by measuring after steps 1–3:

- Prune with the cost of the routes already known (a node whose distance from the start plus its straight-line lower
  bound already exceeds the slowest affordable ride is useless): exact, since the budget is `maxExtraS`.
- Run them in a second worker while the main searches go on (see step 6).

### 5. Memory, which is also what kills the app on the phone

- **Tracks mode peak.** Measured in node: stacking the tracks layer peaks at ~780 MB RSS (roads graph 42 MB + its
  planner buffers 42 MB + `tracks.bin` 125 MB + stacked graph 219 MB + 115 MB of planner buffers for 2.6M nodes);
  releasing the roads-only planner afterwards changes nothing measurable (781 vs 778 MB), because the peak is inside
  `stackLayer`. The fix is to never hold both: fetch `tracks.bin` streaming into preallocated combined arrays (no 125 MB
  buffer, no `concat` copies) and build the planner once. Expected peak ~300 MB lower.
- Search buffers are 14 B per node twice (cost, via edge, settled, isTarget): `isTarget` is only needed by the
  one-to-many search, and the backward search can share the reached/settled bookkeeping. ~25 MB in tracks mode.
- Drop `funShare` as a stored array (13–14 MB): compute `Math.fround(min(1, fun / length))` when an edge is first
  touched (same value).

### 6. Spike: run searches in parallel (decide after 1–4)

The 7 initial appetites are independent, and the partial-ride searches too. The Huawei has 8 cores (4 big + 4 little).
Workers need to share the graph, which needs `SharedArrayBuffer`, which needs cross-origin isolation in the Android
WebView; without it each worker would copy the graph (42 MB roads, 219 MB with tracks), which is not an option.
A one-day spike answers whether Capacitor can serve COOP/COEP headers; if it cannot, this step is dropped. Refinement
rounds are sequential by construction (each bisection depends on the widest gap so far), so the best case is the
initial 7 + the partial rides running ~3× faster, not the whole plan.

### Not worth doing (considered)

- **Contraction hierarchies / customisable CH:** the weights change with every appetite; customising for 18 metrics
  on a phone costs more than the searches it saves.
- **ALT/A\* landmarks:** a valid lower bound has to hold for the lowest appetite, and at appetite 8 fun roads are
  ~3,000× cheaper than at 0, so the bound is too loose where it matters; precomputed distances per appetite level
  would cost hundreds of MB.
- **Fewer or coarser appetites:** measured above.

## Expected result

Steps 1–3 should bring the Mac to ~450 ms (Huawei ~2.3 s if the ratio holds, less if the memory effects are stronger
there); step 4 takes off another ~70 ms (Huawei ~0.35 s), which reaches 2 s. I would not promise it before step 1 is
measured on the Huawei: it is the biggest step and the cheapest to try (one pipeline change, no planner change).

## What I need before building

1. Approval of the order (1 → measure on the Huawei → 2, 3 → measure → 4, 5, 6 as needed).
2. A wider gate, shared with the route quality bench: the current five trips plus ~40 seeded random trips of 80–600 km
   (the script behind the table above), recorded as one fixture, so a renumbering or a heap change cannot hide behind
   a lucky trip. It extends `planner.gate.test.ts` (trips are data, one list).
3. The Huawei in slots, one agent at a time, median of ≥ 3 cold runs per build.

## Results so far (2026-10-13, evening)

Huawei P smart 2019, median of 3 cold starts, same build hook, same 9 and 7 options in every build:

| Build | Madrid → Granada | València → Los Santos | Planner init |
| --- | --- | --- | --- |
| `main` at 95c5bb3 | 7,040 ms | 1,452 ms | 1,074 ms |
| Batch B (bidirectional, lazy weights, numeric locator) | 5,255 ms | 587 ms | 497 ms |
| Batch B + Hilbert-numbered data (step 1) | 2,976 ms | 380 ms | 369 ms |

Step 1 gained more on the phone (−43 %) than on the Mac (−31 %), as expected from its smaller caches. On the Mac, with
the Hilbert data, Madrid → Granada plans in ~600 ms (median of 10 warm runs: 592–624 ms).

Steps 2 and 3, tried on the Mac with the Hilbert data (variance between runs is ±30 ms, so a gain has to be bigger):

| Try | Result | Decision |
| --- | --- | --- |
| 4-ary heap (step 3) | 645–740 ms, slower | Dropped |
| Weight and generation stamp of an edge side by side (step 2) | 595–655 ms, no change | Not kept |
| No `exp` call for the 59 % of edges with no fun, and for the 5 % that are all fun | 592–624 ms, no change | Not kept |

The Mac says the search is bound by memory latency on the first touch of each edge, which its large caches hide. A
packed layout can only be judged on the phone. Where the time goes (Mac, Hilbert data): 18 route searches of ~30 ms
(540 ms: 10 of them are refinements that settle as many nodes as the first 8), the two partial-ride searches ~96 ms.

## Step 7 and step 2, built and measured: neither pays on the phone

Both were built as separate branches (`guided-refinement` 344a2da, `packed-hot-data` 58279a0) and measured on the
Huawei, alternating builds so that the phone's heating does not favour one (4 rounds, Madrid → Granada, same 9
options, medians): plain Hilbert build 3,190 ms, guided refinement 3,430 ms, packed data 3,330 ms. València → Los
Santos: 370 ms, ~420 ms, ~440 ms. Neither is kept; the branches stay unlanded.

**What step 7 does on the Mac.** One A* search per refinement, steered by the distances to the end under the next
higher appetite (a plain Dijkstra from the end over the cost of the higher appetite's route, worked out once).
Exact: property tests against plain Dijkstra on random graphs (floats, whole seconds with many ties, graphs where
most roads have no fun, closed tracks; partial trees as the planner makes them), and the 48-trip gate identical.
Mac, Madrid → Granada 583 → 460 ms; the 48 gate trips take 24.7 s → 17.4 s in total. It needs a one-sided,
full-radius tree: the trees a bidirectional search leaves only reach halfway to the other end, so steering with them
gives no gain (tried first; the potential outside the tree is a constant).

**Why it does not pay on the phone** (phase timings from an instrumented APK, Madrid → Granada):

| | Plain Hilbert | Guided build |
| --- | --- | --- |
| Each of the 8 initial routes | 118–147 ms | 150–270 ms |
| Distances for the steering | – | 520 ms (4 routes' worth; 2.3 on the Mac) |
| Each of the 9 later refinements | ~125 ms | ~55 ms |

The steered refinements save about 70 ms each (630 ms in all), the distances cost 520 ms, and the unsteered routes
are 30–40 % slower in that build: the extra branch and read in the search loop that the steering needs cost
nothing on the Mac and a lot on the phone. A version without the loop cost would win ~100–200 ms at best, for the
most delicate code of the planner, and in València → Los Santos (few refinements) it would still lose. Not worth it.

**Step 2 (packed edge records, neighbour and edge side by side).** No gain on the Mac, none on the phone (3,330 vs
3,190 ms, inside the noise but never better), and +4 bytes per edge. Dropped.

## Where it stands

| Madrid → Granada on the Huawei | |
| --- | --- |
| Start of the day | 7.0 s |
| Batch B | 5.3 s |
| + Hilbert-numbered data | 2.9–3.2 s (where it is now) |

Phone phase timings of the plain Hilbert build: the 8 initial routes ~1.05 s, the 10 refinements ~1.3 s, the partial
rides ~0.5 s, everything else (options, geometry) ~0.1 s. The fastest ride reaches the UI after ~0.15 s.

Every exact trick tried since step 1 either needs the large caches of the Mac or costs what it saves on the phone.
What is left is not a faster search but a different delivery:

- **Show the slider in two stages.** After the 8 initial routes and the partial rides (~1.6 s on the phone) the stops
  that can already be built are final for every appetite found so far; the refinements only add or replace stops.
  The worker could post a preliminary slider at ~1.6 s and the final one at ~2.9 s. This is a product decision (the
  slider changing under the rider's finger is a cost) and `app`'s work; `routing` can post the stages.
- **Parallel searches** (step 6) stay a spike on cross-origin isolation, with the memory bill above.
