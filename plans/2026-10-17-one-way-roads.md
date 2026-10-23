# Plan: one-way roads in the graph (Next up 13)

Status: approved by the director (2026-10-17), built on branch `oneway`. Owner: `routing`.

## Why

The graph is undirected and the pipeline ignores `oneway`. On today's main (data `988f0fa007109bf6`) every one of the 969
bench options rides some one-way way against its direction: 30,200 km in all, 26,700 km of them on the opposite
carriageway of a motorway, 488 km up motorway ramps, 236 km round roundabouts the wrong way. The maintainer saw one on the
Fold: València -> Los Santos, the +17 min stop rides the V-30 west to the node where an on-ramp (OSM 469056520) merges,
then turns back 166 deg up the ramp to reach the CV-30. 28 of the 7,099 Google Maps waypoints sit on a wrong-way
stretch, so Google is asked to reach the wrong carriageway. Measured with `.claude/handoffs/routing-scripts/wrong_way.ts`
(an independent match of route points to the one-way OSM ways, a lower bound).

## What

**Pipeline.**
- A way is one-way when `oneway` is yes/1/-1, when it is a roundabout (`junction=roundabout|circular`), or when it is a
  `motorway` or `motorway_link` (implied), unless `oneway=no`. A `-1` way has its nodes reversed when read, so a way's
  node order is always its legal direction. `reversible` and `alternating` stay two-way (they change with the hour).
- Each edge carries `oneway` (legal only from `edge_from` to `edge_to`). Contraction never merges across a change of
  direction (a one-way edge with a two-way one, or two one-way edges pointing at each other).
- The kept network is the strongly connected core: nodes in strongly connected components of at least
  `MIN_COMPONENT_NODES` (the undirected rule today). A node a rider can enter but never leave (a one-way trap, a mapping
  error) or leave but never reach is dropped, so any node A or B snaps to can reach and be reached from the rest: the
  snap respects direction without knowing it. The km dropped are reported.
- `graph.bin` goes to `TWG4`: a `u8 edgeOneway[E]` section after `edgeFords`. Tracks layer the same.
- After the first build (director, 2026-10-17): a town's one-way streets are ridden both ways (`OneWay.IN_TOWN`, the
  direction kept for the bench). The graph lacks most town streets, so a place could be legal to leave only by a long
  loop: Montellano to the A-361 2 km away took 37 min, and 428 of 8,654 towns had a road nearby 5 min or more dearer
  legal than two-way. Motorways, trunk roads, ramps and roundabouts stay one-way everywhere.
- No U-turn from one one-way edge onto another (`U_TURN_DEG`, 170 deg as approved, built at 150 deg because the edges'
  headings put real divide U-turns at 157-169 deg: N-340, N-3, A-624): with directed carriageways a stop could
  ride out on one and back on the other where they rejoin, and U-turns of 170 deg or more in the bench stops doubled (79
  to 150). Each edge carries its heading at both ends (`u8 edgeHeading[2E]`, read 15 m along it). A split of the node
  where a road divides was tried first and dropped: in a node-based graph it needs the road to the next junction twice,
  as two one-way edges, and a stop then rode out on one and back on the other (CA-9104 3.2 km, A-369 4.6 km).

**Planner.**
- `ShortestPaths` is built for a direction: a forward search takes an edge only from its legal start, a backward search
  (cost *to* the source) only from its legal end. Same adjacency, one byte read per relaxation.
- The searches never take a banned U-turn. At a node where one exists, a search keeps a label per edge it arrives by
  (elsewhere one label per node), so the best way in by one carriageway does not hide the way in by the road that may go
  on to the other: the legal way, often on to the next junction and back, is still found. The meeting node of the
  bidirectional search and the joins of composite routes (`isRideable`) are checked the same way. An exact treatment of
  every turn is the turn-aware search (ROADMAP, Phase 4).
- `bidirectionalEdges` takes a forward and a backward search. The planner's second search becomes the backward one;
  the departure legs of `ridesThrough` (exit -> end) use it; `combined` finds the leg into a road with a backward search
  and the leg out with a forward one, for each way of riding the road, and keeps the valid order.
- A candidate road is offered, and joined to a stop, only in a direction it may be ridden (`isRideable`); every other
  piece comes from a search that respects direction, so a route built from pieces is legal by construction and the bench
  check guards it.
- A and B snap only to a node of a two-way road: a node of one-way streets only can be legal to leave by a long loop
  round a town whose other streets the graph does not have.
- Bench: `fromEnd` searches become backward ones (great roads, forced routes, pins, generate, worker).

## Checks and report

- Bench FAIL: wrong-way metres = 0 on every option, from the graph's own direction (H13), and no U-turn from one
  carriageway onto the other (H14). Report: a town's one-way streets ridden against their direction, and Google Maps
  waypoints on them (R19, R20). `wrong_way.ts` runs as an
  independent cross-check in the report. Turns of 150 deg or more between different roads: a report only.
- Trips with no route at all (snap, one-way trap, wrong carriageway): counted over the bench trips and the 25 fresh trips.
- Turn restrictions: counted Spain-wide by kind, and how many bench turns break them; not built here, filed as their own
  item with the numbers.
- graph.bin size, Mac planning ms (idle), settled nodes, before and after; the bench G1 read, each loss with its cause,
  marked "correction" when the lost ride was illegal; the baseline re-recorded on the branch.
- The Huawei measure is the director's, before a tester APK.
