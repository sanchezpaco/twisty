# Plan: route defects (ROADMAP Next up 8)

Status: for the director's approval, nothing built. Owner: `routing`. Date: 2026-10-16. Brief:
`.claude/handoffs/brief-routing-defects.md`; the defects come from `reviews/2026-10-16-blind-eval-v1.md`.

Everything below is measured on the snapshot `data/routing-v1-2026-10-16/` (tag `routing-v1-2026-10-16`, main
1f584d1), by planning the bench trips and keeping each stop's edges: 123 trips (the four trips with tracks are left
out of the counts) and 934 stops. Scratch only; the scripts are in `.claude/handoffs/routing-scripts/` (`defects_*`).

## What the judge saw, and whose it was

Two of the three defects are partly the kit's own forced route, not a planner stop. Measured on the dossier key:

- **City centres:** the Madrid streets (p-3ac8896a) and Burgos Calle Vitoria (p-0e2f1b9f) are in the forced route
  (the key says `x: forced` for the latter). Madrid appears in none of our 934 stops; Burgos in two.
- **Out-and-back:** the 39 km of the N-621 and the CV-345 / CV-35 repeats are forced routes too (the kit's
  `forcedRepeatedKm`, 8 of 82 pairs). Our own stops do it as well (below).

The forced route is the bar and stays as it is, so the fixes below are judged by the planner's stops and by the graph
that both routes share.

## 1. Out-and-back

**Check (exists, tightened):** R1 counts the metres of edges ridden twice. Today it flags above 500 m; the new bar is
any repeated edge, counted at every stop and at the default and most-fun stops, with the spur's one-way km and its
roads in the report.

**Measured on v1:** 46 stops of 934 (4.9 %) in 32 of 123 trips repeat edges, 126 km in all; 26 of them repeat 1 km or
more. The worst: C-462 L-401 28.3 km (great-c-462-coll-de-port, stop 6), AS-227 / LE-493 Somiedo 8 to 14 km, A-348
5.6 km. The repeated roads are curvy (45 to 60 % fun) and are out and back.

**Cause, measured:** every one of the 46 stops comes from `routeStretches`, which are the only rides the planner lets
repeat an edge (`mayRepeat: true`); none of the 198 appetite stops, 98 candidate stops or the coverage stop repeats.
(Run with each route tagged by where it was made; the plans are identical with and without the tag.) A stretch is the
fastest way to its entry, the middle of an appetite route and the fastest way back from its exit, three paths that
share edges when the exit sits in a valley whose only road is the way in (Potes). Candidate stretches already refuse
such a ride.

**Fix:** refuse a ride that walks an edge twice in `ridesThrough`, for every stretch (the `mayRepeat` flag goes). Tried
as a probe on the snapshot data, nothing else changed: recall 62 of 110 and 8 of 22 as in v1, no great road lost or
gained, settled nodes 1,351,194 mean against 1,351,153, no failure; 39 trips change, 14 lose curvy km (4 gain). Those
14 are stops that counted the repeated edges' fun twice (the score is summed per edge walked), so the loss is the
double counting going away. Judged by the kit's pairs on the trips that change.

## 2. City centres

**Check (new, R16 `cityCentre`):** km of the stop on road that is not motorway, trunk or link and lies within 3 km of
one of the 90 `city` places, in a city at least 6 km from the trip's ends, minus what the fastest route rides there.
A stop is flagged at 1 km or more.

**Measured on v1:** 61 stops (6.5 %) in 25 trips, 296 km (48 stops, 19 trips, 183 km at 2 km). Cities: Jaén 9 stops,
Cáceres 7, Córdoba 6, Lleida 5, Lugo 5, Manresa 5, Ávila 4, Talavera 4, Burgos 2.

**Cause, measured:** speed model, not a missing ring road. The graph times a street at the class speed capped by its
limit and nothing else (`travel_speed_kmh`, `roads.py`): inside 3 km of the centre the mean speed of non-motorway
road is 50 km/h on Madrid's primary streets (65 km), 48 on secondary, 43 on tertiary, 43 on Burgos's secondary (45 km),
and 53 to 63 on Jaén's primary and tertiary; the motorway there is 68 (M-30). A crossing with lights, junctions and
traffic takes a motorcycle roughly twice that, and the ring road's longer distance does not pay against 45 to 50 km/h.
The fix belongs to the data:

**Fix tried, and measured (step 4):** a 30 km/h cap on the ways that cross a town (`crosses_town`: built up and posted
50 or less; motorways, trunk roads and slip roads keep theirs), the same rule as the fun gate. The correction to the
plan: there are no R11 reference times (no trip has `referenceTimeS`); the only reference is the PRD's Madrid ->
Granada, 4 h 10 real against 4 h 37 modelled, which goes to 4 h 38 (277 -> 278 min). Scratch data (same 649,409 nodes
and 889,934 edges, identical fun, 48,325 edges slower, 245 of 63,218 km of curvy edges), `urban-cap-exp` branch:

- R16: 67 stops in 26 trips -> 63 in 25. The cap does not move the crossings.
- Recall 62 -> 61 of 110 (tuning), holdout 8 of 22; **two G1 losses** (c-28-bonaigua on great-c-28-bonaigua,
  bv-5114-santa-fe on regional-012), one great road gained; twisty km: 9 improved, 17 worsened on tuning; the median
  fastest time moves 0.45 %.
- Cause, measured on the 61 stop-city pairs of v1 (avoiding the centre costs the route against crossing it, closing
  the centre's non-fast roads and routing the fastest way round): avoiding is never within 2 minutes, 19 of 61 are
  within 5 minutes (Cáceres 7, Lugo 5, Reus 2, Jerez 2, Córdoba, Ávila, Ourense), the median is 13.9 minutes. With the
  cap the median is 13.5 and 3 are within 2 minutes. So most crossings are the cheaper way, by minutes, with the model
  as it is: there is no bypass, or the bypass is long. The speed model explains a few, not most.

Recommendation: do not land the cap; R16 stays as a report, and the 19 pairs with a bypass within 5 minutes are the
ones a stronger town pace could move, which is a decision for the maintainer, not a tuning run.

## 3. Side loops

**Check (new, R17 `sideLoop`):** a stretch of the stop between two of its own nodes that the fastest path joins in at
most 20 min, ridden in at least 5 min more, whose fun is under 0.8 fun km per extra minute. Found by a bounded search
from each node, biggest waste first, loops not overlapping.

**Measured on v1:** loops of 5 min or more are not rare at all (a twisty road off a motorway is one): 45 % of stops
have one of 3 min or more. With fun under 0.8 per minute: 42 loops, one per stop, in 42 stops (4.5 %) in 28 trips.
Where they come from: 21 are route stretches (3.3 % of those stops), 17 candidate rides (17 % of candidate stops), 4
appetite routes (2 %).

**The judge's four examples, measured:**

| example | trip and stop | extra over the chord | fun km per extra minute |
| --- | --- | --- | --- |
| Jou / Espot / Son (C-28) | great-c-28-bonaigua-ends 1, great-n-260-port-del-canto-ends 4 | 20.1 min for 22 km | 0.68 (13.7 fun km) |
| Béjar villages (DSA-244, DSA-246) | cross-039 stops 4 to 6 | 7.0 min for 12.9 km | 1.16 |
| La Vansa / Sisquer (C-462) | great-c-462-tuixent-la-seu-ends 4 and 5 | 1.5 min for 16.7 km | 8.1 |
| HF04 lanes (N-260) | none found: no loop with an HF road in any of the 934 stops | | |

So only Jou / Espot is a loop that costs minutes for little fun; La Vansa costs 1.5 min over the C-462 and is mostly
a matter of the value of those lanes (item 9), as the Béjar villages are. I would not fix the judge's four; I would fix
what the check finds, and say so.

**Decided (director, 2026-10-16):** R17's bar is dominated loops at zero. A loop is dominated when the fastest way
between its ends has at least its fun (it costs minutes and buys nothing); that is R17. Loops that buy fun, however
little, are a value choice: they are not fixed here, no trim step is added, and the report names them (R17b, loops of
5 min or more buying under 0.5 fun km per minute they add over the fastest way) for item 9, the value of a road.

**Measured in the build (step 2):** of 909 loops of 5 min or more, none is dominated (R17 = 0 on v1); R17b finds 76
stops in 46 of the 127 trips. So the cause of the judge's loops is the value of those lanes, not the stitching.

## Success bar

- R1 at zero repeated edges; R17 at zero dominated loops (already so); R16 at 10 % of its v1 count (about 7 stops) or each
  remaining one named; R17b is reported, not a bar.
- Recall 62 of 110 (tuning) and 8 of 22 (holdout) no worse, G1 zero; lanes and sweepers guards as in the quality-score
  work. A G1 loss goes to the maintainer.
- The frozen kit judged again on the v2 dossier (`make bench-eval ... --added`): the pairs the judge flagged and the
  absolute scores of the 50 routes compared with round A and B of v1. The director runs the judge.

## Order and cost

1. R1 fix (small, probed): one change in `planner.ts`, a test, a re-recorded baseline.
2. R16 and R17 as checks first (bench, tests), measured, baseline re-recorded with them.
3. (dropped) the loop trim: the loops are not dominated; they go to item 9.
4. City speed cap: built and measured on scratch data; it does not fix the crossings and loses two great roads (above).

The work rides on one branch, `route-defects`, in this order, each step its own commit. Heavy runs take
a heavy slot; scratch data only.

## Not in this plan

Montseny paid for with AP-7, long options through village lanes, wide passes undervalued and the "unsafe km" label
(blind-eval items 4 to 7) belong to item 9, the value of a road.
