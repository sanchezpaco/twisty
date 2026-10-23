# Plan: the planner as an orienteering problem (routing v2)

Status: for the director's approval, nothing built beyond measuring probes. Owner: `routing`. Date: 2026-10-16, updated
2026-10-18 for one-way roads (the graph is directed: legs, candidates and searches have a direction) and with what the
stop rules cost today (section "Update 2026-10-18"). The 2026-10-16 probe below ran on the undirected snapshot.
Compared against the snapshot tag `routing-v1-2026-10-16` (main 1f584d1) and its data
(`data/routing-v1-2026-10-16/`, 649,409 nodes, 889,934 edges, 6,017 candidates).

## Why

Each symptom of the last weeks got its own rule on top of a path search and a slider ladder: the 90-minute cap,
`minScoreGain`, the 1.15 ratio, coverage stops, `GREAT_RIDE_RULES` with its 2 km step, frontier swaps, the top-40 and
top-30 candidate lists. Recall says the rules fit the trips they were tuned on: 62 of 110 demanded pairs on tuning
trips (56 %), 8 of 22 on held-out ones (36 %). We still beat OsmAnd and Kurviger on all six blind head-to-head trips,
and the filed wish (Santander → Oviedo, LLN-7, AS-340, AS-343) is to chain several great roads in one ride, which
today no generator builds on purpose.

The idea: state once what a slider stop is (the most valuable ride within a time budget) and what a set of stops is
(the best set for a rider who has not yet said how much time they have), solve that, and let chaining and the stops
come out of it instead of out of rules.

## Update 2026-10-18: one-way roads, and what the stop rules cost

Measured on main 21a6fc0 (one-way roads, the CV-712 connectors, junction-free times; data 3311fa55967b0a48), against
main 2e0580f before one-way roads (data 988f0fa007109bf6). Scripts in the session scratchpad (`orient/`).

**Where a missed great road falls out.** For every demanded pair no stop rides, the planner's stages were replayed and
the first stage that loses the road was recorded (a set rides the road when 80 % of it lies within the bench's
tolerance, as the bench reads it):

| Stage that loses the road | Pairs now (64 of 131 missed) | Before one-way (64 of 132) | What v2 does about it |
| --- | --- | --- | --- |
| In a ride, but the ride is dominated (off the frontier) and no coverage stop takes it | 38 | 38 | `GREAT_ROAD_WEIGHT` and forced rides (a stop may ride a great road while dominated) |
| On the frontier, thinned out by the stop rules | 9 | 9 | `E` and `GREAT_ROAD_WEIGHT` replace the thinning |
| In no ride: its candidate is near but cut by the top-40 / top-30 lists | 7 | 7 | the pool is exact; the lists go |
| In no ride: no candidate covers it | 10 | 10 | not v2's: a candidate question (step 5, windows of long candidates; split roads) |

47 of the 64 misses (73 %) are rides the planner already builds and the stop rules do not show; 7 more are lost to the
top lists. Only 10 need another candidate definition.

**Since one-way roads.** The totals stayed, the pairs moved. Lost: a-337 La Ragua on great-a-4132-alpujarra-ends,
bv-5114 Santa Fe on its own trip and ca-9104 on regional-033, each now on the frontier and thinned out (the three G1
losses the maintainer accepted as "stop rules"), and bv-5114 on its -ends trip, now dominated (the correction: the old
ride took a C-17 ramp the wrong way). Gained: a-1702 Maestrazgo and c-462 Tuixent - La Seu, both thinned out before, and
ca-9104 on its own trip (junction-free times). regional-025's a-337 went from dominated to no candidate. So since
one-way roads the stop rules cost three great-road pairs that a legal ride on the frontier already carries.

**The leg table is directed.** One-way edges are ridden one way, so a leg from road X to road Y is not the leg from Y to
X, and the table can no longer be stored as a symmetric half. Measured for Spain on main's graph: 6,569 candidates give
13,092 directed ones (46 directions cannot be ridden, `isRideable`), 12,432 entry and 12,432 exit nodes (a u16 index
still fits). One time-only forward search from every exit to every entry:

| Leg radius | Legs | Per exit (mean) | Raw size (u16 target, u16 s, u16 fun) | Before (undirected, symmetric half) |
| --- | --- | --- | --- | --- |
| 20 min | 258k | 21 | 1.6 MB | 0.7 MB |
| 30 min | 596k | 48 | 3.6 MB | 1.7 MB |
| 45 min | 1.42M | 114 | 8.5 MB | 3.9 MB |

The three radii from one search per exit to 45 min: 73 M settled, 18 s on the Mac. Directed legs also need the turn
rules: a leg starts at an exit as if arriving by the candidate's last edge, so its first move is never a banned U-turn
(the search's `TurnLabels`), and a chain is joined at an entry only where the leg's last edge may go on into the
candidate (`isRideable`, as `ridesThrough` and `combined` check today).

## A probe, already run (measure only, scripts in the scratchpad, not committed)

Snapshot data, time-only weights, eight trips: the six head-to-head trips (t1-t6) and the bench's
`fixed-valencia-los-santos` and `fixed-huesca-jaca`. Machine load was high (shared Mac), so milliseconds are rough;
settled nodes are not.

**The pool.** Candidates (both directions) whose own ride, fastest to and from it, adds at most 90 min:

| Trip | Candidates in the pool (rated 4-5) | Directed | Today's plan, settled | Of it, appetite routes |
| --- | --- | --- | --- | --- |
| t1 València → Los Santos de Maimona | 445 (56) | 819 | 5,249k | 81 % |
| t2 Madrid → Granada | 256 (29) | 498 | 3,603k | 79 % |
| t3 Jaca → Benasque | 139 (37) | 273 | 242k | 40 % |
| t4 Santander → Oviedo | 380 (164) | 758 | 1,101k | 77 % |
| t5 Madrid → Plasencia | 216 (17) | 427 | 1,312k | 75 % |
| t6 València → Alicante | 194 (47) | 373 | 1,187k | 78 % |
| València → Los Santos (Ademuz) | - | 308 | 663k | 64 % |
| Huesca → Jaca | - | 157 | 130k | 31 % |

**Legs between candidates cost too much to search on the phone, and little to precompute.** Exact legs (one bounded
search from every directed candidate's exit, up to what the budget allows) settle 6M-170M nodes per trip, 9 to 32
times a whole plan today. Legs up to 30 min only, on the phone: 0.2M-3.7M, i.e. +30 % to +340 % of today's plan.
Precomputed once for Spain (from each of the 11,542 candidate ends, time-only):

| Leg radius | Ends reached per end (mean) | Table entries | Raw size (u16 target, u16 s, u16 fun) | Build, Mac |
| --- | --- | --- | --- | --- |
| 20 min | 21 | 246k | 1.5 MB (0.7 MB as a symmetric half) | ~2 s |
| 30 min | 48 | 557k | 3.3 MB (1.7 MB) | ~4 s |
| 45 min | 113 | 1.30M | 7.8 MB (3.9 MB) | ~8 s |
| 60 min | 206 | 2.38M | 14.3 MB (7.1 MB) | ~15 s |

Legs longer than the table's radius go along the fastest route: one search from all the fastest route's nodes at once
(22k-99k settled, 2-20 % of a plan) gives each node its time to the route and where it joins it, so a long leg is "off
to the route, along it, off again", a real path. Against exact legs it is at the median 1.01-1.18 times as long, and
1.35-2.22 times at the 90th percentile (30-min table).

**What chaining finds.** A naive solver (greedy insertion by fun per extra minute, then remove-and-reinsert), counting
candidate fun only, against today's best option within each budget. Cells: today's candidate fun km / today's total fun
km (candidates plus connectors) / the solver's candidate fun km (roads in the ride).

| Trip | +20 min | +45 min | +90 min | +180 min |
| --- | --- | --- | --- | --- |
| t1 | 2 / 21 / 7 (2) | 15 / 37 / 26 (3) | 35 / 69 / 46 (5) | 90 / 126 / 78 (13) |
| t2 | 2 / 4 / 14 (3) | 26 / 28 / 27 (6) | 45 / 57 / 47 (9) | 74 / 90 / 75 (15) |
| t3 | 8 / 24 / 18 (3) | 29 / 39 / 27 (5) | 61 / 74 / 64 (7) | 100 / 119 / 97 (11) |
| t4 | 3 / 10 / 13 (2) | 21 / 24 / 27 (5) | 31 / 52 / 55 (13) | 97 / 121 / 98 (20) |
| t5 | 0 / 1 / 5 (2) | 11 / 21 / 14 (3) | 31 / 40 / 30 (6) | 87 / 102 / 72 (17) |
| t6 | 11 / 14 / 8 (2) | 20 / 26 / 25 (5) | 49 / 54 / 51 (10) | 94 / 103 / 89 (16) |
| València → Los Santos (Ademuz) | 20 / 34 / 10 (1) | 38 / 48 / 26 (3) | 49 / 67 / 45 (4) | 68 / 78 / 75 (11) |
| Huesca → Jaca | 15 / 20 / 15 (4) | 27 / 30 / 26 (6) | 40 / 42 / 37 (8) | 40 / 42 / 73 (11) |

What it says, as measurement: chains of candidates beat today's candidate fun at short and middle budgets on most trips
(5 of 8 at +20, +45 and +90 min, one tie at +20), today's rides are better at +180 min on 4 of 8, and today's rides
carry up to 36 km of fun on connectors that a candidate-only solver neither counts nor seeks. On t4 at +90 min the
chain rides 13 roads for 55 km of candidate fun against today's 31: the Kurviger kind of ride, and also the "council
lanes" risk (20 roads at +180). Solved with the design's legs instead of exact ones, the solver keeps 96.1 % (15-min
table), 96.9 % (30), 97.9 % (45) and 98.0 % (60) of the exact-leg candidate fun summed over the eight trips. The naive
solver ran 8 budgets twice in 9-67 ms on the Mac. Conclusion: the formulation is feasible on the phone with a
precomputed table; it must keep the appetite routes as seeds until they are shown to add nothing, and value connectors.

## 1. Formulation

**Inputs.** A, B snapped; the fastest time `F`; the slider's range `T` = `maxExtraS` (3 h, unchanged); the per-road
cap `C` = 90 min (maintainer, 2026-10-16).

**Rides.** A ride is any route from A to B. The planner builds them from the *pool*: every candidate of `candidates.bin`,
in each direction it may be ridden (`isRideable`), whose own ride (fastest to it, the road, fastest from it) adds at most
`C`. A chain is A → c1 → … → ck → B, each leg the fastest legal path from the exit of one to the entry of the next
(time only, tracks closed unless the rider opts in, no banned U-turn at either end of a leg), each candidate in one
direction at most. Routes from other generators (the appetite routes, their partial rides) are rides too: the solver
does not care what made a ride.

**Value.** `v(ride)` = the fun-weighted metres (`edgeFunM`) of every distinct edge the ride uses. That is today's score,
with one difference: an edge ridden twice counts once. Candidates, partial pieces of them and connectors count the same
way; there is no special case for any of them. No penalty term in v2's first version: motorways already score 0 and
cost time, tracks are closed or half-fun, and a value change (quality per rating, signed-slow km, council lanes) is
measured on its own, after the solver (step 5), so that the bench can say which change moved what.

**Problem 1, the rides.** For every budget `b` in (0, `T`]: the ride of most value with `time ≤ F + b`. The solver keeps
an archive of every ride it meets that no other beats on both time and value (today's `paretoFrontier`, kept).

**Problem 2, the slider.** Choose the stops `S` from the archive and from the forced rides (below): the fastest ride
first, at most 9, each later one strictly longer, more valuable and with more twisty km than the one before (the
ladder the rider reads on the slider, kept as a constraint). Maximise

```
U(S) = E(S) + GREAT_ROAD_WEIGHT · Σ fun of the great roads some stop rides − STOP_WORTH · (|S| − 1)
E(S) = Σ_i v(s_i) · (t_{i+1} − t_i) / T        (stops by extra time t_i, t_{|S|+1} = T)
```

`E` is the fun a rider can expect when their spare time is anywhere in [0, `T`] and they take the best stop that fits:
a stop close to its neighbour in time or in value adds little to it, so stops spread out by themselves, with no
minimum step, gain or ratio. A great road (rated 4-5, `GREAT_RATING`) counts once in the second term whichever stops
ride it (80 % of it, `RIDDEN_SHARE`, as the bench says), so two stops on the same roads add nothing there and a stop that
brings a new great road is paid for it: this is "never miss a great road" written into the objective, with its price
in plain sight. `STOP_WORTH` is what a stop must add to be shown: a short trip with little to gain shows few stops
(ROADMAP "few slider stops on short trips"). Two numbers replace the stop rules, the coverage rules and the great-ride
rules (inventory, section 3).

**Forced rides.** For every great road of the pool that no archived ride rides, the best ride through it (Problem 1
with that road fixed in the chain). It may be dominated by a ride the slider does not show; the ladder only has to
climb among the stops, so `GREAT_ROAD_WEIGHT` decides whether its road is worth a stop that is not the best of its
time. This is what today's `combined` coverage ride and the frontier swaps do, each with constants of its own.

**Google Maps.** A stop with more than four separate roads is not fully pinned in 9 waypoints (entry and exit per
road). Two options, measured both ways in step 2: a hard `MAX_VISITS` = 4 candidates per chain (fewer roads per stop,
Google follows them) or none (Google pins the best four as today, GPX follows everything). Open question 2.

The default stop (the last within +45 min, `App.svelte` and the bench) is unchanged.

## 2. Algorithm

**Precomputed (`make candidates`, `app/scripts/candidates.ts`, Node).** The directed leg table: for every directed
candidate's exit, the entries within `LEG_RADIUS_S`, time-only, each leg's time and fun (the fun of the leg's edges, so
connectors count), from one forward search that starts as if arriving by the candidate's last edge. Stored in
`candidates.bin` (TWC2 -> TWC3, with the gis-data-engineer; `graph.bin` unchanged). 30 min to start: 3.6 MB, built in
under 18 s on the Mac (measured, section "Update"); 45 min if step 2 shows the long legs cost a road (8.5 MB).
`candidates.bin` is 250 KB today; the size is the mobile-performance engineer's call.

**Per plan, on the phone.**

1. The fastest ride, posted at once (`onFastest`), as today.
2. A forward search from A to every candidate entry and a backward one from B to every candidate exit, bounded by
   `F + C`: the searches `ridesThrough` already runs, directed since one-way roads (145k-1,017k settled together on the
   six head-to-head trips before them). They give the pool exactly; the straight-line bound and the top-40 / top-30
   lists go.
3. Two searches from all nodes of the fastest route, bounded by `C`, for the long legs: a backward one (from an exit to
   the route) and a forward one (from the route to an entry). One undirected search settled 22k-99k nodes; two are
   estimated at about twice that, to be measured in step 2.
4. The solver: insertion by value gained per minute added, then local search (insert, remove, swap a candidate in for
   one out, flip a direction, move a candidate, reverse a stretch of the order), swept over budgets every 5 minutes up
   to `T` and warm-started from the previous budget. Every feasible ride it meets goes to the archive. Then one forced
   sweep per great road the archive misses. Deterministic: no randomness (H10).
5. The archive's rides that can become stops are built as edges: short legs by a bidirectional search each (cached),
   long ones from the route search's tree. Time and value are then measured on the edges, so a stop's numbers are the
   ride's and not the table's.
6. The stops: `E − STOP_WORTH·|S|` on the ladder is a dynamic programme over the archive by time (O(n²·9), n a few
   hundred); the great-road term is added by local swaps from that optimum.

Rejected: exact label-setting or integer programming (a pool of 157-819 directed candidates, exponential in the set
ridden, and no solver on the phone); legs searched on the phone (measured above: +30 % to +340 % at 30 min, far more for
exact legs); a contraction hierarchy (it would make exact legs cheap, but it is a new graph format and pipeline step;
it stays the fallback if the long legs cannot be made good enough).

**Complexity and the Huawei.** Before one-way roads (ROADMAP, 8 alternating cold launches): 0.22 s for a 4-min urban trip,
0.12 s for a 28-min trip, 2.8 s for Madrid → Granada (4 to 5 times the Mac); main 2e0580f measured 3,250 ms cold / 2,991
warm for Madrid → Granada on 2026-10-17, and one-way roads made every search slower per node (x1.29 of that on the Mac
after the speed-up). v2's bar is set against main's Huawei numbers re-measured before step 2. New work per plan: step 3 (+2-20 % settled), the
solver (O(n·L) per insertion, n ≤ 819, chains of L ≤ 20; the naive probe ran in 9-67 ms on the Mac; budget for the real
one: 50 ms on the Mac on the worst bench trip, ~0.25 s on the Huawei) and the legs of the stops (~50 short searches of a
few thousand nodes). With the appetite routes kept (step 2), Madrid → Granada is estimated, not measured, at about
+15 % (route search +3 % of the settled nodes, the stops' legs about +4 %, the solver's 50 ms about +8 % of today's Mac
time), over the +10 % the ROADMAP allows; it is measured on the Huawei before it lands. The appetite routes are 75-81 % of the settled nodes of a
long trip; if step 4 shows they add nothing the chains do not, the long trips get several times faster. Quality decides
step 4, not speed.

## 3. Inventory: today's rules and what happens to each

| Rule or constant (module) | Today | v2 | Why |
| --- | --- | --- | --- |
| `maxExtraS` 3 h (`planner.ts`) | slider's range | **kept**: `T`, the top budget and the range of `E` | product setting |
| `GREAT_ROAD_MAX_EXTRA_S` 90 min, `detourCapS` | cap on a candidate's detour | **kept**: the pool filter `C` (one road alone) | maintainer, 2026-10-16 |
| `FASTEST_APPETITE`, tracks closed unless opted in (`edgeWeights.ts`) | fastest route, legs | **kept** | the legs are fastest paths |
| `INITIAL_APPETITES`, `MAX_TIME_GAP_S`, `MAX_EXTRA_SEARCHES` | appetite ladder and refinement | **kept as a seed generator** (steps 1-3), removal measured in step 4 | they carry connector fun and roads that are not candidates (CV-345, 43 % curvy, is not one) |
| Partial rides of appetite routes (`routeStretches`) | in-between options | **kept with the seeds**, then subsumed: a chain of a route's twisties is a ride of Problem 1 | |
| Candidate rides one by one (`candidateStretches`, `ridesThrough`) | the only way to a road off the appetite routes | **dropped**: a chain of one candidate | |
| `FASTEST_POSSIBLE_SPEED_MS` 130 km/h | straight-line bound for the pool | **dropped**: the pool is exact from the A and B searches | |
| `MAX_CANDIDATES` 40, `MAX_GREAT_CANDIDATES` 30, `byFunThenRating` | per-trip top lists | **dropped**: the whole pool (the great list went from 20 to 30 when far roads pushed found ones out: C-462 rank 9 → 27) | |
| No repeated edge in a candidate ride | drops a ride whose approach uses the road | **derived**: value counts an edge once | fixes the ROADMAP `ridesThrough` item |
| `STOP_RULES.minTimeStepS` 3 min, `minScoreGain` 3,000, `minScoreGainRatio` 1.15 (`pareto.ts`) | thinning | **dropped**: `E` and `STOP_WORTH` | |
| Twisty km must grow from stop to stop (`sliderStops`) | thinning | **kept** in the ladder, with no threshold | a stop with fewer km on screen reads as "more time for fewer curves" |
| `spreadEvenly` to 9 | thinning | **dropped**: the 9 that maximise `U` | |
| `STOP_RULES.maxStops` 9 | slider | **kept** | slider design |
| `GREAT_RIDE_RULES` (gain 1, ratio 1, `minTwistyStepM` 2 km), `GREAT_RIDE_ROADS` 3 | great rides on the frontier | **dropped**: `GREAT_ROAD_WEIGHT` | |
| `COVERAGE_ROADS` 3, `MAX_SWAPS` 2, `JOIN_MAX_S` 20 min, `NEAREST_SAMPLE_STEP` 8, `combined` | coverage stops | **dropped**: forced rides and `GREAT_ROAD_WEIGHT` | |
| `coverage.ts`: protected first, second and last stop, "replaces the stop within a step", at most one dropped, `weakestStop` | ladder repair after a swap | **dropped**: the stops are chosen together; the fastest stays first by the constraint, the most valuable ride is the last one when `E` wants it | |
| `GREAT_RATING` 4, `RIDDEN_SHARE` 0.8 | what is great, what is ridden | **kept**: the coverage term's definitions, the bench's too | shared with the bench |
| `CURVY_EDGE_SHARE` 0.4, `MAX_TWISTY_GAP_M` 1 km, `MIN_TWISTY_LENGTH_M` 3 km (`candidates.ts`, `ride.ts`) | what a candidate is | **kept** in v2 (they define the pool); windows of long candidates are step 5 | split roads (C-462, N-502) are a candidate question, not a solver one |
| `MAX_SAME_ROAD_GAP_M`, rating thresholds, `POSTED_MIN_COVER_M`, pins of the best 4 (`ride.ts`) | presentation | **kept** | not planning |
| Default stop, last within +45 min (`App.svelte`, bench) | first stop shown | **kept** (UI); a "best value" stop stays on the ROADMAP | |
| New: `STOP_WORTH`, `GREAT_ROAD_WEIGHT` | | two numbers, fitted on tuning trips, read on held-out ones | |
| New: `LEG_RADIUS_S` (data), the solver's sweep step (5 min) and effort, `MAX_VISITS` (open question) | | named constants at the top of the modules | |

About 20 numbers and repair rules go; two tunable numbers, one data radius and the solver's effort come in.

## 4. Evaluation, v1 against v2

As updated: v2 runs against main on main's data, since the snapshot's data is undirected and v2's legs are not:
`TWISTY_DATA` a scratch copy of main's data with v2's `candidates.bin` (TWC3), `TWISTY_INTERIM` a scratch dir with main's
`twisties.json`. `app/public/data` and `data/interim` are never written. v1 (the snapshot) stays the reference of the
blind kit, whose verdicts were given on it; v2 is judged against main and v1 alike in (b).

- **(a) Bench**, 127 trips, against the tag's `baseline.jsonl`: recall on tuning and held-out trips, G1, settled
  nodes, stops per trip, near-equal neighbours, default stops that move, lane km at all stops and at the default
  (LLN-, PI-, CB-, CO-, HF-, SC-222, as in `reviews/2026-10-16-quality-score.md`), signed-slow km. **Every G1 loss goes
  to the maintainer** with the two rides, never accepted by the routing session or the director alone.
- **(b) The frozen blind kit** of `routing-eval` (built in parallel, not by this plan): the v1 misses as X (our stop
  nearest the forced cost) against Y (the forced route), v2's new misses as a second list, the 20 control hits, and the
  25-trip 1-5 sample with the six head-to-head trips. The director runs the judge, two reshuffled rounds, as for v1.
- **(c) Huawei**: `plan()` apart from fetch and parse, 8 alternating cold launches of v1 and v2 builds, the three
  ROADMAP trips (urban 4 min, 28 min, Madrid → Granada).
- **(d) The 25 fresh trips** (`app/bench/eval/out-of-sample.json`, unspent): read once, on the step 2 candidate that
  passes (a)-(c), with the kit's 1-5 sample, never tuned on.
- **Real trips** for every step that changes routes: València → Los Santos (de Maimona and Ademuz) and Huesca → Jaca,
  every stop's time and curvy km, before and after.

**Success bar** (v2 replaces v1 only if all hold):

1. Recall: tuning not below main's 60 of 109, held-out at least 12 of 22 (main: 7), and the held-out share within 10
   points of the tuning share (main: 32 % against 55 %): the gain transfers. No G1 loss the maintainer has not accepted.
   Of main's 64 misses, the 47 the stop rules drop and the 7 the top lists cut are v2's to win; the 10 with no
   candidate are not.
2. Kit: on the frozen v1 misses, the judge prefers v2's X to Y, or calls them equal, in more pairs than v1's X; the
   control hits do not fall by more than 2 of 20; the 25-trip mean is at least v1's, no head-to-head trip's most-fun
   stop drops a point or more, and the six head-to-head top picks are not worse than v1's (ours on 4 of 6).
3. Lane km at the default stop not more than v1's + 10 %, unless the maintainer accepts the rides that add them.
4. Huawei: within +10 % of v1 on the three trips, or a measured overrun the director accepts for a measured quality
   gain (the few-stops precedent, +14 % for recall 38 → 44).
5. The inventory holds: the dropped rules are deleted, not left behind a switch.

## As built: steps 1 and 2 (2026-10-18, branch `orienteering`)

Measured against main with the split-end fix (branch `split-end-uturn`, the base of this one), data 3311fa55967b0a48 with
v2's `candidates.bin`; scripts in the session scratchpad (`orient/`).

- **Step 1** (`slider.ts`): the objective of section 1 problem 2, solved exactly by a ladder DP; great roads no stop rides
  are forced through it while U grows, the best ladder through each candidate read from a prefix and a suffix table (two
  DPs per round instead of one per candidate: a cold Jaca -> Benasque was 21 % slower before). `STOP_WORTH` 250 and
  `GREAT_ROAD_WEIGHT` 0.06, fitted on the tuning trips only, by a rule set before the last grid: the most recall without
  twisty km per budget falling more than 2 % against main. The rider's spare time is spread evenly (open question 1 kept
  at the default).
- **Step 2** (`orienteering.ts`, `legs.ts`): the pool is exact (no top lists, no straight-line pool); the directed leg table
  holds, per leg, the adjacency slots of its first and last edge, so a leg that leaves a road back along it or comes into
  the next along it is left out (without that, 26-30 of the ~33 chains on the frontier rode an edge twice). The solver
  works on the table's adjacency (only roads with a leg on both sides are tried between two others); budgets every 10
  minutes; 3-27 ms on the Mac. The chains on the frontier are rebuilt with one bidirectional search per leg (4-11k nodes).
- **Generators dropped in step 2**, each measured on the bench: the searches at the appetites in between
  (`MAX_EXTRA_SEARCHES`; settled -40 %, recall equal) and the coverage rides (`combined`, step 3 of section 5: recall +1
  without them). The partial rides of the appetite routes stay: without them twisty km per budget fell 3-11 %.
- **`LEG_RADIUS_S` 20 minutes**, not 30: the same recall and G1, twisty km per budget within 0.4 % from a 30-minute budget
  up (1.8 % at 15), and `candidates.bin` 2.43 MB (1.21 MB gzipped) instead of 5.15 MB (2.50); today's is 0.25 MB.
- **Results** against main with the split-end fix: recall tuning 60 -> 75 of 109, held-out 7 -> 7 of 22 (the bar of 12 is
  not met); G1 3 lost (ca-9104 on great-a-397-ronda-san-pedro-ends, c-462-tuixent-la-seu on great-c-462-coll-de-port-ends
  and great-c-462-tuixent-la-seu-ends), 18 gained against main; D2 fun tuning 15 better / 4 worse (p = 0.019); settled
  nodes -41 %; Mac ms on the Huawei trips (cold / warm, median of three rounds alternated with main and with main plus the
  split-end fix): Jaca -> Benasque 77 / 48 against 74 / 53 (77 / 55 with the fix alone), Madrid -> Granada 505 / 506
  against 922 / 929, València -> Los Santos 102 / 102 against 145 / 140. The cold Jaca -> Benasque's 3 ms come with the
  split-end fix.
- **H14 on cross-038** (Málaga, 36.77353,-4.42487): the turn was illegal (OSM r1299677, only_straight_on): the end of a
  split road, 143 deg by the graph's headings, under `U_TURN_DEG`. Main rode the same kind of turn on cross-004 (A Vila,
  r3761445, 149 deg). Fixed in the planner on its own branch (`SPLIT_END_U_TURN_DEG`, graph.ts); H14 is unchanged.

## 5. Steps

Each step is a branch from the one before, prototyped in the bench (Node) first, gated by its bench run and, where it
changes routes, the real trips. Step 1 only changes which of today's rides become stops and can land alone; step 2
is where chains reach riders and lands only after (a), (b) and (c); steps 3 and 4 land one by one after it.

1. **The slider objective on today's rides.** `slider.ts` (pure): `E`, the ladder DP, the great-road swaps; it replaces
   `sliderStops`, `spreadEvenly` and the great-ride rules. Today's rides and coverage rides are the input, so the step
   measures the objective alone. `STOP_WORTH` and `GREAT_ROAD_WEIGHT` fitted on tuning trips only. Unit tests on the
   synthetic graph (`graphFixture.ts`) first.
2. **The chains.** The leg table in `candidates.bin` (TWC3, with the gis-data-engineer; size to the mobile-performance
   engineer), `orienteering.ts` (pure: pool, insertion, local search, archive), the route search for long legs, the
   reconstruction. The chains join the appetite rides in the archive; the single-candidate rides and the two top lists
   go. Measured: `MAX_VISITS` 4 or none, `LEG_RADIUS_S` 30 or 45 (the probe's 96.9 % of exact-leg value at 30 min has to
   be closed: through the appetite routes as more "backbones", a larger radius or exact legs for the stops' long legs,
   measured in that order), solver effort. Then the kit and the Huawei.
3. **Forced rides replace the coverage stops.** `coverage.ts`, `combined` and their constants are deleted.
4. **Drop the generators that add nothing**, one at a time; a generator stays if removing it costs a G1 or recall:
   the partial rides of appetite routes, the refinement searches, then the appetite routes themselves (75-81 % of a
   long trip's settled nodes). This is where the speed comes back, if it does.
5. **Value, as separate items**, each measured on the bench and the kit and each a maintainer's call: a quality weight
   per rating (it lost G1 under today's thinning, `reviews/2026-10-16-quality-score.md`; to be measured again here),
   signed-slow km, council lanes, windows of long candidates as their own pool entries (C-462's great 14 km inside a
   63 km candidate), fun-seeking legs.

**UI.** Nothing for steps 1-4: the worker messages and `RideOption` keep their shape; `coverageRoad` names the road of
the stop that the great-road term put on the slider. What riders see differs: fewer stops on trips with little to
gain (down to one, which the UI already shows on urban trips), different spacing, and longer lists of twisties on
chained stops (the twisty list and the pins already cope; the pins note shows more often if `MAX_VISITS` is off). If the
maintainer wants a chain called a chain in the ride summary, that is a frontend item after step 2.

**Cost.** Step 1: two days. Step 2: four to five days with the table, the bench runs and the Huawei pass. Step 3: one
day. Step 4: a day per generator. The kit run: the director's.

## 6. Risks, and what makes us stop

- **Chains chase council lanes.** The probe's chains ride 11-20 roads at +180 min, and the fun model overvalues lanes
  (`reviews/2026-10-16-two-sided-survey.md`). Guard: lane km (success bar 3), `MAX_VISITS`. A value change for lanes
  is step 5 and the maintainer's.
- **Long legs.** Along the fastest route they are up to 2.2 times exact at the 90th percentile; the probe lost 2-4 % of
  value to them. Mitigations in step 2, the contraction hierarchy behind them.
- **The objective keeps the model's taste.** v2 maximises today's fun score better; where the score is wrong (classics
  undervalued, lanes overvalued) v2 is wrong with more conviction. The kit's absolute sample is what catches it.
- **Phone cost.** The solver is JavaScript on an old phone, and forced rides grow with the great roads of the pool (164
  on Santander → Oviedo). The solver has an effort budget; if the Huawei overrun stays above +25 % after step 4 with no
  quality to show for it, we stop.
- **The two weights become the new rules.** If `STOP_WORTH` or `GREAT_ROAD_WEIGHT` need per-trip-length variants, or a
  third constant, to pass the bench, it is patching again.

**We stop** (and keep v1) if: step 2 does not raise held-out recall and does not beat v1 at equal extra time on the
head-to-head trips; a G1 loss the maintainer rejects can only be fixed by a new rule; the kit's judge prefers v1's
sample; or the Huawei bar cannot be met after step 4.

## Open questions for the maintainer

1. The rider's spare time in `E`: spread evenly over 0-3 h (no constant), or weighted towards short detours (the
   default stop is +45 min)?
2. Google Maps: at most four roads per stop so that Google follows all of them, or longer chains with the best four
   pinned and the GPX for the rest?
3. "Never miss a great road" gets a price (`GREAT_ROAD_WEIGHT`): may a stop ride a great road while giving less fun than
   a ride the slider does not show (the Vidrà kind), or must every stop be the best of its time?
4. v2's first version keeps today's fun score, so that the bench compares algorithms, not tastes; quality per rating,
   signed-slow km and lanes come after, one by one. Agreed?
5. The directed leg table adds about 3.6 MB to the download (8.5 MB at 45 min; it was 1.7 / 3.9 MB before one-way roads
   made legs directed). Acceptable, with the mobile-performance engineer?
6. The 90-minute cap stays per road, while a chain of several roads may add up to the slider's 3 h. Is that the cap's
   meaning?
