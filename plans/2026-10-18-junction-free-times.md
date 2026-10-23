# Travel time that does not depend on where a road is cut

ROADMAP Next up 23. Owner: routing (`gis-data-engineer`). Approved by the director (2026-10-18); built on branch `junction-time`.

## Cause (measured)

`graph.py` `add_way` gives each junction-to-junction stretch one speed:
`travel_speed_kmh(class, maxspeed, twist_density(turning inside the stretch / its length))`, a curve cap of
`CURVE_SPEED_KMH / (1 + density / CURVE_SPEED_HALVING_TWIST)` bounded by the class speed and `MIN_SPEED_KMH`. Three
things make the time of a road depend on where it is cut:

1. The density is the stretch's average, and the speed is not linear in it where the class speed or the 15 km/h floor
   binds: two halves do not add up to the whole.
2. The turning at the stretch's two end vertices is left out (`deflection_deg[start + 1 : end]`): the bend at a
   junction belongs to no edge, and a new junction in a bend moves that bend out of the count.
3. A short stretch takes all of a bend's turning over its few metres: a 20 m N-611 edge (Torrelavega) was 4.8 s,
   15 km/h, until a new junction moved the bend's vertex into the next piece (0.7 s).

After CV-712 (main e980565), cross-020 changed 7 of its 9 stops without riding a new street: its candidates were
identical; its appetite routes were the same roads at +2.7 to +3.6 s (CA-520 split in two: +7.7 s; the N-611 edge: -4.0
s), and those seconds flipped the winning route at the jump appetite (1.318). great-cv-35-tuejar-titaguas-ends moved
+4.9 s on every route the same way.

Spain-wide, on main's ways (junctions approximated as the nodes two ways share; script `split_diag.py` in the session
scratchpad): of 3.36 M stretches, cut once more at their middle vertex, 25.3 % change time by more than 1 % and 19.0 %
by more than 5 % (p95 24.9 %, p99 50.7 %, max 84 %). Any change that adds a junction (a connector, a new way, an OSM
edit) re-times the roads it touches by that much, and the planner's stops can move without a road changing.

## Change

Time is integrated along the way, the way fun already is (`cumulative_fun_m`):

1. `curvature.vertex_density(profile)`: the heading change per km over the window around every vertex (the same
   `WINDOW_M`, 1 km, the fun reads), divided by the part of the window the way covers. As built: the fun's floor, which
   takes the unseen part of a short way as straight, is not used for time. With it, a 50 m roundabout arc spread its
   turning over 500 m and roundabouts came out 37 % faster than today (39 km/h); without it a way shorter than the
   window is read whole, which still does not depend on where it is cut. No new constant.
2. `roads.travel_speed_kmh` works on an array of densities (the same rule), and `roads.cumulative_time_s(distance,
   speed)` integrates 1 / speed along the way by the trapezoid.
3. `add_way`: an edge's time is `time[end] - time[start]`. Splitting a stretch at any vertex keeps its total time
   exactly (to float rounding), and a bend at a junction counts once, in its window.
4. `travel_time_s` goes (unused); `twist_density` stays for the twisties, which are cut by the curvy runs.

## Checks

- pytest: random cut sets of a winding road sum to its uncut time within 1e-9 (20 sets); a straight road keeps its class
  or posted speed; a bend at a junction slows both edges; a roundabout cut in arcs is ridden below 25 km/h. The first
  two new tests fail on today's model, the last on the window with the fun's floor.
- As built: the planned bench split check is not possible from graph.bin, which keeps no speed per vertex; the pytest
  property test is the split check.
- Graph rebuilt in scratch (heavy slot, under timeout), the bench diff read; G1 and recall; fastest-route times on the
  bench and the 25 fresh trips; links and roundabouts (below); the baseline re-recorded on the branch.

## How much it moves

### First prototype (window with the fun's floor), measured before approval

The change was prototyped in a scratch copy of the pipeline (not on the branch), built for Spain under a timeout and
benched against main's baseline (e980565, data ddee615d6c3797b7):

| | Main | Windowed time |
| --- | --- | --- |
| Spain-wide time, tertiary / unclassified / secondary | | -2.0 % / -2.4 % / -2.8 % |
| Primary / trunk / motorway / link | | -3.6 % / -3.1 % / 0.0 % / -9.0 % |
| Tracks | | -1.1 % |
| Fastest route, 127 bench trips | | median -0.6 % (-0.8 min), from -4.8 % to +0.9 % |
| Fastest route, 25 fresh trips | | median -0.2 %, from -2.3 % to +0.9 % |
| Madrid -> Granada, fastest | 278 min | 278 min |
| Trips with no route (bench, fresh) | 0, 0 | 0, 0 |
| G1 | | 0 lost, 8 gained (a-4132, a-337, bv-5114, ca-9104 twice, cv-70, n-502, a-397) |
| Recall, tuning / holdout | 60 of 109 / 6 of 22 | 67 of 113 / 8 of 22 |
| D2 twisty km per budget, tuning / holdout | | 14 better, 7 worse, 41 mixed / 6, 6, 17 |
| twisties.json, overlay | | byte-identical (fun is not touched) |
| graph.bin gzip | 25,060,842 | 25,058,630 |

Times fall because a stretch's average density no longer hides its straights: the straight half of a stretch is ridden
at class speed and only the bends are capped. Every route's time moves, so every trip shows a different presentation
(D1 0 identical); the demanded great-road pairs change with the times (109 -> 113 tuning).

Risks to read in the bench diff before landing:

- Links are 9 % faster: a short way's window is clipped and the unseen part is taken as straight (the rule the fun
  already uses), so the bends of a ramp or a roundabout are diluted. Their class speed still caps them. To check: the
  time of the bench's motorway junctions and roundabouts, and whether a route starts to hop on and off ramps.
- The way, not the road, is the profile: a window still stops at an OSM way's end (as the fun did before flowing fun step
  1). Reading it along the chain, as `curve_fun_by_way` does for the fun, would remove that too, for chained ways only;
  not in this change unless the bench shows way ends matter.
- No speed constant is refitted here. The model has never been fitted to real rides (ROADMAP Next up 5); the test
  ride to Los Santos (queued report) gives a first read of real against predicted time for both models.

### As built (4f49536), measured

Bench against main's baseline (data ddee615d6c3797b7 -> 3311fa55967b0a48):

| | Main | As built |
| --- | --- | --- |
| Time per class, graph.bin (tertiary, unclassified, secondary) | | +1.3 %, +1.1 %, +1.5 % |
| Primary, trunk, motorway, link, residential | | +1.7 %, +1.8 %, +0.3 %, +0.8 %, +0.3 % |
| Roundabouts, Spain-wide (99,294 ways) | 24.8 km/h | 20.6 km/h (today misses the turns at their end vertices) |
| Fastest route, 127 bench trips | | median +0.6 %, from +0.05 % to +1.9 % |
| Fastest route, 25 fresh trips | | median +0.4 %, from -0.1 % to +1.8 % |
| Madrid -> Granada, fastest | 278 min | 279 min |
| Trips with no route (bench, fresh) | 0, 0 | 0, 0 |
| G1 | | 0 lost, 1 gained (ca-9104-palomas on its own trip) |
| Recall, tuning / holdout | 60 of 109 / 6 of 22 | 60 of 109 / 7 of 22 |
| D2, tuning / holdout (better, worse, mixed) | | 14, 24, 18 / 3, 11, 14 |
| Best twisty km within 15 / 30 / 60 / 90 / 120 / 180 min, all trips | | -0.6 / -1.7 / -2.3 / -0.4 / -1.1 / -1.6 % |
| Links on the bench options | 1,924 km, 1.18 % of the time | 1,908 km, 1.17 % |
| Ramp hops (off and back on the same motorway or trunk within 3 km) | 229 | 211 (almost all under 150 m) |
| The test ride, moving / predicted (to Los Santos) | 0.75 | 0.75 |
| graph.bin gzip | 25,060,842 | 25,056,737 |
| twisties.json, overlay | | byte-identical |

Times rise a little where the first prototype fell: bends at junctions now count, and short ways and the ends of long
ones are no longer diluted. Twisty roads gain more time than fast ones (tertiary +1.3 %, motorway +0.3 %), so a detour
costs a little more and the best twisty km within a budget fall by 0.4 to 2.3 %. No great road is lost. Reading the
window along the chain, as the fun does, would stop way ends from clipping it; it is the next lever if the D2 read is
not accepted.

## The speed-scaled heading change (flowing fun step 2)

Step 2 (closed with no change, branch `flowing-fun-k2-exp`) scales each bend's heading change by
`(v / 60) ** FLOW_SPEED_POWER`, with `v` the road's cruising speed: class speed capped by the posted limit, per vertex on
the chain, and never the curve-capped speed this plan computes. So:

- This change does not move the fun, the twisties or step 2's numbers: on main the fun reads no speed but the class
  pace factor, step 2 would read `cruising_speed_kmh`, and time reads the curve cap; neither feeds the other.
- They touch different code: step 2 changes `chains.py` (a speed per chain vertex) and `roads.py` constants; this
  changes `add_way`, `curvature.py` (`vertex_density`) and `roads.py` (`cumulative_time_s`). Both add to `roads.py`;
  a rebase of the k = 2 branch on top was not tried.
- If step 2 is ever revisited with the speed the road is really ridden at (bends included), the per-vertex speed this plan
  computes is that speed, with no loop: speed comes from the raw heading change, fun from the speed-scaled one.
- Step 2 failed on the stop rules (one appetite route per slot), not on times; this change does not touch the stop rules,
  and its G1 read (0 lost) is on today's fun.
