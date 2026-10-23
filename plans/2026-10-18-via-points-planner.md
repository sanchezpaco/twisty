# Plan: stops in the trip, the planner half (ROADMAP 16)

Status: for the director's approval, nothing built. Owner: routing. Date: 2026-10-18. Written against the contract in
section 6 of `plans/2026-10-18-via-points.md` (app, branch `via-points-plan` 5a9cae5), and for the orienteering planner
(branch `orienteering`, with plan (a) of `plans/2026-10-18-great-road-as-known.md`), which lands first: this plan
changes its `plan()`, not today's main.

## The idea

A trip with stops is a chain of legs, start → stop → … → finish, and the rider gives one budget to the whole day
(app's plan, section 2: nothing on the slider is per leg). Each leg is planned as a two-point trip is planned today, up
to the slider; the legs' rides are then joined into whole rides, and the slider chooses among whole rides exactly as it
does now.

This is the orienteering problem with the stops as places the chain must pass, in order. With the stops fixed, the legs
are independent but for one thing (a road ridden in two legs, below): the best whole ride for a budget is the best
split of that budget between the legs, and the frontier of whole rides is the **Pareto sum** of the legs' frontiers.
Planning each leg on its own and summing is therefore exact for the chains, not a heuristic, and it is what puts the
detours where they pay most: a leg through the Maestrazgo takes the hour, a motorway leg takes none.

## 1. Planning a trip with stops

`Planner.plan(points, settings, onFastest)` replaces `plan(from, to, …)`; `points` is 2 to `2 + MAX_VIA` places.

1. **Snap** every point (`snap`). A point far from any road fails `tooFar` with its index (`point`).
2. **Fastest whole ride**: the fastest route of each leg, joined. It goes to `onFastest` as soon as it is known, as
   today: k point-to-point searches over legs that sum to the trip, so about the settled nodes of a two-point trip of the
   same length (the contract's speed promise). A leg with no route fails `noConnection` with its index (`leg`).
3. **Each leg up to the slider**: appetite routes, near stretches, ways around, single rides and chains
   (`orienteering.ts`), as `plan()` builds `rides` today, with the leg's own fastest time and the whole trip's range
   (`maxExtraS`) as its range. Shared per planner and unchanged: the candidates, the leg table, the great roads.
4. **Whole rides** (section 2), then the **slider** (section 3), then one `RideOption` per stop (section 4).

The two-point trip is the case of one leg: step 4 joins nothing, and every two-point result stays what it is (the bench
baseline does not move; that is a check, section 6).

**At a stop the ride may turn back.** The rider stops there (a town, a viewpoint), so the turn rules of `isRideable`
apply within each leg and not across the stop: València → Teruel → Segorbe may leave Teruel by the road it came in on.
Within a leg nothing changes.

## 2. Whole rides: the Pareto sum of the legs

Each leg gives its frontier `F_i` (time, fun) of the rides within range. The whole frontier is folded leg by leg:
`W = prune(W ⊕ F_i)`, where `⊕` adds time and fun of every pair, and `prune` keeps the pairs no other beats on both and
within `fastestS + maxExtraS` of the whole fastest. The frontiers hold 17-46 rides (measured on the orienteering branch
for Jaca → Benasque, Madrid → Granada, València → Los Santos and the loop's three legs), so a fold is at most about 2,000
pairs and the pruned result about the size of one frontier; three folds for three stops.

**A road ridden in two legs counts once.** The legs are not quite independent: on a loop (València → Teruel → Segorbe →
València) the first and last legs may both find the same twisty near home. Riding it twice is not twice the fun (and not
what a rider asks for), so a pair's fun is its additive estimate while folding, and the survivors are then measured on
their edges with each edge's fun counted once, and pruned again. This keeps the fold cheap and the result honest; a pair
lost by the estimate would have had more fun only by riding a road twice.

**Great roads.** The slider today also gets, for each great road the trip may ride, the rides of it that no faster one
beats on fun and on the road's fun ridden (plan (a)). With legs, a great-road ride of leg i becomes whole rides joined to
the other legs: the great ride ⊕ each point of the other legs' summed frontier, sampled every `CHAIN_STEP_S` of extra
time (the budgets the chains are swept at), and for each road the three-way frontier of those (`paretoFrontierWith`), as
now. Joining it only to the other legs' fastest would put it under the slider's ladder (less fun than the stop before
it), and the road would be lost on exactly the trips stops are made for.

Whole rides are kept as leg indices until the slider has chosen; only the chosen ones are joined into edges (section 4).

## 3. The slider over several legs

Unchanged, by design (app's plan, section 2): `chooseStops` gets whole rides, with `fastestS` the whole fastest and
`rangeS` the whole range. Each stop is a whole ride through every point; extra time, fun and twisty km are the whole
ride's; the ladder climbs on the whole ride; the great-road term pays a road on whichever leg a stop rides it (`funRidden`
on the whole ride's edges); `STOP_WORTH`, `GREAT_ROAD_WEIGHT` and `MAX_STOPS` stay. Where the detours go is the Pareto
sum's answer for each budget, so the rider moving the slider sees the extra time go first to the leg that pays most.

`stopsHidden` and the default stop look at the whole trip, as the app's plan says; nothing in `slider.ts` changes.

## 4. The options

- `legs: { timeS, distanceM, twistyM, curvyM }[]`, one per pair of points, from the leg boundaries of the joined edges.
  `twistyM` and `curvyM` are split by edge from the whole ride's twisties and curvy edges, so the legs add up to the
  whole ride exactly (a twisty that runs through a stop is split at it).
- `leg` on each `RideTwisty`: the leg holding most of its length.
- `googleMapsUrl`: the rider's stops are waypoints, in order, never dropped; the twisty pins use the
  `MAX_WAYPOINTS - stops` left, in riding order between the stops (section 5).
- `pinnedAll`: every twisty got its entry and exit pins.
- `extraS` against the whole fastest; at most 9 options, each adding time and curves (the ladder's promise).
- **Messages** (`planner/messages.ts`): `{ type: 'plan'; id; points; includeTracks }`, and
  `{ type: 'failed'; id; code; leg?; point? }` (`PlanningError` carries the index). `from` and `to` go.

## 5. The waypoint budget (`googleMaps.ts`)

`MAX_VIA = 3`, exported next to `MAX_WAYPOINTS`. Today `twistyPins` gives every twisty an entry and an exit pin, then
interior pins on long ones while waypoints remain, and the URL silently cuts at 9: a ride of six twisties already loses
its last pins. With stops:

1. The stops take their places first; `MAX_WAYPOINTS - stops` remain (6 with three stops).
2. Interior pins go first when the pins do not fit, then whole twisties (both pins) by least fun, so a twisty is pinned
   end to end or not at all, never by its entry alone (Google would then pick its own way out).
3. The pins are ordered by riding position and the stops sit between them where the ride passes them.

Merging the exit of one twisty with the entry of the next into one pin is left out: it saves a waypoint only where two
twisties touch, and a pin at a junction is what `PIN_INSET_M` exists to avoid. If three stops leave too few pins on the
bench's via trips (`pinnedAll` false on most of their options), the cap moves to 2, and the app follows the constant.

## 6. Checks, and what they should show

- **Two-point trips unchanged**: the bench on the 127 trips identical to the branch it is built on (D1 Identical on
  every trip), since a two-point trip is one leg.
- **A via set in the bench**, report only (no G1 baseline yet): the loop València → Teruel → Segorbe → València, a
  stop on the fastest line (a town València → Los Santos passes through; Chelva is 20 km off it), a stop far off it (Jaca →
Panticosa → Benasque, 22 km off the fastest), and two of the
  great-road trips with a stop at the road's far end. The route sanity checks (R-checks) run on them as on any trip; the
  report adds the share of options with `pinnedAll` and, per trip, which leg took the extra time.
- **Unit tests** (the ones app's side relies on, and the planner's own):
  - the Pareto sum against trying every combination, on random frontiers;
  - a road ridden in two legs counted once;
  - a loop plans;
  - a stop on the fastest line gives the same fastest ride and two legs;
  - `legs` add up to the whole ride, every twisty's `leg` in range;
  - `googleMapsUrl` holds every stop in order;
  - `pinnedAll` false exactly when a twisty lost a pin;
  - the pins drop interior ones first, then the least fun twisty whole;
  - a stop with no road fails with its leg, one far from roads with its point.
- **Expert-rider** on the via set: does the detour go where they would put it, and is the loop a day they would ride.
- **Speed**: the loop added to the Huawei trips, with the three of today. The fastest whole ride about as fast as a
  two-point trip of the same length; the full set no slower than the legs planned one by one (that is what step 3 does,
  plus the fold); measured on the Huawei, next to main, alternating builds.
- Gates.

## 7. Code

| file | change |
| --- | --- |
| `routing/planner.ts` | `plan(points, …)`; the per-leg part of today's `plan()` as one function; the whole fastest; the fold; options with legs |
| `routing/pareto.ts` + test | the Pareto sum of two frontiers |
| `routing/ride.ts` + test | `buildRideOption` with the stops and the leg boundaries: `legs`, `leg` per twisty, `pinnedAll` |
| `googleMaps.ts` + test | `MAX_VIA`; the budget of section 5 |
| `errors.ts` | the leg or point index on `PlanningError` |
| `planner/messages.ts`, `planner.worker.ts`, `plannerClient.ts` | `points` and the indices (the client is shared with app: the request shape only) |
| `bench/` | trips with `via`; the via set; the pins share in the report |

## Risks

- **Item count**: the great-road rides joined to the other legs add whole rides to the slider's items, whose tables are
  quadratic in them. Measured on the via set before the Huawei pass; if it hurts, the samples go to every 20 minutes.
- **A stop in a town centre** snaps to its nearest node, which may be a back street; the rider's leg then starts there.
  Same as an end today; not changed here.
- **Order of the stops** is the rider's (app's plan): the planner never reorders them.

## Not in this plan

- Optimising the stops' order, a round trip with no stop, editing a stretch on the map (ROADMAP 19).
- A per-leg budget: the app's plan gives one slider to the day.

## As built (2026-10-19)

Branch `via-points-planner`; measured on main's data (3311fa55967b0a48, candidates d017b3d4bb94), on the Mac.

- **Twisties end at a stop** (`buildRideOption` finds them leg by leg), rather than one twisty split by edge: the leg
  index is then exact, the legs add up, and the Google Maps pins never straddle a stop. The rider stops there anyway.
- **The fold scores a pair exactly**, without the fun it rides twice, instead of on the additive estimate with a rescore
  after. The estimate was wrong in a way section 2 did not foresee: on a loop, riding out and back on one road is
  estimated at twice its fun and pushed out the pair that rides two roads (the loop test of `planner.via.test.ts`).
- **The great-road joins** run every 20 minutes (`JOIN_STEP_S`), without duplicates, and only for the great roads no ride
  of the legs' Pareto sum rides. Every 5 minutes and for every road, the loop made 3,445 whole rides and took 513 ms
  against 207 for its legs planned one by one; now 399 and 292 against 221. The options of the other four trips of the
  via set did not change with the last cut.
- **Two-point trips are unchanged**: bench D1, 127 of 127 with the same routes; the rider sees the same links,
  twisties and segments on the 123 trips without tracks (compared with main's planner). The baseline was re-recorded
  only for the options' new fields.
- **`pinnedAll` follows the twisty count, not the stops**: on the two-point bench trips every option with up to 4
  twisties is pinned end to end and none with 5 or more (57 % of options); a stop takes one waypoint, so two stops cost
  one pinned twisty. On the via set 14 of 45 options are pinned end to end. `MAX_VIA` stays 3 pending the director.
- **Speed (Mac, warm)**: the loop's fastest whole ride after 11 ms; the whole set 292 ms against 221 ms for its legs
  planned one by one (+32 %): the fold 37 ms, the slider over 399 whole rides 32 ms against 6. The Huawei pass is to come.
- **The via set** is `make bench-via` (`bench/via.ts`, `bench/via-trips.json`), report only: per option the extra time of
  each leg and the twisties per leg, the pinned share and the time to plan; H7, H8, H13 and H14 on each leg. 0 failures.
