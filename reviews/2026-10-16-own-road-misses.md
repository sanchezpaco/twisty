# The six own-road misses of the `-ends` trips, measured

Date: 2026-10-16. Measure only, no code changed. Main `db2a5b3`, data `stack-data-h` (data hash 4525f9aa27229e67),
planner defaults (`maxExtraS` 3 h). Script `.claude/handoffs/routing-scripts/miss_own_road.ts` (git-ignored): locates the
road as the bench does, lists the candidates that share edges with it, their selection ranks, the exact detour, each
candidate offered on its own in both directions against the Pareto frontier, and the share of the road each slider stop
covers. Same method as Santander -> Oviedo (ROADMAP: dominated, 67 min cap).

The rule of the bench: a road is *demanded* when its detour costs at most 90 min, and *found* when some stop rides at
least 80 % of it. The planner offers detours up to `detourCapS = min(maxExtraS, 90 min, 0.5 x fastest)`.

| Road, trip | Detour | Planner cap | What the planner has | Why no stop rides it |
| --- | --- | --- | --- | --- |
| N-502 Puerto del Pico (San Román -> Sigeres) | 12 min | 59 | one candidate, 4.8 km = 63 % of the 7.6 km road, fun 64 %, rating 2 (not great), fun-per-minute rank 83 | **dominated**: alone, reverse +12 min score 21.1, the frontier has +2 min score 21.9; and **the 80 % rule cannot be met**: the other 2.55 km (a curvy edge, fun 0.50) is cut off the candidate by a 77 m junction and is under `MIN_TWISTY_LENGTH_M` (3 km) alone |
| C-462 Tuixent-la-Seu (Serrateix -> Esterri de Cardós) | 76 min | 90 | five candidates, the biggest 13.9 km = 36 % of the 38 km road (fun 97 %, rating 5) | the best piece is **great rank 35 of 361** (top 20 only) so it is never offered; offered alone (reverse +73 min, score 100.9) it is **not dominated**; no candidate covers 80 % of the road anyway |
| GIV-5221 Oix-Beget (la Bisbal -> Estavar) | 70 min | 81 | two candidates: 31.7 km (65 % of the road, great rank 4, chosen) and 9.3 km (34 %, rank 87) | **dominated**: alone +70 min score 60.5, the frontier has +42 min score 60.5; and the road is split in two candidates by 21 m + 107 m of unfunny edges at a junction, so neither reaches 80 % |
| JV-7032 Segura (Yeste -> Chiclana) | 41 min | 70 | one candidate JA-9118, 19.7 km = 100 % of the road, great rank 23 of 228 | selection: rank 23 is outside the 20; **dominated** when offered alone (reverse +43 min score 78.8 vs frontier +39 min score 81.3) |
| CV-70 Confrides (Castalla -> Benidorm) | 40 min | **25** | two candidates, 9.1 km (3 %) and 18.2 km (77 %, great rank 3, chosen) | the **planner cap on this short trip is 0.5 x 51 min = 25 min** and the road costs 40: no ride is built; the bench demands it at 90 min |
| CV-345 Alpuente-Titaguas (El Toro -> Boniches) | 33 min | 54 | none: 14 of the 22 edges are under the curvy share (0.4) and the last 2.9 km are fun 0.25 | not a candidate at all (fun 43 % of the road) |

Three findings that go beyond the single roads:

1. **The bench demands what the planner cannot offer.** The planner's cap is 0.5 x the fastest time (CV-70: 25 min);
   the bench demands up to 90 min whatever the trip. Over the 127 trips, **37 of 132 demanded pairs cost more than the
   planner's cap, and 24 of them are not found** (13 are found anyway, through an appetite route). Not a model defect:
   the two rules disagree. One of them should change, and it is a product call: the PRD says "some stop within 90 min of
   detour" and `GREAT_ROAD_MAX_EXTRA_SHARE = 0.5` says "half the trip".
2. **Candidates split a road where a junction has a short dull edge.** N-502 (77 m), GIV-5221 (128 m), C-462 (several):
   the located road is covered by two to five candidates and none reaches the bench's 80 %. This is the "candidates miss
   short curvy runs / merge across a village" item of the ROADMAP, now with three measured cases; and "found" at 80 % of
   the located road is unreachable for those three whatever the planner does.
3. **Dominance is the common reason** (N-502, GIV-5221, JV-7032): the road offered alone costs more minutes than a
   route-based option with the same fun. That is the planner working as designed on the current fun scale.

Nothing here is a planner bug. The N-502 miss is the one that smelled like one (12 min); it is a short fragment of a
road whose fun is rated 2, dominated by a +2 min option, and the bench cannot count it found even if ridden.

Proposals (the director files them): (a) decide the cap rule, bench or planner, since it explains 24 unfindable
demands; (b) measure what joining candidates across a junction of under 150 m of zero-fun edges does to the three
split roads; (c) `MAX_GREAT_CANDIDATES` 20 left alone: C-462's best piece is the only case where rank 35 excludes a
non-dominated ride.
